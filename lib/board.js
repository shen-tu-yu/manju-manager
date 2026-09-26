'use strict';

/**
 * 提示词工作台（board）—— 「一条提示词配多张参考图」那套数据的读写。
 *
 * 依赖全部显式注入，模块自身不持有全局状态：
 *   sendJSON(res, code, obj)  统一的 JSON 响应
 *   readJson(req)             读请求体（原 server.js 里的 body()）
 *   DB                        数据层（getSettings / setSettings）
 */

const BOARD_IMAGES_MAX = 12;    // 一条提示词最多配多少张参考图（防手滑拖进来一百张）

/**
 * 把一条条目的配图归一成数组 —— **一条提示词可以配多张图**（人物 + 场景 + 风格…）。
 * 顺便做三件事：去重、限数量、兼容早期只有单个 image 字段的数据。
 */
function normBoardImages(it, max) {
  const out = [];
  const push = (im) => {
    if (!im || !im.root || !im.path) return;
    const root = String(im.root), p = String(im.path);
    if (out.some((x) => x.root === root && x.path === p)) return;
    if (out.length >= max) return;
    out.push({ root, path: p });
  };
  if (Array.isArray(it && it.images)) it.images.forEach(push);
  if (it && it.image) push(it.image);        // 老数据（单图）自动升级
  return out;
}

module.exports = function createBoard({ sendJSON, readJson, DB }) {
  const imagesMax = BOARD_IMAGES_MAX;

  return {
    imagesMax,

    // 读整块工作台数据（缺字段的老数据用 def 兜住）
    get(req, res) {
      const d = DB.getSettings().promptBoard;
      const def = {
        script: '', seconds: 10, skills: [], items: [], site: 'doubao', askTemplate: '',
        askPresets: [], askPresetId: '', rawReply: '', rawMode: 'split', rawHistory: [],
      };
      if (!d || typeof d !== 'object') return sendJSON(res, 200, def);
      return sendJSON(res, 200, Object.assign(def, d, {
        items: (Array.isArray(d.items) ? d.items : []).map((it) => Object.assign({}, it, { images: normBoardImages(it, imagesMax) })),
        imagesMax,
      }));
    },

    // 存整块工作台数据（前端一次提交全部字段）
    async save(req, res) {
      const b = await readJson(req);
      const data = {
        script: String(b.script == null ? '' : b.script),
        seconds: Number(b.seconds) || 10,
        site: String(b.site || 'doubao'),
        askTemplate: String(b.askTemplate == null ? '' : b.askTemplate).slice(0, 20000),
        // ★ 预设库：**分两类** —— kind='storyboard' 写分镜（取回切成条目）/ 'text' 写剧情（取回不分割）
        askPresets: (Array.isArray(b.askPresets) ? b.askPresets : []).slice(0, 30).map((x) => ({
          id: String(x && x.id || ''),
          kind: (x && x.kind === 'text') ? 'text' : 'storyboard',
          name: String(x && x.name || '').slice(0, 60),
          text: String(x && x.text == null ? '' : x.text).slice(0, 20000),
        })).filter((x) => x.id),
        askPresetId: String(b.askPresetId || '').slice(0, 40),
        // ★ 分镜原文：完整文本（分割只读它）。上限跟取回文本一致，别把 settings 撑爆
        rawReply: String(b.rawReply == null ? '' : b.rawReply).slice(0, 200000),
        rawWhy: String(b.rawWhy == null ? '' : b.rawWhy).slice(0, 300),
        rawMode: (b.rawMode === 'text') ? 'text' : 'split',
        // ★ 历史原文：**新的一次生成不覆盖旧的**，旧的都留在这里
        rawHistory: (Array.isArray(b.rawHistory) ? b.rawHistory : []).slice(0, 8).map((x) => ({
          at: Number(x && x.at) || 0,
          why: String(x && x.why || '').slice(0, 300),
          mode: (x && x.mode === 'text') ? 'text' : 'split',
          text: String(x && x.text == null ? '' : x.text).slice(0, 200000),
        })),
        skills: Array.isArray(b.skills) ? b.skills.map((x) => ({ dirId: String(x.dirId || ''), rel: String(x.rel || '') })) : [],
        items: Array.isArray(b.items) ? b.items.map((it) => ({
          id: String(it.id || ''),
          prompt: String(it.prompt == null ? '' : it.prompt),
          images: normBoardImages(it, imagesMax),
          state: String(it.state || ''),
          note: String(it.note || ''),
        })) : [],
        updatedAt: Date.now(),
      };
      DB.setSettings({ promptBoard: data });
      return sendJSON(res, 200, { ok: true, saved: data.items.length });
    },
  };
};
