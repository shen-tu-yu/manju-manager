'use strict';

/**
 * 投放通道 —— 网页和 AI 站点之间的「命令队列」。
 *
 * 背景：网页端和目标站脚本之间**没有长连接**可用，所以走
 *   网页入队 → 助手脚本每 1.2 秒来取一条 → 执行（投图/投提示词/点发送）→ 回执 → SSE 推回网页。
 * 任务只存在内存里（投放是即时动作），进程重启就没了，不做持久化。
 *
 * 三种命令：
 *   deliver —— 把这条的多张图**一张一张**（间隔 0.5s）投进输入框，再投提示词
 *   ask     —— 把「剧情 + skill 附件」投给文本 AI 并自动发送
 *   read    —— 把文本 AI 的回复取回来（判据由前端下发，见 expect）
 *   send    —— 点目标站的发送按钮（**找不到按钮就失败，绝不猜坐标瞎点**）
 *
 * ⚠️ 依赖全部从外面**显式注入**（组装那几行在 server.js），不碰任何隐藏全局：
 *   LOG / sseSend / sendJSON / readJson / imagesMax
 * 从 server.js 原样搬过来，行为没改。
 */
module.exports = function createDeliver({ LOG, sseSend, sendJSON, readJson, imagesMax }) {
  const tasks = new Map();               // id -> task
  const KEEP = 100;                      // 内存里最多留多少条历史
  const TIMEOUT_MS = 90 * 1000;          // 脚本领取后超时未回执 → 退回待执行

  function queue(kind, payload) {
    const id = 'dl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const t = Object.assign({ id, kind, state: 'pending', createdAt: Date.now(), message: '' }, payload);
    tasks.set(id, t);
    if (tasks.size > KEEP) {
      const oldest = Array.from(tasks.values())
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, tasks.size - KEEP);
      for (const o of oldest) if (o.state === 'done' || o.state === 'failed') tasks.delete(o.id);
    }
    LOG(`[投放] 入队 ${id}（${kind}${t.itemId ? ' · ' + t.itemId : ''}）`);
    sseSend('deliver', { id, kind, itemId: t.itemId || '', state: 'pending', message: '' });
    return t;
  }

  /** 助手脚本轮询：取一条待执行的任务（取到即标记 running） */
  function next(req, res, ctx) {
    const q = ctx.q;
    const site = String(q.get('site') || '');
    const page = String(q.get('page') || '');      // 脚本上报自己所在的页面路径，便于排查
    const now = Date.now();
    for (const t of tasks.values()) {              // 超时回收：脚本崩了/页面关了，任务不能卡死
      if (t.state === 'running' && now - (t.startedAt || 0) > TIMEOUT_MS) {
        t.state = 'pending';
        t.message = '上次执行超时，重来';
        sseSend('deliver', { id: t.id, kind: t.kind, itemId: t.itemId || '', state: 'pending', message: t.message });
      }
    }
    const t = Array.from(tasks.values())
      .filter((x) => x.state === 'pending' && (!site || !x.site || x.site === site))
      .sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!t) return sendJSON(res, 200, { task: null });
    t.state = 'running';
    t.startedAt = now;
    LOG(`[投放] 脚本领取 ${t.id}（${t.kind}${page ? ' · 来自 ' + page : ''}）`);
    sseSend('deliver', { id: t.id, kind: t.kind, itemId: t.itemId || '', state: 'running', message: '' });
    return sendJSON(res, 200, {
      task: {
        id: t.id,
        kind: t.kind,
        images: t.images || [],      // deliver 用
        prompt: t.prompt || '',      // deliver 用
        text: t.text || '',          // ask 用（剧情 + 输出要求）
        files: t.files || [],        // ask 用（skill 附件）
        expect: t.expect || null,    // read 用（什么才算"正式回答"），见 /api/deliver/queue
      },
    });
  }

  /** 助手脚本回执 */
  async function done(req, res, ctx) {
    const b = await ctx.body();
    const t = tasks.get(String(b.id || ''));
    if (!t) return sendJSON(res, 200, { ok: true, gone: true });
    t.state = b.ok ? 'done' : 'failed';
    t.message = String(b.message || '');
    t.finishedAt = Date.now();
    // 取回的长文本（read 命令用）：存下来并推给网页；日志只记长度，别把 debug.log 撑爆
    if (typeof b.result === 'string' && b.result.trim()) t.result = b.result.slice(0, 200000);
    LOG(`[投放] ${t.id} ${t.state}：${t.message}${t.result ? `（带回 ${t.result.length} 字）` : ''}`);
    if (Array.isArray(b.probe) && b.probe.length) {          // 脚本附带的页面诊断 → 进 debug.log
      t.probe = b.probe.slice(0, 20).map(String);
      LOG(`[投放] ${t.id} 页面诊断：\n      ` + t.probe.join('\n      '));
    }
    sseSend('deliver', {
      id: t.id, kind: t.kind, itemId: t.itemId || '',
      state: t.state, message: t.message, result: t.result || '',
    });
    return sendJSON(res, 200, { ok: true });
  }

  /** 网页入队（三种命令都走这里） */
  async function enqueue(req, res, ctx) {
    const b = await ctx.body();
    const kind = String(b.kind || 'deliver');
    const site = String(b.site || 'doubao');

    if (kind === 'ask') {
      // skill 是**组合投放**的，上限给足（20 个），别像以前那样静默截断
      const files = (Array.isArray(b.files) ? b.files : [])
        .filter((f) => f && f.dirId && f.rel)
        .slice(0, 20)
        .map((f) => ({ dirId: String(f.dirId), rel: String(f.rel), name: String(f.name || '') }));
      const t = queue('ask', { site, text: String(b.text || ''), files });
      return sendJSON(res, 200, {
        ok: true, id: t.id, files: files.length,
        chars: t.text.length,
        dropped: Math.max(0, (Array.isArray(b.files) ? b.files.length : 0) - files.length),
      });
    }

    if (kind === 'read') {
      // ⚠️ expect 是**前端下发的"什么才算正式回答"判据**（前端知道预设的格式：分隔符 + 段落标题）。
      // 脚本拿它挡"只等到思考链"的情况 —— 判据的知识留在前端，脚本只做字符串检查。
      const b2 = b.expect && typeof b.expect === 'object' ? b.expect : null;
      const expect = b2 ? {
        split: String(b2.split || '').slice(0, 40),
        head: String(b2.head || '').slice(0, 40),
      } : null;
      const t = queue('read', { site, expect: (expect && (expect.split || expect.head)) ? expect : null });
      return sendJSON(res, 200, { ok: true, id: t.id });
    }

    const images = (Array.isArray(b.images) ? b.images : [])
      .filter((x) => x && x.root && x.path)
      .slice(0, imagesMax)
      .map((x) => ({ root: String(x.root), path: String(x.path) }));
    const t = queue('deliver', {
      itemId: String(b.itemId || ''),
      site,
      images,
      prompt: String(b.prompt || ''),
    });
    return sendJSON(res, 200, { ok: true, id: t.id, images: images.length });
  }

  /** 网页入队：让脚本去点目标站的发送按钮 */
  async function send(req, res, ctx) {
    const b = await ctx.body();
    const t = queue('send', { itemId: String(b.itemId || ''), site: String(b.site || 'doubao') });
    return sendJSON(res, 200, { ok: true, id: t.id });
  }

  /** 网页查任务状态（刷新页面后恢复显示用） */
  function state(req, res) {
    return sendJSON(res, 200, {
      tasks: Array.from(tasks.values())
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((t) => ({ id: t.id, kind: t.kind, itemId: t.itemId || '', state: t.state, message: t.message || '', at: t.createdAt }))
        .slice(-50),
    });
  }

  return { queue, next, done, enqueue, send, state };
};
