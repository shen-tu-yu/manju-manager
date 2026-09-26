/* 投放素材助手 —— 篡改猴脚本 / Edge 扩展内容脚本（同一份代码，改完要同步另外两份） */
'use strict';

(function () {
  /* ================= 配置 ================= */

  const FM = 'http://127.0.0.1:8899';
  const MAX_BYTES = 200 * 1024 * 1024;

  /**
   * 受支持的投放平台：脚本在哪个站点注入，就"投放到"哪个站点。
   * 加新平台 = 这里加一项 + UserScript 的 @match + extension/manifest.json 的 matches。
   *
   * 每一项的选择器都按**优先级排列**（先精确、后通用），因为第三方 DOM 会改版：
   *   input  —— 输入框
   *   send   —— 发送按钮（找不到时统一退回"在输入框按 Enter"，豆包就是这么发的）
   *   reply  —— AI 回复容器（下一期"读复制按钮取回结果"要用）
   *
   * 选择器来源写在 CODE_MAP 2.6：豆包是用户从 DevTools 实测给的；DeepSeek 来自 ArcRift 的
   * PLATFORM_SELECTORS.md（2026-05 实测）。查不到实测选择器的平台，就只留通用兜底 + 靠失败诊断。
   */
  const SITES = [
    {
      id: 'doubao', name: '豆包', re: /(^|\.)doubao\.com$/i,
      input: ['textarea.semi-input-textarea', '[contenteditable="true"]', 'textarea'],
      send: ['#flow-end-msg-send', '[data-testid="chat_input_send_button"]', 'button[aria-label="发送"]'],
      reply: ['[data-message-author-role="assistant"]', '.ds-markdown', '[class*="message-content"]'],
    },
    {
      id: 'deepseek', name: 'DeepSeek', re: /(^|\.)deepseek\.com$/i,
      // DeepSeek 的输入框就是个 <textarea id="chat-input">，比豆包的 Semi 组件好认
      input: ['#chat-input', 'textarea[placeholder*="Send a message"]',
        'textarea[data-testid="chat-input"]', 'div[contenteditable][role="textbox"]', 'textarea'],
      send: ['button[aria-label="Send message"]', '[data-testid="send-button"]', 'button[type="submit"]'],
      reply: ['[data-message-author-role="assistant"]', '.ds-markdown',
        '[class*="AssistantMessage"]', '[class*="markdown-body"]'],
    },
    {
      id: 'pavo', name: 'Pavo', re: /(^|\.)pavo-ai\.work$/i,
      input: ['[contenteditable="true"]', 'textarea'],
      send: [],
      reply: [],
    },
  ];
  const SITE = SITES.find((s) => s.re.test(location.hostname)) || null;
  const SITE_NAME = SITE ? SITE.name : '目标站';

  // 在投放平台页面 = 干活；在本地素材管理页面 = 只挂一个「已安装」标记，供页面自动检测
  const IS_TARGET = !!SITE;

  const state = {
    open: false,
    libReady: false,
    rootId: null,
    path: '',
    entries: [],
    busy: false,
    diag: '还没发送过',
  };

  /* ================= 小工具 ================= */

  const log = (...a) => console.log('%c[素材助手]', 'color:#4b9cff;font-weight:bold', ...a);

  function fmtSize(n) {
    if (n == null) return '';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isImage = (n) => /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i.test(n);
  const isVideo = (n) => /\.(mp4|mov|webm|mkv|avi|m4v|flv|wmv)$/i.test(n);
  const iconOf = (e) => e.isDir ? '📁' : isImage(e.name) ? '🖼' : isVideo(e.name) ? '🎬' : '📄';

  function toast(msg, ok) {
    const t = document.createElement('div');
    t.className = 'mja-toast' + (ok === false ? ' err' : ok === true ? ' ok' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
  }

  /* ================= 把文件送进目标站点（豆包 / Pavo 通用） ================= */

  function findInputs() {
    return Array.from(document.querySelectorAll('input[type="file"]'));
  }

  function acceptOk(input, file) {
    const acc = (input.getAttribute('accept') || '').trim();
    if (!acc) return true;
    const type = file.type || '';
    const name = (file.name || '').toLowerCase();
    return acc.split(',').some((raw) => {
      const a = raw.trim().toLowerCase();
      if (!a) return false;
      if (a === '*/*' || a === '*') return true;
      if (a.endsWith('/*')) return type.startsWith(a.slice(0, -1));
      if (a.startsWith('.')) return name.endsWith(a);
      return type === a;
    });
  }

  function injectToInput(input, files) {
    try {
      const dt = new DataTransfer();
      for (const f of files) dt.items.add(f);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files').set;
      setter.call(input, dt.files);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) {
      log('注入 input 失败', e);
      return false;
    }
  }

  function injectByDrop(files) {
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(f);
    const seeds = [
      document.querySelector('[contenteditable="true"]'),
      document.querySelector('textarea'),
      document.querySelector('[class*="editor"]'),
      document.querySelector('[class*="input"]'),
    ].filter(Boolean);
    if (!seeds.length) return false;
    let fired = 0;
    for (const seed of seeds.slice(0, 3)) {
      const target = seed.closest('form, [class*="chat"], [class*="editor"], [class*="input"]') || seed;
      try {
        for (const type of ['dragenter', 'dragover', 'drop']) {
          target.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
        }
        fired++;
      } catch (e) { log('模拟拖放失败', e); }
    }
    return fired > 0;
  }

  function sendFiles(files) {
    const list = Array.from(files);
    if (!list.length) return { ok: false, sent: 0 };

    const usable = list.filter((f) => f.size <= MAX_BYTES);
    const skipped = list.length - usable.length;
    if (!usable.length) {
      state.diag = `全部文件都超过 ${fmtSize(MAX_BYTES)} 上限`;
      renderDiag();
      return { ok: false, sent: 0 };
    }

    const inputs = findInputs();
    const accepts = inputs.map((i) => i.accept || '(不限)').join(' | ') || '无';
    log('找到', inputs.length, '个 input[type=file]，accept =', accepts);

    let sent = 0;
    const used = new Set();
    for (const input of inputs) {
      const fit = usable.filter((f) => !used.has(f) && acceptOk(input, f));
      if (!fit.length) continue;
      const take = input.multiple ? fit : [fit[0]];
      if (injectToInput(input, take)) {
        take.forEach((f) => used.add(f));
        sent += take.length;
      }
    }

    let mode = 'input 注入';
    if (sent < usable.length) {
      const rest = usable.filter((f) => !used.has(f));
      mode = '模拟拖放';
      if (injectByDrop(rest)) sent += rest.length;
    }

    state.diag = `找到 ${inputs.length} 个上传控件（accept: ${accepts}）\n`
      + `方式：${mode}　结果：送入 ${sent}/${list.length}`
      + (skipped ? `，跳过 ${skipped} 个超大文件` : '');
    renderDiag();
    log('发送结果：', sent, '/', list.length);
    return { ok: sent > 0, sent };
  }

  /* ================= 投放通道（网页点一下 → 这里执行） =================
   * 网页把任务放进本地服务的队列，这里每 1.2 秒取一条：
   *   deliver —— 这条的图**一张一张**投进输入框（间隔 0.5 秒，确保人和图不串），再投提示词
   *   send    —— 点目标站的发送按钮（**找不到按钮就报失败，绝不猜坐标瞎点**）
   */

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pathName = (p) => String(p || '').split('/').pop();

  function postJSON(url, data) {
    const body = JSON.stringify(data || {});
    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST', url, data: body,
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
          onload: (res) => {
            if (res.status !== 200) return reject(new Error('HTTP ' + res.status));
            try { resolve(JSON.parse(res.responseText)); } catch { resolve({}); }
          },
          onerror: () => reject(new Error('连不上素材服务')),
          ontimeout: () => reject(new Error('请求超时')),
        });
      });
    }
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))));
  }

  /** 找输入框：按当前平台的选择器表挨个试（先精确后通用） */
  function findInputBox() {
    const list = (SITE && SITE.input) || ['[contenteditable="true"]', 'textarea'];
    for (const sel of list) {
      let el = null;
      try { el = document.querySelector(sel); } catch { continue; }
      if (el) return el;
    }
    return null;
  }

  /** 把提示词写进输入框（先试 insertText，再退回原生 setter + input 事件，两种都能让 React 收到） */
  function injectText(text) {
    const s = String(text || '');
    if (!s) return false;
    const box = findInputBox();
    if (!box) return false;
    try { box.focus(); } catch { /* 有的元素不能 focus */ }

    if (box.tagName === 'TEXTAREA' || box.tagName === 'INPUT') {
      let doneOk = false;
      try { doneOk = document.execCommand && document.execCommand('insertText', false, s); } catch { doneOk = false; }
      if (!doneOk || !box.value) {
        const proto = box.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(box, s);
      }
      box.dispatchEvent(new Event('input', { bubbles: true }));
      box.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    let ok = false;
    try { ok = document.execCommand && document.execCommand('insertText', false, s); } catch { ok = false; }
    if (!ok) {
      box.textContent = s;
      box.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
    return true;
  }

  /**
   * 在输入框上按 Enter —— **豆包网页版就是这么发的**
   * （参考开源的 doubao-playwright-skill：它发消息只做 textarea.press('Enter')，根本不点按钮）。
   */
  function pressEnter(el) {
    const o = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    try { el.focus(); } catch { /* 忽略 */ }
    el.dispatchEvent(new KeyboardEvent('keydown', o));
    el.dispatchEvent(new KeyboardEvent('keypress', o));
    el.dispatchEvent(new KeyboardEvent('keyup', o));
  }

  /** 发送按钮：先用当前平台实测过的精确选择器，再按属性打分兜底；找不到返回 null（不瞎点） */
  function findSendButton() {
    // ① 平台选择器表（豆包：#flow-end-msg-send 三件套；DeepSeek：aria-label="Send message" 等）
    for (const sel of ((SITE && SITE.send) || [])) {
      let nodes = [];
      try { nodes = document.querySelectorAll(sel); } catch { continue; }
      for (const el of nodes) {
        if (el.disabled) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return el;
      }
    }
    // ② 打分兜底：平台改版时还能救一下
    const list = Array.from(document.querySelectorAll('button, [role="button"], [data-testid*="send"], [class*="send" i]'));
    let best = null, bestScore = 0;
    for (const el of list) {
      const txt = [
        el.getAttribute('aria-label') || '',
        el.getAttribute('data-testid') || '',
        el.getAttribute('title') || '',
        typeof el.className === 'string' ? el.className : '',
        el.textContent || '',
      ].join(' ');
      let s = 0;
      if (/(^|\s)(send|发送|生成)(\s|$)/i.test(txt)) s += 6;
      else if (/send|发送|生成/i.test(txt)) s += 3;
      if ((el.getAttribute('type') || '').toLowerCase() === 'submit') s += 2;
      if (el.disabled) s -= 6;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) s -= 6;
      if (s > bestScore) { bestScore = s; best = el; }
    }
    return bestScore >= 5 ? best : null;
  }

  /** 诊断：把页面上像按钮的东西列出来，随回执发给本地服务（写进 debug.log，方便我按实际 DOM 适配） */
  function describeEl(el) {
    const r = el.getBoundingClientRect();
    const cls = typeof el.className === 'string'
      ? el.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    const parts = [el.tagName.toLowerCase()];
    if (cls) parts.push('.' + cls);
    const al = el.getAttribute('aria-label'); if (al) parts.push('aria="' + al + '"');
    const dt = el.getAttribute('data-testid'); if (dt) parts.push('testid="' + dt + '"');
    const tx = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 14); if (tx) parts.push('"' + tx + '"');
    parts.push('@' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    return parts.join(' ');
  }

  function buttonProbe() {
    try {
      const out = []; 
      const box = findInputBox();
      out.push('输入框: ' + (box ? describeEl(box) : '没找到')
        + ' | 路径 ' + location.pathname + ' | file input ' + findInputs().length + ' 个');
      for (const el of document.querySelectorAll('button, [role="button"], [data-testid], [class*="send" i]')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        out.push(describeEl(el));
        if (out.length >= 15) break;
      }
      return out;
    } catch (e) { return ['probe 失败: ' + e.message]; }
  }

  async function reportTask(id, ok, message, probe) {
    try { await postJSON(FM + '/api/deliver/done', { id, ok, message, probe: probe || null }); }
    catch (e) { log('回执失败', e.message); }
  }

  /** 这个页面能不能干活：有输入框或上传控件才算 —— 豆包云盘/设置这类页面什么也没有 */
  function pageCanWork() {
    if (findInputBox()) return true;
    if (findInputs().length) return true;
    return false;
  }

  function pageInfo() {
    return location.pathname + (location.search ? location.search.slice(0, 40) : '');
  }

  async function runTask(task) {
    log('收到任务', task.id, task.kind);
    let ok = false, msg = '', probe = null;
    try {
      // 双保险：领取时页面能干活，执行时可能已经跳走了（豆包是 SPA）
      if (!pageCanWork()) {
        probe = buttonProbe();
        throw new Error(`当前豆包页面（${pageInfo()}）不是对话/生成页，找不到输入框和上传控件 —— 请切回对话页面再投`);
      }
      if (task.kind === 'send') {
        const btn = findSendButton();
        if (btn && !btn.disabled) {
          btn.click();
          ok = true;
          msg = '已点发送按钮';
        } else {
          // 豆包网页版是按 Enter 发送的 —— 按钮找不到/不可用就退回按 Enter，比瞎点坐标可靠
          const box = findInputBox();
          if (box) {
            pressEnter(box);
            ok = true;
            msg = (btn ? '发送按钮不可用' : '没找到发送按钮') + '，已改用「在输入框按 Enter」发送';
          } else {
            msg = '既没找到发送按钮，也没找到输入框';
            probe = buttonProbe();
          }
        }
      } else {
        const imgs = Array.isArray(task.images) ? task.images : [];
        let sent = 0;
        for (const im of imgs) {
          const blob = await getBlob(`${FM}/api/file?root=${encodeURIComponent(im.root)}&path=${encodeURIComponent(im.path)}`);
          const file = new File([blob], pathName(im.path) || ('image' + (sent + 1) + '.png'),
            { type: blob.type || 'image/png' });
          const inputs = findInputs();
          const input = inputs.find((i) => acceptOk(i, file)) || inputs[0];
          if (!input) {
            probe = buttonProbe();
            throw new Error(`当前豆包页面（${pageInfo()}）里没有 input[type=file]，投不进图片`);
          }
          if (!injectToInput(input, [file])) throw new Error('注入图片失败');
          sent++;
          await sleep(500);                        // ← 一张一张来，中间隔 0.5 秒，确保顺序不乱
        }
        let textOk = false;
        if (task.prompt) textOk = injectText(task.prompt);
        // 提示词没投进去就算失败：否则用户以为投好了，一点发送发出个没有提示词的内容
        if (task.prompt && !textOk) {
          probe = buttonProbe();
          throw new Error(`投了 ${sent} 张图，但提示词没写进输入框`);
        }
        ok = sent > 0 || textOk;
        msg = `已投 ${sent} 张图${textOk ? ' + 提示词' : ''}，等你点「发送」`;
      }
    } catch (e) {
      msg = e.message || String(e);
      if (!probe) probe = buttonProbe();
    }
    state.diag = `任务 ${task.kind}：${msg}`;
    renderDiag();
    toast(msg, ok);
    await reportTask(task.id, ok, msg, probe);
  }

  let deliverTimer = null;

  /**
   * 轮询本地服务取任务（setTimeout 链，不会请求堆积）。
   * ⚠️ **页面干不了活就不领任务** —— 否则豆包云盘页/设置页也会把任务抢走，
   * 然后在那边报"找不到输入框"（真实踩过：诊断里路径是 /drive-iframe/drive/home/）。
   */
  function startDeliverLoop() {
    if (deliverTimer || !IS_TARGET) return;
    let idleCount = 0;
    const tick = async () => {
      if (!pageCanWork()) {
        idleCount++;
        if (idleCount % 8 === 1) log('当前页面没法投放，暂停领任务：', pageInfo());
        deliverTimer = setTimeout(tick, 1200);
        return;
      }
      idleCount = 0;
      try {
        const r = await getJSON(`${FM}/api/deliver/next?site=${encodeURIComponent(SITE.id)}`
          + `&page=${encodeURIComponent(pageInfo())}`);
        if (r && r.task) await runTask(r.task);
      } catch { /* 服务没开 / 断网：下一轮再试，不刷日志 */ }
      deliverTimer = setTimeout(tick, 1200);
    };
    deliverTimer = setTimeout(tick, 1500);
  }

  /* ================= 素材库 ================= */

  const fileURL = (e) => `${FM}/api/file?root=${encodeURIComponent(state.rootId)}`
    + `&path=${encodeURIComponent(state.path ? state.path + '/' + e.name : e.name)}`;

  let io = null;
  function ensureIO() {
    if (io) return io;
    io = new IntersectionObserver((list) => {
      for (const it of list) {
        if (!it.isIntersecting) continue;
        io.unobserve(it.target);
        const fn = it.target.__lazy;
        if (fn) { it.target.__lazy = null; fn(); }
      }
    }, { root: bodyEl, rootMargin: '300px 0px' });
    return io;
  }

  /**
   * 统一网络层。
   * 油猴环境优先用 GM_xmlhttpRequest —— 它在扩展后台发请求，
   * 不受 CORS / 混合内容 / 私有网络访问(PNA) 这三重限制；
   * 扩展环境没有这个 API，退回 fetch（靠服务端的 CORS 白名单）。
   */
  function request(url, asBlob) {
    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          responseType: asBlob ? 'blob' : undefined,
          timeout: asBlob ? 120000 : 10000,
          onload: (res) => {
            if (res.status !== 200) return reject(new Error('HTTP ' + res.status));
            if (asBlob) return resolve(res.response);
            try { resolve(JSON.parse(res.responseText)); }
            catch { reject(new Error('返回不是 JSON')); }
          },
          onerror: () => reject(new Error('连不上素材服务')),
          ontimeout: () => reject(new Error('请求超时')),
        });
      });
    }
    return fetch(url, { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return asBlob ? r.blob() : r.json();
    });
  }

  const getJSON = (url) => request(url, false);
  const getBlob = (url) => request(url, true);

  // 缩略图走 blob，绕开 <img> 直连 127.0.0.1 可能被拦的问题
  const objUrls = [];
  function releaseUrls() {
    while (objUrls.length) { try { URL.revokeObjectURL(objUrls.pop()); } catch { } }
  }

  async function libInit() {
    try {
      const cfg = await getJSON(FM + '/api/config');
      if (!cfg.roots || !cfg.roots.length) throw new Error('素材库里还没有添加文件夹');
      state.rootId = cfg.roots[0].id;
      state.libReady = true;
      await libLoad('');
    } catch (e) {
      state.libReady = false;
      log('素材库不可用：', e.message);
    }
    renderLib();
  }

  async function libLoad(path) {
    if (!state.libReady) return;
    releaseUrls();
    state.busy = true;
    renderLib();
    try {
      const r = await getJSON(`${FM}/api/list?root=${encodeURIComponent(state.rootId)}`
        + `&path=${encodeURIComponent(path)}&limit=200&sort=name-asc`);
      state.path = path;
      state.entries = (r.folders || []).map((e) => Object.assign(e, { isDir: true }))
        .concat((r.files || []).map((e) => Object.assign(e, { isDir: false })));
    } catch (e) {
      toast('读取素材失败：' + e.message, false);
      state.entries = [];
    }
    state.busy = false;
    renderLib();
  }

  async function sendFromLibrary(entry) {
    if (state.busy) return;
    if (entry.size > MAX_BYTES) {
      return toast(`「${entry.name}」${fmtSize(entry.size)}，超过上限`, false);
    }
    const full = state.path ? state.path + '/' + entry.name : entry.name;
    state.busy = true;
    renderLib();
    try {
      const blob = await getBlob(`${FM}/api/file?root=${encodeURIComponent(state.rootId)}`
        + `&path=${encodeURIComponent(full)}`);
      const file = new File([blob], entry.name, { type: blob.type || 'application/octet-stream' });
      const r = sendFiles([file]);
      toast(r.ok ? `已送入${SITE_NAME}：${entry.name}` : `没能送进${SITE_NAME}，看侧边栏底部的诊断`, r.ok);
    } catch (e) {
      state.diag = '读取素材失败：' + e.message + '\n（确认 8899 服务在运行）';
      renderDiag();
      toast('读取失败：' + e.message, false);
    }
    state.busy = false;
    renderLib();
  }

  /* ================= 界面 ================= */

  const CSS = `
  #mja-btn{position:fixed;top:64px;right:0;z-index:2147483000;padding:9px 12px 9px 14px;
    background:#4b9cff;color:#fff;border-radius:20px 0 0 20px;cursor:pointer;
    font:600 13px/1 "Microsoft YaHei UI","Microsoft YaHei",sans-serif;
    box-shadow:-2px 2px 12px rgba(0,0,0,.28);user-select:none;transition:padding .15s}
  #mja-btn:hover{padding-right:18px}
  #mja-btn.on{background:#2f7fdc}
  #mja-panel{position:fixed;top:0;right:0;z-index:2147483001;width:520px;min-width:300px;max-width:96vw;
    height:100vh;background:#171a20;color:#e6e9ef;border-left:1px solid #2c313c;display:none;
    flex-direction:column;font:13px/1.5 "Microsoft YaHei UI","Microsoft YaHei",sans-serif;
    --mja-thumb:150px;
    box-shadow:-6px 0 26px rgba(0,0,0,.45)}
  #mja-panel.on{display:flex}
  #mja-grip{position:absolute;left:-3px;top:0;width:7px;height:100%;cursor:col-resize;z-index:5}
  #mja-grip:hover,#mja-grip.drag{background:rgba(75,156,255,.55)}
  .mja-head{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:10px 12px;
    border-bottom:1px solid #2c313c;flex:0 0 auto;cursor:move;user-select:none}
  .mja-head b{font-size:14px;white-space:nowrap}
  .mja-sp{flex:1}
  .mja-mini{background:#21252e;color:#98a1b0;border:1px solid #2c313c;border-radius:6px;
    padding:4px 8px;font-size:12px;cursor:pointer;flex:0 0 auto}
  .mja-mini:hover{color:#e6e9ef;border-color:#3a4352}
  .mja-body{flex:1 1 auto;overflow:auto;padding:0}
  .mja-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--mja-thumb,150px),1fr));gap:9px;padding:10px}
  .mja-cell{position:relative;background:#0f1115;border:1px solid #2c313c;border-radius:8px;
    overflow:hidden;cursor:pointer;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;
    transition:border-color .12s,transform .1s}
  .mja-cell:hover{border-color:#4b9cff;transform:translateY(-2px)}
  .mja-cell img,.mja-cell video{width:100%;height:100%;object-fit:cover;display:block;background:#0f1115}
  .mja-cell .ph{font-size:30px;opacity:.55}
  .mja-cell .nm{position:absolute;left:0;right:0;bottom:0;padding:5px 7px 6px;font-size:10.5px;line-height:1.35;
    color:#e6e9ef;background:linear-gradient(transparent,rgba(0,0,0,.9));overflow:hidden;
    text-overflow:ellipsis;white-space:nowrap;pointer-events:none}
  .mja-cell .sz{position:absolute;right:5px;top:5px;padding:1px 6px;border-radius:4px;
    background:rgba(0,0,0,.72);font-size:10px;color:#c8d3e2;pointer-events:none}
  .mja-cell.folder{background:#21252e}
  .mja-cell.busy{opacity:.45;pointer-events:none}
  .mja-crumb{display:flex;flex-wrap:wrap;gap:3px;align-items:center;padding:4px 6px 8px;font-size:12px;color:#98a1b0}
  .mja-crumb span{cursor:pointer;padding:1px 5px;border-radius:4px}
  .mja-crumb span:hover{background:#21252e;color:#e6e9ef}
  .mja-row{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:6px;cursor:pointer}
  .mja-row:hover{background:#21252e}
  .mja-row.busy{opacity:.5;pointer-events:none}
  .mja-ic{flex:0 0 auto;font-size:14px}
  .mja-nm{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px}
  .mja-sz{flex:0 0 auto;color:#6b7484;font-size:11px}
  .mja-empty{padding:30px 16px;text-align:center;color:#6b7484;font-size:12.5px;line-height:1.9}
  .mja-drop{margin:8px;padding:15px;border:1.5px dashed #3a4557;border-radius:10px;text-align:center;
    color:#98a1b0;font-size:12.5px;line-height:1.7}
  .mja-drop.hot{border-color:#4b9cff;background:rgba(75,156,255,.12);color:#cfe3ff}
  .mja-diag{flex:0 0 auto;padding:9px 12px;border-top:1px solid #2c313c;
    font:11.5px/1.6 Consolas,"Microsoft YaHei UI",monospace;color:#8fa2bd;
    white-space:pre-wrap;word-break:break-all;max-height:120px;overflow:auto;background:#0f1115}
  .mja-toast{position:fixed;bottom:34px;left:50%;transform:translateX(-50%);z-index:2147483002;
    padding:10px 18px;border-radius:8px;background:#21252e;color:#e6e9ef;border:1px solid #2c313c;
    font:13px/1.5 "Microsoft YaHei UI",sans-serif;box-shadow:0 8px 26px rgba(0,0,0,.5);
    transition:opacity .3s;max-width:70vw}
  .mja-toast.ok{border-color:#2a6b4d}
  .mja-toast.err{border-color:#6b2f30;color:#ffb3ae}
  `;

  let panel, btn, bodyEl, diagEl;

  /* ---- 界面记忆：位置 / 宽度 / 预览图大小，存本地，重开页面还在原处 ---- */
  const UI_KEY = 'mja-ui-v1';
  const ui = { left: null, top: 0, width: 520, thumb: 150 };

  function loadUI() {
    try { Object.assign(ui, JSON.parse(localStorage.getItem(UI_KEY) || '{}')); } catch { /* 读坏就用默认 */ }
    ui.width = Math.min(Math.max(300, +ui.width || 520), Math.round(window.innerWidth * 0.96));
    ui.thumb = Math.min(Math.max(90, +ui.thumb || 150), 420);
    ui.top = Math.max(0, +ui.top || 0);
    ui.left = (ui.left == null) ? null : Math.max(0, +ui.left || 0);
  }

  function saveUI() {
    try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* 存不了就算了 */ }
  }

  /** 把 ui 里的值刷到面板上（位置 / 宽度 / 高度 / 预览图大小），并保证不越出视口 */
  function applyUI() {
    if (!panel) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    ui.width = Math.min(Math.max(300, ui.width), Math.round(vw * 0.96));
    if (ui.left == null) {
      panel.style.left = 'auto'; panel.style.right = '0';
    } else {
      ui.left = Math.min(Math.max(0, ui.left), Math.max(0, vw - 120));
      panel.style.left = ui.left + 'px'; panel.style.right = 'auto';
    }
    ui.top = Math.min(Math.max(0, ui.top), Math.max(0, vh - 120));
    panel.style.top = ui.top + 'px';
    panel.style.height = (vh - ui.top) + 'px';     // 始终从 top 延伸到底，不会戳出屏幕
    panel.style.width = ui.width + 'px';
    panel.style.setProperty('--mja-thumb', ui.thumb + 'px');
  }

  function build() {
    const st = document.createElement('style');
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);

    btn = document.createElement('div');
    btn.id = 'mja-btn';
    btn.textContent = '📁 素材';
    btn.onclick = toggle;
    document.body.appendChild(btn);

    panel = document.createElement('div');
    panel.id = 'mja-panel';
    panel.innerHTML = `
      <div id="mja-grip"></div>
      <div class="mja-head">
        <b>📁 漫剧素材${SITE ? ' · ' + SITE.name : ''}</b>
        <span class="mja-sp"></span>
        <button class="mja-mini" id="mja-smaller" title="预览图变小">－</button>
        <button class="mja-mini" id="mja-bigger" title="预览图变大">＋</button>
        <button class="mja-mini" id="mja-reset" title="复位：回到右上角、默认大小">⌂</button>
        <button class="mja-mini" id="mja-refresh" title="重新读取素材库">刷新</button>
        <button class="mja-mini" id="mja-close" title="收起面板">×</button>
      </div>
      <div class="mja-drop" id="mja-drop">把文件拖到这里<br><span style="opacity:.75">松手即送入${SITE_NAME}</span></div>
      <div class="mja-body" id="mja-body"></div>
      <div class="mja-diag" id="mja-diag"></div>
    `;
    document.body.appendChild(panel);
    loadUI();
    applyUI();
    bodyEl = panel.querySelector('#mja-body');
    diagEl = panel.querySelector('#mja-diag');

    panel.querySelector('#mja-close').onclick = toggle;
    panel.querySelector('#mja-refresh').onclick = () => libInit();

    // 预览图大小：－ / ＋ 每档 30px（90~420），和位置一起记住
    const stepThumb = (d) => { ui.thumb = Math.min(420, Math.max(90, ui.thumb + d)); applyUI(); saveUI(); };
    panel.querySelector('#mja-smaller').onclick = () => stepThumb(-30);
    panel.querySelector('#mja-bigger').onclick = () => stepThumb(30);
    panel.querySelector('#mja-reset').onclick = () => {
      ui.left = null; ui.top = 0; ui.width = 520; ui.thumb = 150;
      applyUI(); saveUI();
      toast('已复位到右上角默认大小', true);
    };

    const drop = panel.querySelector('#mja-drop');
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => {
      e.preventDefault(); e.stopPropagation(); drop.classList.add('hot');
    }));
    drop.addEventListener('dragleave', (e) => { e.stopPropagation(); drop.classList.remove('hot'); });
    drop.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation();
      drop.classList.remove('hot');
      const files = Array.from(e.dataTransfer.files || []);
      if (!files.length) return;
      const r = sendFiles(files);
      toast(r.ok ? `已送入${SITE_NAME} ${r.sent} 个文件` : '没能送进去，看底部诊断', r.ok);
    });

    panel.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
    panel.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); });

    // 拖动：抓标题栏移动整块面板，抓左边缘调宽度。
    // 用 Pointer Capture —— 指针划过页面里的 iframe 时事件仍归捕获元素，不会把拖动"甩掉"。
    // 位置/宽度都记进 ui，重开页面还在原处。
    const head = panel.querySelector('.mja-head');
    const grip = panel.querySelector('#mja-grip');
    let mode = null, sx = 0, sy = 0, sl = 0, st0 = 0, fixedRight = 0;

    function startDrag(e, kind) {
      const r = panel.getBoundingClientRect();
      mode = kind;
      sx = e.clientX; sy = e.clientY; sl = r.left; st0 = r.top; fixedRight = r.right;
      if (kind === 'move') {
        if (ui.left == null) ui.left = r.left;          // 从"贴右"切成"自由位置"
        head.style.cursor = 'grabbing';
      } else {
        grip.classList.add('drag');
        document.body.style.cursor = 'col-resize';
      }
      try { (kind === 'move' ? head : grip).setPointerCapture(e.pointerId); } catch { /* 老浏览器无所谓 */ }
      e.preventDefault(); e.stopPropagation();
    }

    function moveDrag(e) {
      if (!mode) return;
      if (mode === 'move') {
        ui.left = sl + (e.clientX - sx);
        ui.top = st0 + (e.clientY - sy);
      } else {
        ui.width = Math.max(300, Math.min(window.innerWidth * 0.96, fixedRight - e.clientX));
      }
      applyUI();
    }

    function endDrag() {
      if (!mode) return;
      if (mode === 'move') head.style.cursor = '';
      else { grip.classList.remove('drag'); document.body.style.cursor = ''; }
      mode = null;
      saveUI();
    }

    head.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) startDrag(e, 'move'); });
    grip.addEventListener('pointerdown', (e) => startDrag(e, 'resize'));
    [head, grip].forEach((el) => {
      el.addEventListener('pointermove', moveDrag);
      el.addEventListener('pointerup', endDrag);
      el.addEventListener('pointercancel', endDrag);
    });

    window.addEventListener('resize', () => applyUI());   // 窗口变了别让它跑出屏幕

    renderDiag();
  }

  function toggle() {
    state.open = !state.open;
    panel.classList.toggle('on', state.open);
    btn.classList.toggle('on', state.open);
    btn.textContent = state.open ? '✕ 收起' : '📁 素材';
    if (state.open && !state.libReady) libInit();
  }

  function renderDiag() {
    if (diagEl) diagEl.textContent = state.diag;
  }

  function renderLib() {
    if (!bodyEl) return;
    if (!state.libReady) {
      bodyEl.innerHTML = `<div class="mja-empty">
        没连上素材服务<br>
        <span style="font-size:11.5px;opacity:.8">
          请先双击 <b>D:\\文件管理\\启动.bat</b><br>再点上面的「刷新」
        </span>
      </div>`;
      return;
    }
    if (state.busy && !state.entries.length) {
      bodyEl.innerHTML = '<div class="mja-empty">读取中…</div>';
      return;
    }
    const parts = [];
    if (!state.path) {
      parts.push('<span data-p="">🏠 根目录</span>');
    } else {
      parts.push('<span data-p="">🏠</span>');
      let acc = '';
      state.path.split('/').filter(Boolean).forEach((seg) => {
        acc = acc ? acc + '/' + seg : seg;
        parts.push('›<span data-p="' + esc(acc) + '">' + esc(seg) + '</span>');
      });
    }
    let html = '<div class="mja-crumb">' + parts.join('') + '</div>';

    if (!state.entries.length) {
      html += '<div class="mja-empty">这个文件夹是空的</div>';
    } else {
      html += '<div class="mja-grid">' + state.entries.map((e, i) => {
        const ph = isVideo(e.name) ? '🎬' : isImage(e.name) ? '🖼' : '📄';
        return `<div class="mja-cell${e.isDir ? ' folder' : ''}${state.busy ? ' busy' : ''}"
            data-i="${i}" title="${esc(e.name)}">
          <div class="ph">${e.isDir ? '📁' : ph}</div>
          ${e.isDir ? '' : `<span class="sz">${fmtSize(e.size)}</span>`}
          <div class="nm">${esc(e.name)}</div>
        </div>`;
      }).join('') + '</div>';
    }
    bodyEl.innerHTML = html;

    bodyEl.querySelectorAll('.mja-crumb span').forEach((s) => {
      s.onclick = () => libLoad(s.dataset.p || '');
    });

    bodyEl.querySelectorAll('.mja-cell').forEach((cell) => {
      const e = state.entries[+cell.dataset.i];
      if (!e) return;
      cell.onclick = () => {
        if (e.isDir) libLoad(state.path ? state.path + '/' + e.name : e.name);
        else sendFromLibrary(e);
      };
      if (e.isDir) return;
      const img = isImage(e.name), vid = isVideo(e.name);
      if (!img && !vid) return;
      // 缩略图懒加载：滚到附近才去拉，避免一进文件夹就下载几十个 5MB 的图
      cell.__lazy = () => {
        getBlob(fileURL(e)).then((blob) => {
          const u = URL.createObjectURL(blob);
          objUrls.push(u);
          let media;
          if (vid) {
            media = document.createElement('video');
            media.preload = 'metadata';
            media.muted = true;
            media.src = u + '#t=0.1';
          } else {
            media = document.createElement('img');
            media.src = u;
          }
          const clear = () => { const p = cell.querySelector('.ph'); if (p) p.remove(); };
          media.addEventListener('loadeddata', clear);
          media.addEventListener('loadedmetadata', clear);
          if (!vid) media.addEventListener('load', clear);
          cell.insertBefore(media, cell.firstChild);
        }).catch((err) => {
          log('缩略图加载失败', e.name, err.message);
        });
      };
      ensureIO().observe(cell);
    });
  }

  /* ================= 启动 ================= */

  function boot() {
    if (document.getElementById('mja-panel')) return;
    if (!document.body) { setTimeout(boot, 300); return; }
    if (!IS_TARGET) {
      // 本地页面：挂个标记，「投放素材助手」面板靠它显示"已安装"
      // ⚠️ 这一步**不能**因为是 iframe 就退出 —— 安装检测用的正是一个隐藏 iframe。
      //（也正因为如此，脚本头**不能加 @noframes**，加了检测就废了。）
      document.documentElement.dataset.mjaReady = '1';
      log('已在本地页面挂上「已安装」标记');
      return;
    }
    // 投放平台：**只在顶层页面干活**。
    // 豆包对话页里嵌了 /drive-iframe/... 的云盘 iframe，而脚本会被注入到所有 frame，
    // 那个实例一样在轮询、一样能抢到任务，然后必然报"找不到输入框"——
    // 实际踩过：诊断里当前路径是 /drive-iframe/drive/home/（用户明明在对话页）。
    if (window.top !== window.self) return;
    build();
    startDeliverLoop();
    log('已注入，当前页面已有', findInputs().length, '个 input[type=file]');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
