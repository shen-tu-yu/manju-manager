/* ===================== 漫剧素材管理器 · 前端 ===================== */
'use strict';

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.jfif', '.gif', '.webp', '.bmp', '.avif', '.svg', '.ico']);
const VID_EXT = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v', '.flv', '.wmv']);
const AUD_EXT = new Set(['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg']);
const TXT_EXT = new Set(['.txt', '.md', '.json', '.js', '.ts', '.css', '.html', '.xml', '.yml', '.yaml', '.log',
  '.csv', '.ini', '.bat', '.ps1', '.py', '.srt', '.ass', '.vue', '.jsx', '.tsx']);

/* 可调参数集中在这里 —— 不要再往代码里撒字面量 */
const TUNING = {
  pageLimit: 200,     // 每次拉多少条（滚动加载的步长）
  searchLimit: 100,   // 搜索每页多少条
  thumbGrid: 480,     // 网格视图缩略图边长(px)
  thumbList: 120,     // 列表视图缩略图边长(px)
};

/* ===================== 状态 ===================== */

const S = {
  cfg: null,
  rootId: null,
  path: '',
  entries: [],
  view: 'grid',
  sort: 'name-asc',
  filter: 'all',
  sel: new Set(),
  lastIdx: -1,
  lbIdx: -1,
  lbList: [],
  mode: 'files',      // files | trash | search
  trash: [],
  internalClip: null, // 网页内部的复制/剪切暂存（用于「粘贴到其它文件夹」）—— 和系统剪贴板是两回事
  searchResults: null,
  vgroups: [],        // 当前根目录的虚拟分类 [{ id, name, files:[文件名] }]
  looseCount: 0,      // 未被任何虚拟分类引用的散文件数
  // 分页（服务端分页，前端滚动加载）
  pageOffset: 0,
  pageLimit: TUNING.pageLimit,
  hasMore: false,
  loadingMore: false,
  totalFiles: 0,
  selectAll: false,   // 全选整个视图（不止已加载的那一页）
};

const content = () => $('#content');

/* ===================== 虚拟节点 =====================
 * 根目录下没归进任何文件夹的散文件，不直接堆在主窗口，而是收进虚拟节点「散-未归类」。
 * 虚拟分类（vgroup）则是「归类」用的：只记录文件名引用，文件本体不动。
 * 路径里带冒号 —— Windows 文件名不允许冒号，所以绝不会和真实文件夹撞名。
 */
const LOOSE = '::loose::';
const LOOSE_NAME = '散-未归类';
const VG_PREFIX = '::vg::';
const isLoose = (p) => p === LOOSE;
const isVGroup = (p) => String(p || '').startsWith(VG_PREFIX);
const vgIdOf = (p) => String(p || '').slice(VG_PREFIX.length);
/** 虚拟路径（散-未归类 / 虚拟分类）背后真实的目录，永远是根目录 */
function realPath(p) {
  if (p === LOOSE || isVGroup(p)) return '';
  return p || '';
}
/** 这条路径是不是虚拟的 */
const isVirtualPath = (p) => p === LOOSE || isVGroup(p);

/* ===================== 工具 ===================== */

function fmtSize(n) {
  if (n == null) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

function fmtDur(sec) {
  if (!isFinite(sec) || sec <= 0) return '';
  const s = Math.floor(sec % 60), m = Math.floor(sec / 60) % 60, h = Math.floor(sec / 3600);
  const p = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

function fmtTime(ms) {
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const p = (x) => String(x).padStart(2, '0');
  if (sameDay) return `今天 ${p(d.getHours())}:${p(d.getMinutes())}`;
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

function kindOfName(name) {
  const i = name.lastIndexOf('.');
  const ext = i < 0 ? '' : name.slice(i).toLowerCase();
  if (IMG_EXT.has(ext)) return 'image';
  if (VID_EXT.has(ext)) return 'video';
  if (AUD_EXT.has(ext)) return 'audio';
  if (TXT_EXT.has(ext)) return 'text';
  return 'other';
}

function joinPath(dir, name) { return dir ? dir + '/' + name : name; }
function parentOf(p) { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
function baseName(p) { const i = p.lastIndexOf('/'); return i < 0 ? p : p.slice(i + 1); }

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fileUrl(rootId, p, download) {
  const q = new URLSearchParams({ root: rootId || S.rootId, path: p });
  if (download) q.set('download', '1');
  return '/api/file?' + q.toString();
}

/* ===================== API ===================== */

async function api(pathname, opts) {
  const res = await fetch(pathname, opts);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || res.statusText }; }
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}

async function apiPost(pathname, body) {
  return api(pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
}

/* ===================== 操作日志 =====================
 * 记下做过什么，尤其是「归类」「转实体」「删除」这类回头想不起来的操作。
 * 存在 localStorage，刷新页面不丢。
 */

const LOG_KEY = 'fm-oplog-v1';

const Log = {
  items: [],
  max: 300,

  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      this.items = Array.isArray(raw) ? raw : [];
    } catch { this.items = []; }
  },

  save() {
    try { localStorage.setItem(LOG_KEY, JSON.stringify(this.items.slice(0, this.max))); } catch { }
  },

  /** icon: 图标  text: 一行摘要  detail: 展开的细节（可多行） */
  add(icon, text, detail) {
    this.items.unshift({ t: Date.now(), icon: icon || '•', text: String(text || ''), detail: detail ? String(detail) : '' });
    if (this.items.length > this.max) this.items.length = this.max;
    this.save();
    renderLogButton();
    if (!$('#logPanel').classList.contains('hidden')) renderLogPanel();
  },

  clear() {
    this.items = [];
    this.save();
    renderLogButton();
    renderLogPanel();
  },
};

function fmtClock(ms) {
  const d = new Date(ms);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function renderLogButton() {
  const el = $('#logLatest');
  if (!el) return;
  const it = Log.items[0];
  el.textContent = it ? `${it.icon} ${it.text}` : '暂无操作';
  $('#btnLog').title = it ? `${fmtClock(it.t)}  ${it.text}\n(点击查看完整日志)` : '还没有任何操作记录';
}

function renderLogPanel() {
  const box = $('#logList');
  if (!box) return;
  if (!Log.items.length) {
    box.innerHTML = '<div class="log-empty">还没有任何操作记录</div>';
    return;
  }
  box.innerHTML = Log.items.map((it) => `
    <div class="log-item">
      <span class="log-time">${fmtClock(it.t)}</span>
      <span class="log-icon">${esc(it.icon)}</span>
      <div class="log-body">
        <div class="log-text">${esc(it.text)}</div>
        ${it.detail ? `<div class="log-detail">${esc(it.detail)}</div>` : ''}
      </div>
    </div>`).join('');
}

/* ===================== Toast ===================== */

function toast(msg, type, ms) {
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 260);
  }, ms || 2600);
}

/* ===================== 缩略图缓存（IndexedDB + canvas） ===================== */

const Thumb = {
  db: null,
  ready: false,
  mem: new Map(),

  async init() {
    try {
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('fm-thumbs-v1', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('thumbs')) db.createObjectStore('thumbs');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      this.ready = true;
    } catch { this.ready = false; }
  },

  key(rootId, path, mtime, size) {
    return `${rootId}|${path}|${Math.round(mtime || 0)}|${size || 0}`;
  },

  async get(key) {
    if (this.mem.has(key)) return this.mem.get(key);
    if (!this.ready) return null;
    return new Promise((resolve) => {
      try {
        const rq = this.db.transaction('thumbs', 'readonly').objectStore('thumbs').get(key);
        rq.onsuccess = () => resolve(rq.result || null);
        rq.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  },

  async put(key, blob) {
    this.mem.set(key, blob);
    if (!this.ready) return;
    try {
      const tx = this.db.transaction('thumbs', 'readwrite');
      tx.objectStore('thumbs').put(blob, key);
    } catch { /* 忽略 */ }
  },

  async stats() {
    if (!this.ready) return { count: 0, bytes: 0 };
    return new Promise((resolve) => {
      try {
        const rq = this.db.transaction('thumbs', 'readonly').objectStore('thumbs').getAll();
        rq.onsuccess = () => {
          const all = rq.result || [];
          resolve({ count: all.length, bytes: all.reduce((a, b) => a + (b.size || 0), 0) });
        };
        rq.onerror = () => resolve({ count: 0, bytes: 0 });
      } catch { resolve({ count: 0, bytes: 0 }); }
    });
  },

  async clear() {
    this.mem.clear();
    if (!this.ready) return;
    await new Promise((resolve) => {
      try {
        const tx = this.db.transaction('thumbs', 'readwrite');
        tx.objectStore('thumbs').clear();
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      } catch { resolve(); }
    });
  },
};

/** 画布生成缩略图 */
async function makeThumbBlob(url, maxSide) {
  const img = new Image();
  img.decoding = 'async';
  await new Promise((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('decode fail'));
    img.src = url;
  });
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (!iw || !ih) throw new Error('empty');
  const scale = Math.min(1, (maxSide || TUNING.thumbGrid) / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.getContext('2d').drawImage(img, 0, 0, w, h);
  const blob = await new Promise((res) => cv.toBlob(res, 'image/webp', 0.82));
  if (!blob) throw new Error('toBlob fail');
  return blob;
}

/** 限制并发的任务队列 */
class Queue {
  constructor(limit) { this.limit = limit; this.running = 0; this.q = []; }
  push(fn) {
    return new Promise((resolve, reject) => {
      this.q.push({ fn, resolve, reject });
      this.drain();
    });
  }
  drain() {
    while (this.running < this.limit && this.q.length) {
      const t = this.q.shift();
      this.running++;
      t.fn().then(t.resolve, t.reject).finally(() => { this.running--; this.drain(); });
    }
  }
}
const thumbQueue = new Queue(3);

let liveUrls = [];
function revokeUrls() {
  liveUrls.forEach((u) => { try { URL.revokeObjectURL(u); } catch { } });
  liveUrls = [];
}

/* ===================== 懒加载观察器 ===================== */

const lazyObs = new IntersectionObserver((list) => {
  for (const item of list) {
    if (!item.isIntersecting) continue;
    lazyObs.unobserve(item.target);
    const fn = item.target.__lazy;
    if (fn) { item.target.__lazy = null; fn(); }
  }
}, { root: null, rootMargin: '500px 0px' });

function observeLazy(el, fn) {
  el.__lazy = fn;
  lazyObs.observe(el);
}

/* ===================== 根目录 ===================== */

function renderRoots() {
  const box = $('#rootList');
  box.innerHTML = '';
  const roots = (S.cfg && S.cfg.roots) || [];
  if (!roots.length) {
    const hint = document.createElement('div');
    hint.className = 'add-root-hint';
    hint.textContent = '＋ 点这里添加要管理的文件夹';
    hint.onclick = openAddRootDialog;
    box.appendChild(hint);
    return;
  }
  for (const r of roots) {
    const el = document.createElement('div');
    el.className = 'root-item' + (r.id === S.rootId ? ' active' : '') + (r.exists ? '' : ' missing');
    el.title = r.path + (r.exists ? '' : '\n（该文件夹当前不存在）');
    el.innerHTML = `<span class="ri-icon">${r.exists ? '📁' : '⚠️'}</span>
                    <span class="ri-name">${esc(r.name)}</span>
                    <button class="ri-del" title="从列表移除（不会删除文件）">×</button>`;
    el.onclick = (ev) => {
      if (ev.target.classList.contains('ri-del')) return;
      selectRoot(r.id);
    };
    el.querySelector('.ri-del').onclick = async (ev) => {
      ev.stopPropagation();
      if (!confirm(`从列表移除「${r.name}」？\n\n只会从左侧列表移除，磁盘上的文件不会被删除。`)) return;
      await api('/api/roots/' + encodeURIComponent(r.id), { method: 'DELETE' });
      if (S.rootId === r.id) S.rootId = null;
      await reloadConfig();
      toast('已移除', 'ok');
    };
    box.appendChild(el);
  }
}

async function reloadConfig() {
  S.cfg = await api('/api/config');
  // 阈值以服务端为准（单一数据源）；接口没给就沿用本地兜底值
  const L = S.cfg.limits;
  if (L) {
    if (L.pageDefault) { TUNING.pageLimit = L.pageDefault; S.pageLimit = L.pageDefault; }
    if (L.searchDefault) TUNING.searchLimit = L.searchDefault;
  }
  $('#appTitle').textContent = S.cfg.title || '漫剧素材';
  document.title = S.cfg.title || '漫剧素材管理';
  renderRoots();
  if (!S.rootId && S.cfg.roots.length) S.rootId = S.cfg.roots[0].id;
  if (S.rootId && !S.cfg.roots.some((r) => r.id === S.rootId)) S.rootId = S.cfg.roots[0] ? S.cfg.roots[0].id : null;
}

async function selectRoot(id) {
  S.rootId = id;
  S.path = '';
  S.mode = 'files';
  S.searchResults = null;
  S.selectAll = false;
  S.sel.clear();
  renderRoots();
  buildTree();
  await loadDir('');
}

/* ===================== 目录树 ===================== */

async function buildTree() {
  const box = $('#tree');
  box.innerHTML = '';
  if (!S.rootId) {
    box.innerHTML = '<div style="padding:10px 12px;color:var(--text-faint);font-size:12px">请先添加文件夹</div>';
    return;
  }
  const rootEl = document.createElement('div');
  rootEl.className = 'tree-node';
  rootEl.dataset.path = '';
  rootEl.dataset.open = '0';
  rootEl.dataset.name = '根目录';
  rootEl.dataset.kind = 'folder';
  rootEl.innerHTML = `<div class="tree-row" data-path="">
      <span class="tw">▶</span><span class="ticon">🏠</span><span class="tname">根目录</span>
      <button class="tnew" title="在根目录新建文件夹">＋</button>
    </div><div class="tree-children" style="display:none"></div>`;
  box.appendChild(rootEl);
  bindTreeRow(rootEl.querySelector('.tree-row'));
  await expandNode(rootEl);
}

function bindTreeRow(row) {
  const p = row.dataset.path;

  row.onclick = (ev) => {
    if (ev.target.closest('.tnew, .tvirtual')) return;
    navigateTo(p);
  };

  // 🗂：虚拟新建（归类）
  const vbtn = row.querySelector('.tvirtual');
  if (vbtn) vbtn.onclick = (ev) => { ev.stopPropagation(); openNewVGroupDialog(); };

  // 三角：只负责展开/收起，不触发导航；虚拟节点没有下级
  const tw = row.querySelector('.tw');
  if (tw) tw.onclick = (ev) => {
    ev.stopPropagation();
    if (!isVirtualPath(p)) toggleNode(row.parentElement);
  };

  // ＋ ：新建「真实文件夹」（与 🗂 是不同的类，不会再互相覆盖）
  const btn = row.querySelector('.tnew');
  if (btn) btn.onclick = async (ev) => {
    ev.stopPropagation();
    const target = realPath(p);
    const name = prompt(target === '' ? '在根目录新建真实文件夹，名称：' : '新建文件夹名称：');
    if (!name) return;
    try {
      await apiPost('/api/mkdir', { root: S.rootId, path: target, name });
      toast('已创建文件夹：' + name, 'ok');
      await refresh();
      await reloadTreeNode(target);
    } catch (e) { toast(e.message, 'err'); }
  };

  // 拖拽到树节点 = 移动文件
  row.addEventListener('dragover', (ev) => {
    if (S.dragPaths && S.dragPaths.length) { ev.preventDefault(); row.classList.add('drop-target'); }
  });
  row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
  row.addEventListener('drop', async (ev) => {
    row.classList.remove('drop-target');
    if (!S.dragPaths || !S.dragPaths.length) return;
    ev.preventDefault();
    ev.stopPropagation();
    const paths = S.dragPaths.slice();
    S.dragPaths = null;
    if (isVGroup(p)) await assignToGroup(vgIdOf(p), paths);       // 拖到虚拟分类 = 归类（不动文件）
    else if (isLoose(p)) await unassignFiles(paths);              // 拖回散-未归类 = 取消归类
    else await moveItems(paths, p);                               // 拖到真实文件夹 = 真实移动
  });

  // 右键菜单（真实文件夹 / 虚拟分类 / 散-未归类 / 根目录）
  row.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const node = row.parentElement;
    showTreeCtxMenu(ev.clientX, ev.clientY, {
      path: node.dataset.path || '',
      name: node.dataset.name || '根目录',
      kind: node.dataset.kind || 'folder',
      id: node.dataset.id || '',
    });
  });
}

/** 展开一个节点（已加载过就只切换显示，不重复请求） */
async function openNode(node) {
  if (!node) return;
  const children = node.querySelector('.tree-children');
  const tw = node.querySelector('.tw');
  node.dataset.open = '1';
  children.style.display = '';
  if (tw) tw.classList.add('open');
  if (!node.dataset.loaded) await expandNode(node);
}

/** 收起一个节点 */
function closeNode(node) {
  if (!node) return;
  const children = node.querySelector('.tree-children');
  const tw = node.querySelector('.tw');
  node.dataset.open = '0';
  children.style.display = 'none';
  if (tw) tw.classList.remove('open');
}

async function toggleNode(node) {
  if (!node) return;
  if (node.dataset.open === '1') closeNode(node);
  else await openNode(node);
}

/**
 * 加载并渲染一个节点的子目录。
 * 三角是否显示完全取决于后端返回的 hasChildren —— 没有下级的目录一开始就没有三角，
 * 而不是等用户点开才发现是空的。
 */
async function expandNode(node) {
  if (!node) return;
  const row = node.querySelector('.tree-row');
  const children = node.querySelector('.tree-children');
  const tw = row ? row.querySelector('.tw') : null;
  const p = row ? row.dataset.path : '';

  node.dataset.open = '1';
  children.style.display = '';

  // 虚拟节点没有下级，不用去问后端
  if (isVirtualPath(p)) {
    node.dataset.loaded = '1';
    if (tw) { tw.classList.add('leaf'); tw.classList.remove('open'); }
    return;
  }
  if (tw) tw.classList.add('open');

  let dirs = [];
  try {
    const r = await api(`/api/tree?root=${encodeURIComponent(S.rootId)}&path=${encodeURIComponent(p)}`);
    dirs = r.dirs || [];
  } catch { dirs = []; }

  node.dataset.loaded = '1';
  children.innerHTML = '';

  // 根目录下额外挂上虚拟节点：虚拟分类（归类用）+ 散-未归类
  const items = [];
  if (p === '') {
    await loadVGroups();
    for (const g of S.vgroups) {
      items.push({ virtual: true, vgroup: true, id: g.id, name: g.name, path: VG_PREFIX + g.id, count: g.files.length });
    }
    if (S.looseCount > 0) {
      items.push({ virtual: true, loose: true, name: LOOSE_NAME, path: LOOSE, count: S.looseCount });
    }
  }
  items.push(...dirs);

  if (tw) tw.classList.toggle('leaf', items.length === 0);
  if (!items.length) return;

  for (const d of items) {
    const child = document.createElement('div');
    child.className = 'tree-node' + (d.virtual ? ' virtual' : '');
    child.dataset.path = d.path;
    child.dataset.open = '0';
    child.dataset.name = d.name;
    child.dataset.kind = d.virtual ? (d.loose ? 'loose' : 'vgroup') : 'folder';
    if (d.id) child.dataset.id = d.id;
    const twHtml = d.virtual
      ? '<span class="tw leaf">▶</span>'
      : `<span class="tw${d.hasChildren ? '' : ' leaf'}">▶</span>`;
    const icon = d.virtual ? (d.loose ? '📦' : '🗂') : '📁';
    const label = d.virtual ? `${esc(d.name)}<span class="tcount">${d.count}</span>` : esc(d.name);
    // 虚拟节点给两个按钮：🗂 虚拟新建（归类，不动文件） / ＋ 新建真实文件夹
    const btns = d.virtual
      ? `<button class="tvirtual" title="虚拟新建：把选中的文件归类，不移动文件">🗂</button>
         <button class="tnew" title="在根目录新建真实文件夹">＋</button>`
      : `<button class="tnew" title="在此新建子文件夹">＋</button>`;
    child.innerHTML = `<div class="tree-row" data-path="${esc(d.path)}">
        ${twHtml}<span class="ticon">${icon}</span><span class="tname">${label}</span>${btns}
      </div><div class="tree-children" style="display:none"></div>`;
    children.appendChild(child);
    bindTreeRow(child.querySelector('.tree-row'));
  }
  markTreeActive();
}

function markTreeActive() {
  $$('#tree .tree-row').forEach((r) => r.classList.toggle('active', r.dataset.path === S.path && S.mode === 'files'));
}

/** 目录内容变了，重新加载对应的树节点（保持展开状态） */
async function reloadTreeNode(p) {
  const node = $('#tree .tree-node[data-path="' + CSS.escape(p || '') + '"]');
  if (!node) return;
  node.dataset.loaded = '';
  if (node.dataset.open === '1') await expandNode(node);
}

/** 逐级展开，让目标路径的节点在树里可见 */
async function ensureVisible(target) {
  const parts = String(target || '').split('/').filter(Boolean);
  let node = $('#tree .tree-node');
  if (!node) return;
  let cur = '';
  for (const part of parts) {
    await openNode(node);
    cur = cur ? cur + '/' + part : part;
    const children = node.querySelector('.tree-children');
    const found = Array.from(children.children).find((c) => c.dataset.path === cur);
    if (!found) return;
    node = found;
  }
}

/* ===================== 导航 / 加载 ===================== */

async function navigateTo(p) {
  S.mode = 'files';
  S.searchResults = null;
  S.path = p || '';
  S.selectAll = false;
  S.sel.clear();
  $('#searchInput').value = '';
  $('#btnClearSearch').classList.add('hidden');
  await loadDir(S.path);
  await ensureVisible(S.path);
  markTreeActive();
}

async function loadVGroups() {
  try {
    const r = await api(`/api/vgroups?root=${encodeURIComponent(S.rootId)}`);
    S.vgroups = r.groups || [];
    S.looseCount = r.looseCount || 0;
  } catch { S.vgroups = []; }
}

async function loadDir(p, append) {
  if (!S.rootId) { showEmpty('还没有添加文件夹', '点左上角 ＋ 添加你要管理的文件夹', '添加文件夹', openAddRootDialog); return; }
  const real = realPath(p);
  const view = isLoose(p) ? 'loose' : (isVGroup(p) ? 'vgroup' : '');
  const gid = isVGroup(p) ? vgIdOf(p) : '';
  const offset = append ? S.pageOffset : 0;

  if (!append) setStatus('加载中…');
  try {
    const url = `/api/list?root=${encodeURIComponent(S.rootId)}&path=${encodeURIComponent(real)}`
      + `&offset=${offset}&limit=${S.pageLimit}`
      + `&sort=${encodeURIComponent(S.sort)}&filter=${encodeURIComponent(S.filter)}`
      + `&view=${view}&gid=${encodeURIComponent(gid)}`;
    const r = await api(url);

    // 条目的 path 始终是「真实路径」，重命名/删除/移动直接用它
    const files = (r.files || []).map((e) => Object.assign(e, { path: joinPath(real, e.name) }));
    const folders = (r.folders || []).map((e) => Object.assign(e, { path: joinPath(real, e.name) }));

    if (append) {
      S.entries = S.entries.concat(files);
    } else {
      S.entries = folders.concat(files);
      if (typeof r.looseCount === 'number') S.looseCount = r.looseCount;
      if (r.vgroups) S.vgroups = r.vgroups;
      else if (real === '') await loadVGroups();
    }
    S.pageOffset = offset + files.length;
    S.hasMore = !!r.hasMore;
    S.totalFiles = r.total || 0;

    renderBreadcrumb();
    renderContent(append);

    const n = S.totalFiles;
    if (append) setStatus(`已加载 ${Math.min(S.pageOffset, n)} / ${n} 个文件`);
    else setStatus(isLoose(p) ? `${n} 个待归类文件`
      : isVGroup(p) ? `${n} 个文件 · 虚拟分类`
        : `${n} 个文件${folders.length ? ' · ' + folders.length + ' 个文件夹' : ''}`);
  } catch (e) {
    toast(e.message, 'err');
    if (!append) showEmpty('打不开这个文件夹', e.message, null, null);
  }
}

/** 排序 / 筛选变化后回到第一页重新拉 */
function reloadCurrent() {
  S.pageOffset = 0;
  S.hasMore = false;
  S.loadingMore = false;
  S.searchResults = null;
  S.selectAll = false;
  S.sel.clear();
  const kw = $('#searchInput').value.trim();
  if (kw) doSearch(kw);
  else loadDir(S.path);
}

/** 滚到底自动加载下一页 */
async function loadMore() {
  if (S.loadingMore || !S.hasMore) return;
  S.loadingMore = true;
  try {
    const kw = $('#searchInput').value.trim();
    if (kw) await doSearch(kw, true);
    else await loadDir(S.path, true);
  } catch { /* 已经 toast 过 */ }
  finally { S.loadingMore = false; }
}

async function refresh() {
  if (S.mode === 'trash') return openTrash();
  S.pageOffset = 0;
  S.hasMore = false;
  if (S.searchResults) return doSearch($('#searchInput').value);
  await loadDir(S.path);
}

function setStatus(t) { $('#statLeft').textContent = t; }

function renderBreadcrumb() {
  const nav = $('#breadcrumb');
  nav.innerHTML = '';
  const root = S.cfg.roots.find((r) => r.id === S.rootId);
  const add = (label, path, isLast) => {
    if (nav.children.length) {
      const s = document.createElement('span');
      s.className = 'sep'; s.textContent = '›';
      nav.appendChild(s);
    }
    const b = document.createElement('span');
    b.className = 'crumb';
    b.textContent = label;
    b.title = path;
    b.onclick = () => navigateTo(path);
    nav.appendChild(b);
  };
  add('🏠 ' + (root ? root.name : '根目录'), '');
  if (isLoose(S.path)) {
    add('📦 ' + LOOSE_NAME, LOOSE);
  } else if (isVGroup(S.path)) {
    const g = S.vgroups.find((x) => x.id === vgIdOf(S.path));
    add('🗂 ' + (g ? g.name : '虚拟分类'), S.path);
  } else {
    const parts = String(S.path || '').split('/').filter(Boolean);
    let acc = '';
    parts.forEach((part) => { acc = acc ? acc + '/' + part : part; add(part, acc); });
  }
  if (S.mode === 'trash') add('🗑 回收站', '');
}

/* ===================== 内容渲染 ===================== */

function showEmpty(title, sub, btnText, btnFn) {
  const box = $('#empty');
  box.classList.remove('hidden');
  $('#grid').classList.add('hidden');
  $('#listWrap').classList.add('hidden');
  box.innerHTML = `<div class="big">📂</div><div>${esc(title)}</div>
    ${sub ? `<div style="font-size:12px;max-width:520px">${esc(sub)}</div>` : ''}`;
  if (btnText) {
    const b = document.createElement('button');
    b.textContent = btnText;
    b.onclick = btnFn;
    box.appendChild(b);
  }
}

function sorted(list) {
  const [key, dir] = S.sort.split('-');
  const mul = dir === 'asc' ? 1 : -1;
  return list.slice().sort((a, b) => {
    if (a.virtual !== b.virtual) return a.virtual ? -1 : 1;   // 虚拟节点永远排最前
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;         // 文件夹永远在文件前
    let r = 0;
    if (key === 'name') r = a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true });
    else if (key === 'mtime') r = (a.mtime || 0) - (b.mtime || 0);
    else if (key === 'size') r = (a.size || 0) - (b.size || 0);
    return r * mul;
  });
}

/** 只看图片 / 只看视频时，文件夹和虚拟节点一并隐藏 —— 它们不是你要看的东西 */
function filtered(list) {
  if (S.filter === 'all') return list;
  return list.filter((e) => !e.isDir && e.kind === S.filter);
}

/** 根目录视图里要额外插入的虚拟节点：虚拟分类 + 散-未归类 */
function injectedNodes() {
  if (S.mode !== 'files' || S.searchResults || S.path !== '') return [];
  const out = [];
  for (const g of S.vgroups) {
    out.push({
      virtual: true, isDir: true, vgroup: true, id: g.id,
      name: g.name, path: VG_PREFIX + g.id, count: g.files.length,
    });
  }
  if (S.looseCount > 0) {
    out.push({ virtual: true, isDir: true, loose: true, name: LOOSE_NAME, path: LOOSE, count: S.looseCount });
  }
  return out;
}

function renderContent(append) {
  if (S.mode === 'trash') return renderTrash();
  invalidateVisible();          // 数据变了，缓存作废
  const list = visibleEntries(); // 排序+筛选+注入虚拟节点，只算这一次

  $('#empty').classList.add('hidden');
  if (!append) revokeUrls();

  if (!list.length) {
    if (append) return;
    let msg, sub;
    if (S.searchResults) { msg = '没有找到匹配的文件'; sub = '试试别的关键词'; }
    else if (S.filter !== 'all') { msg = '这个筛选条件下没有文件'; sub = '文件夹在筛选时会被隐藏，切回「全部」就能看到'; }
    else if (isLoose(S.path)) { msg = '散-未归类是空的'; sub = '这里的文件都已经被归类了'; }
    else if (isVGroup(S.path)) { msg = '这个虚拟分类里还没有文件'; sub = '回「散-未归类」选中文件，点【虚拟新建】归类进来'; }
    else if (S.path === '') { msg = '这个目录下没有文件夹'; sub = '根目录只显示文件夹，散文件都收在「散-未归类」里'; }
    else { msg = '这个文件夹是空的'; sub = '把文件拖进窗口即可上传到这里'; }
    showEmpty(msg, sub, null, null);
    return;
  }

  if (S.view === 'list') {
    $('#grid').classList.add('hidden');
    $('#listWrap').classList.remove('hidden');
    renderList(list, append);
  } else {
    $('#listWrap').classList.add('hidden');
    $('#grid').classList.remove('hidden');
    $('#grid').className = 'grid' + (S.view === 'large' ? ' large' : '');
    renderGrid(list, append);
  }
  updateSelectionStatus();
}

/** append=true 时只追加还没渲染过的条目，不重建已有 DOM */
function appendTarget(container, list, append) {
  if (!append) return list;
  const existing = new Set(Array.from(container.children).map((el) => el.dataset.path));
  return list.filter((e) => !existing.has(e.path));
}

function renderGrid(list, append) {
  const grid = $('#grid');
  const target = appendTarget(grid, list, append);
  if (!target.length) return;
  if (!append) grid.innerHTML = '';
  const frag = document.createDocumentFragment();

  for (const e of target) {
    const card = document.createElement('div');
    card.className = 'card' + (e.isDir ? ' folder' : '') + (isSelected(e.path) ? ' selected' : '');
    card.dataset.path = e.path;

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    card.appendChild(thumb);

    const meta = document.createElement('div');
    meta.className = 'meta';
    if (e.virtual) {
      card.classList.add('virtual');
      thumb.innerHTML = `<div class="ph">${e.vgroup ? '🗂' : '📦'}</div>`;
      meta.innerHTML = `<div class="fname" title="${esc(e.name)}">${e.vgroup ? '🗂' : '📦'} ${esc(e.name)}</div>
        <div class="fsub"><span>${e.count} 个文件</span><span>${e.vgroup ? '虚拟分类' : '待归类'}</span></div>`;
    } else {
      meta.innerHTML = `<div class="fname" title="${esc(e.name)}">${esc(e.name)}</div>
        <div class="fsub"><span>${e.isDir ? '文件夹' : fmtSize(e.size)}</span><span>${fmtTime(e.mtime)}</span></div>`;
      fillThumb(thumb, e, card, TUNING.thumbGrid);
    }
    card.appendChild(meta);
    frag.appendChild(card);
  }
  grid.appendChild(frag);
}

function renderList(list, append) {
  const wrap = $('#listWrap');
  const target = appendTarget(wrap, list, append);
  if (!target.length) return;
  if (!append) {
    wrap.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'lrow head';
    head.innerHTML = `<div></div><div>名称</div><div>大小</div><div>类型</div><div>修改时间</div>`;
    wrap.appendChild(head);
  }

  const frag = document.createDocumentFragment();
  for (const e of target) {
    const row = document.createElement('div');
    row.className = 'lrow' + (isSelected(e.path) ? ' selected' : '');
    row.dataset.path = e.path;
    const icon = e.virtual ? (e.vgroup ? '🗂' : '📦')
      : e.isDir ? '📁'
        : (e.kind === 'image' ? '🖼' : e.kind === 'video' ? '🎬' : e.kind === 'audio' ? '🎵' : '📄');
    if (e.virtual) row.classList.add('virtual');
    row.innerHTML = `<div class="lth">${icon}</div>
      <div class="lname" title="${esc(e.name)}">${esc(e.name)}</div>
      <div>${e.virtual ? e.count + ' 个' : e.isDir ? '—' : fmtSize(e.size)}</div>
      <div>${e.virtual ? (e.vgroup ? '虚拟分类' : '待归类') : e.isDir ? '文件夹' : (e.ext || '').replace('.', '').toUpperCase()}</div>
      <div>${fmtTime(e.mtime)}</div>`;
    const th = row.querySelector('.lth');
    if (!e.isDir && e.kind === 'image') fillThumb(th, e, row, TUNING.thumbList, true);
    frag.appendChild(row);
  }
  wrap.appendChild(frag);
}

/** 填充缩略图（图片 / 视频首帧） */
function fillThumb(container, e, card, maxSide, small) {
  if (e.isDir) {
    container.innerHTML = '<div class="ph">📁</div>';
    return;
  }
  if (e.kind === 'image' && e.ext !== '.svg' && e.ext !== '.gif') {
    container.innerHTML = '<div class="spinner"></div>';
    observeLazy(card, async () => {
      const key = Thumb.key(S.rootId, e.path, e.mtime, e.size);
      try {
        let blob = await Thumb.get(key);
        if (!blob) {
          const raw = fileUrl(S.rootId, e.path);
          const img = new Image();
          img.decoding = 'async';
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = raw; });
          const iw = img.naturalWidth, ih = img.naturalHeight;
          if (!iw || !ih) throw new Error('decode');
          const scale = Math.min(1, maxSide / Math.max(iw, ih));
          const w = Math.max(1, Math.round(iw * scale)), h = Math.max(1, Math.round(ih * scale));
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          blob = await new Promise((res) => cv.toBlob(res, 'image/webp', 0.82));
          if (blob) thumbQueue.push(() => Thumb.put(key, blob));
        }
        if (!blob) throw new Error('no blob');
        const url = URL.createObjectURL(blob);
        liveUrls.push(url);
        container.innerHTML = '';
        const im = document.createElement('img');
        im.src = url;
        im.loading = 'lazy';
        im.alt = e.name;
        container.appendChild(im);
      } catch {
        container.innerHTML = '';
        const im = document.createElement('img');
        im.src = fileUrl(S.rootId, e.path);
        im.loading = 'lazy';
        im.alt = e.name;
        container.appendChild(im);
      }
    });
    return;
  }

  if (e.kind === 'image') { // svg / gif 直接用原图
    container.innerHTML = `<img src="${esc(fileUrl(S.rootId, e.path))}" loading="lazy" alt="">`;
    return;
  }

  if (e.kind === 'video' || e.kind === 'audio') {
    container.innerHTML = `<div class="play-ic">${e.kind === 'video' ? '▶' : '🎵'}</div>`;
    const badge = document.createElement('div');
    badge.className = 'dur';
    badge.textContent = '';
    container.appendChild(badge);

    observeLazy(card, () => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.playsInline = true;
      v.src = fileUrl(S.rootId, e.path) + '#t=0.1';
      v.addEventListener('loadedmetadata', () => {
        badge.textContent = fmtDur(v.duration);
        try { v.currentTime = Math.min(0.1, (v.duration || 1) / 2); } catch { }
      });
      v.addEventListener('loadeddata', () => {
        if (v.parentElement) v.parentElement.classList.add('has-frame');
      });
      card.addEventListener('mouseenter', () => {
        if (!small) { v.currentTime = 0; v.play().catch(() => { }); }
      });
      card.addEventListener('mouseleave', () => {
        if (!small) { v.pause(); try { v.currentTime = 0.1; } catch { } }
      });
      container.insertBefore(v, container.firstChild);
    });
    return;
  }

  const icons = { image: '🖼', video: '🎬', audio: '🎵', text: '📄', other: '📄' };
  container.innerHTML = `<div class="ph">${icons[e.kind] || '📄'}</div>`;
}

/* ===================== 回收站 ===================== */

async function openTrash() {
  if (!S.rootId) return toast('请先添加文件夹', 'warn');
  S.mode = 'trash';
  S.sel.clear();
  try {
    const r = await api(`/api/trash?root=${encodeURIComponent(S.rootId)}`);
    S.trash = r.items;
  } catch (e) { return toast(e.message, 'err'); }
  renderBreadcrumb();
  renderTrash();
}

function renderTrash() {
  invalidateVisible();   // 回收站数据变了，缓存作废
  revokeUrls();
  $('#listWrap').classList.add('hidden');
  const grid = $('#grid');
  grid.classList.remove('hidden');
  grid.className = 'grid';
  grid.innerHTML = '';

  if (!S.trash.length) {
    return showEmpty('回收站是空的', '删除的文件会先到这里，可以随时恢复', null, null);
  }
  $('#empty').classList.add('hidden');

  const bar = document.createElement('div');
  bar.style.cssText = 'grid-column:1/-1;display:flex;gap:8px;align-items:center;padding:4px 2px 10px';
  bar.innerHTML = `<span style="color:var(--text-dim);font-size:12.5px">共 ${S.trash.length} 项</span>
    <span class="spacer"></span>`;
  const btnRestore = document.createElement('button');
  btnRestore.className = 'btn';
  btnRestore.textContent = '恢复选中';
  btnRestore.onclick = () => trashRestore(Array.from(S.sel));
  const btnPurge = document.createElement('button');
  btnPurge.className = 'btn danger';
  btnPurge.textContent = '彻底删除选中';
  btnPurge.onclick = () => trashPurge(Array.from(S.sel));
  const btnEmpty = document.createElement('button');
  btnEmpty.className = 'btn danger';
  btnEmpty.textContent = '清空回收站';
  btnEmpty.onclick = async () => {
    if (!confirm('彻底删除回收站里的全部文件？此操作不可撤销。')) return;
    await apiPost('/api/trash/purge', { root: S.rootId });
    toast('回收站已清空', 'ok');
    openTrash();
  };
  bar.appendChild(btnRestore); bar.appendChild(btnPurge); bar.appendChild(btnEmpty);
  grid.appendChild(bar);

  for (const it of S.trash) {
    const card = document.createElement('div');
    card.className = 'card' + (S.sel.has(it.id) ? ' selected' : '');
    card.dataset.path = it.id;
    card.dataset.trashId = it.id;
    card.innerHTML = `<div class="thumb"><div class="ph">${it.isDir ? '📁' : '📄'}</div></div>
      <div class="meta">
        <div class="fname" title="${esc(it.name)}">${esc(it.name)}</div>
        <div class="fsub"><span>${it.isDir ? '文件夹' : fmtSize(it.size)}</span><span>${fmtTime(new Date(it.deletedAt).getTime())}</span></div>
        <div class="fsub" style="opacity:.7" title="${esc(it.originalPath)}">原位置：${esc(parentOf(it.originalPath) || '根目录')}</div>
      </div>`;
    grid.appendChild(card);
  }
  setStatus(`回收站：${S.trash.length} 项`);
  updateSelectionStatus();
}

async function trashRestore(ids) {
  if (!ids.length) return toast('请先选择要恢复的文件', 'warn');
  const r = await apiPost('/api/trash/restore', { root: S.rootId, ids });
  const ok = r.results.filter((x) => x.ok).length;
  Log.add('♻', `从回收站恢复 ${ok} 项`,
    (r.results || []).filter((x) => x.ok).map((x) => '  · ' + x.path).join('\n'));
  toast(`已恢复 ${ok} 项`, ok ? 'ok' : 'err');
  S.sel.clear();
  openTrash();
}

async function trashPurge(ids) {
  if (!ids.length) return toast('请先选择要删除的文件', 'warn');
  if (!confirm(`彻底删除选中的 ${ids.length} 项？此操作不可撤销。`)) return;
  await apiPost('/api/trash/purge', { root: S.rootId, ids });
  Log.add('🔥', `从回收站彻底删除 ${ids.length} 项（不可恢复）`);
  toast('已彻底删除', 'ok');
  S.sel.clear();
  openTrash();
}

/* ===================== 选择 ===================== */

/**
 * 当前屏幕上这一屏的条目（顺序 = 渲染顺序）。
 * 结果缓存到下次 renderContent —— 原来被 8 处调用，每次都重排整张表。
 */
let visibleCache = null;

function visibleEntries() {
  if (visibleCache) return visibleCache;
  visibleCache = S.mode === 'trash'
    ? S.trash.map((t) => ({ path: t.id, isDir: t.isDir, name: t.name }))
    : sorted(filtered((S.searchResults || S.entries).concat(injectedNodes())));
  return visibleCache;
}

/** 数据变了就作废缓存（renderContent 开头会调） */
function invalidateVisible() { visibleCache = null; }

function updateSelectionStatus() {
  const n = S.selectAll ? S.totalFiles : S.sel.size;
  $('#statSel').textContent = n
    ? (S.selectAll ? `已选全部 ${n} 项（含未加载）` : `已选 ${n} 项`)
    : '';
  $('#statSel').classList.toggle('all', !!S.selectAll);

  // 底部快捷操作条：复制到剪贴板 / 虚拟新建（归类）/ 移出归类
  const act = $('#statActions');
  act.innerHTML = '';
  if (S.mode === 'files') {
    // 只要有选中就出现 —— 「复制到剪贴板」是最常用的一个，放最前面
    if (n) {
      const c = document.createElement('button');
      c.className = 'btn mini primary';
      c.style.fontWeight = '700';
      c.textContent = `📋 点这里复制到剪贴板（${n} 个）`;
      c.title = '放进系统剪贴板，之后在桌面端豆包或任何程序里按 Ctrl+V';
      c.onclick = () => copyToClipboard();
      act.appendChild(c);
    }
    if (S.path === '' || isLoose(S.path)) {
      const b = document.createElement('button');
      b.className = 'btn mini';
      b.textContent = n ? `🗂 虚拟新建（归类 ${n} 个）` : '🗂 虚拟新建';
      b.title = '只记录文件名引用，不移动文件，也不会在硬盘上建文件夹';
      b.onclick = openNewVGroupDialog;
      act.appendChild(b);
    }
    if (isVGroup(S.path)) {
      const grp = S.vgroups.find((x) => x.id === vgIdOf(S.path));
      if (grp && (grp.files || []).length) {
        const m = document.createElement('button');
        m.className = 'btn mini primary';
        m.textContent = '📦 转为实体文件夹';
        m.title = '把这个虚拟分类变成硬盘上真实的文件夹，可选平移或复制';
        m.onclick = () => openMaterializeDialog(grp);
        act.appendChild(m);
      }
      if (n) {
        const b = document.createElement('button');
        b.className = 'btn mini';
        b.textContent = '移出归类';
        b.onclick = () => unassignFiles(Array.from(S.sel));
        act.appendChild(b);
      }
    }
  }

  $$('#grid .card, #listWrap .lrow').forEach((el) => {
    el.classList.toggle('selected', isSelected(el.dataset.path));
  });
}

function clickSelect(e, entry, idx, ev) {
  S.selectAll = false;              // 一旦手动点选，就退出「全选整个目录」
  const list = visibleEntries();
  const paths = list.map((x) => x.path);
  if (ev.shiftKey && S.lastIdx >= 0) {
    const [a, b] = [Math.min(S.lastIdx, idx), Math.max(S.lastIdx, idx)];
    S.sel.clear();
    for (let i = a; i <= b; i++) S.sel.add(paths[i]);
  } else if (ev.ctrlKey || ev.metaKey) {
    if (S.sel.has(entry.path)) S.sel.delete(entry.path); else S.sel.add(entry.path);
    S.lastIdx = idx;
  } else {
    S.sel.clear();
    S.sel.add(entry.path);
    S.lastIdx = idx;
  }
  updateSelectionStatus();
}

/* ===================== 打开 / 灯箱 ===================== */

function previewable(list) {
  return list.filter((e) => !e.isDir && (e.kind === 'image' || e.kind === 'video' || e.kind === 'audio' || e.kind === 'text'));
}

async function openEntry(entry) {
  if (entry.virtual || entry.isDir) return navigateTo(entry.path);
  const list = previewable(sorted(filtered(S.searchResults || S.entries)));
  const i = list.findIndex((x) => x.path === entry.path);
  if (i >= 0) return openLightbox(list, i);
  if (entry.kind === 'text') return openTextEditor(entry);
  window.open(fileUrl(S.rootId, entry.path, true), '_blank');
}

function openLightbox(list, idx) {
  S.lbList = list;
  S.lbIdx = idx;
  $('#lightbox').classList.remove('hidden');
  renderLightbox();
}

function closeLightbox() {
  $('#lightbox').classList.add('hidden');
  $('#lbStage').innerHTML = '';
  S.lbIdx = -1;
}

function renderLightbox() {
  const e = S.lbList[S.lbIdx];
  if (!e) return closeLightbox();
  $('#lbName').textContent = e.name;
  $('#lbInfo').textContent = `${fmtSize(e.size)} · ${fmtTime(e.mtime)} · ${S.lbIdx + 1}/${S.lbList.length}`;
  $('#lbDownload').onclick = () => { location.href = fileUrl(S.rootId, e.path, true); };

  const stage = $('#lbStage');
  stage.innerHTML = '';
  if (e.kind === 'video' || e.kind === 'audio') {
    const v = document.createElement('video');
    v.src = fileUrl(S.rootId, e.path);
    v.controls = true;
    v.autoplay = true;
    v.playsInline = true;
    stage.appendChild(v);
  } else if (e.kind === 'image') {
    const im = document.createElement('img');
    im.src = fileUrl(S.rootId, e.path);
    stage.appendChild(im);
  } else if (e.kind === 'text') {
    const pre = document.createElement('pre');
    pre.className = 'txtview';
    pre.textContent = '加载中…';
    stage.appendChild(pre);
    api(`/api/text?root=${encodeURIComponent(S.rootId)}&path=${encodeURIComponent(e.path)}`)
      .then((r) => { pre.textContent = r.content; })
      .catch((err) => { pre.textContent = '无法预览：' + err.message; });
  }
  $('#lbPrev').style.visibility = S.lbIdx > 0 ? 'visible' : 'hidden';
  $('#lbNext').style.visibility = S.lbIdx < S.lbList.length - 1 ? 'visible' : 'hidden';
  renderStrip();
}

function renderStrip() {
  const strip = $('#lbStrip');
  strip.innerHTML = '';
  S.lbList.forEach((e, i) => {
    if (e.kind === 'image' && e.ext !== '.svg') {
      const im = document.createElement('img');
      const key = Thumb.key(S.rootId, e.path, e.mtime, e.size);
      Thumb.get(key).then((blob) => {
        if (blob) { im.src = URL.createObjectURL(blob); liveUrls.push(im.src); }
        else im.src = fileUrl(S.rootId, e.path);
      });
      im.className = i === S.lbIdx ? 'active' : '';
      im.onclick = () => { S.lbIdx = i; renderLightbox(); };
      strip.appendChild(im);
    } else {
      const ph = document.createElement('div');
      ph.className = 'sph';
      ph.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:18px;opacity:' + (i === S.lbIdx ? 1 : .5);
      ph.textContent = e.kind === 'video' ? '🎬' : e.kind === 'audio' ? '🎵' : '📄';
      ph.style.border = i === S.lbIdx ? '2px solid var(--accent)' : '2px solid transparent';
      ph.onclick = () => { S.lbIdx = i; renderLightbox(); };
      strip.appendChild(ph);
    }
  });
  const active = strip.children[S.lbIdx];
  if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function lbStep(d) {
  const i = S.lbIdx + d;
  if (i < 0 || i >= S.lbList.length) return;
  S.lbIdx = i;
  renderLightbox();
}

/* ===================== 文件操作 ===================== */

function selectedItems() {
  if (S.mode === 'trash') return Array.from(S.sel).map((id) => ({ trashId: id }));
  // 虚拟节点不是真实文件，绝不能当成路径发给后端
  return Array.from(S.sel).filter((p) => !isVirtualPath(p)).map((p) => ({ root: S.rootId, path: p }));
}

/** 某个条目是否处于「选中」状态（全选模式下，连还没加载出来的也算） */
function isSelected(p) {
  return S.selectAll || S.sel.has(p);
}

/** 当前视图范围 —— 交给后端自己算出「全部文件」，不受分页限制 */
function scopePayload() {
  return {
    root: S.rootId,
    path: realPath(S.path),
    view: isLoose(S.path) ? 'loose' : (isVGroup(S.path) ? 'vgroup' : ''),
    gid: isVGroup(S.path) ? vgIdOf(S.path) : '',
    filter: S.filter,
  };
}

/** 当前视图叫什么（写日志用） */
function viewLabel() {
  if (isLoose(S.path)) return LOOSE_NAME;
  if (isVGroup(S.path)) {
    const g = S.vgroups.find((x) => x.id === vgIdOf(S.path));
    return '虚拟分类「' + (g ? g.name : '?') + '」';
  }
  return '「' + (baseName(S.path) || '根目录') + '」';
}

/** 批量操作的请求体：全选时给 scope，否则给明确 items */
function selectionBody(extra) {
  const body = Object.assign({ root: S.rootId }, extra || {});
  if (S.selectAll) body.scope = scopePayload();
  else body.items = selectedItems();
  return body;
}

function clearSelectAll() { S.selectAll = false; }

async function deleteSelected() {
  const sel = Array.from(S.sel);
  const vpaths = sel.filter(isVirtualPath);
  const items = selectedItems();

  // 选中的是虚拟分类 —— 删分组，文件一个都不删
  if (vpaths.length && !items.length) {
    const groups = vpaths.filter(isVGroup)
      .map((p) => S.vgroups.find((g) => g.id === vgIdOf(p)))
      .filter(Boolean);
    if (!groups.length) {
      return toast('「散-未归类」是虚拟节点，不能删除。里面的文件请单独选中处理', 'warn');
    }
    const names = groups.map((g) => g.name).join('、');
    if (!confirm(`删除虚拟分类「${names}」？\n\n只解散分组，里面的文件一个都不会删，会退回到「散-未归类」。`)) return;
    for (const g of groups) await apiPost('/api/vgroups/delete', { root: S.rootId, id: g.id });
    Log.add('🗑', `删除虚拟分类「${names}」（文件一个都没删）`);
    toast('已删除虚拟分类，文件退回散-未归类', 'ok');
    S.sel.clear();
    if (isVGroup(S.path)) S.path = '';
    await refresh();
    await reloadTreeNode('');
    return;
  }

  if (vpaths.length && items.length) {
    return toast('虚拟分类和真实文件请分开删除', 'warn');
  }

  // 全选整个视图 —— 交给后端算全部，不受分页限制
  if (S.selectAll) {
    const n = S.totalFiles;
    if (!n) return;
    if (!confirm(`把 ${viewLabel()} 里的全部 ${n} 个文件移到回收站？\n\n（文件夹不会被删，只是里面的文件）\n可以随时从回收站恢复。`)) return;
    const r = await apiPost('/api/delete', { root: S.rootId, scope: scopePayload() });
    const ok = r.results.filter((x) => x.ok).length;
    Log.add('🗑', `删除全部 ${ok} 个文件到回收站`, '范围：' + viewLabel());
    toast(`已移到回收站：${ok} 项`, ok ? 'ok' : 'err');
    S.selectAll = false;
    S.sel.clear();
    await refresh();
    return;
  }

  if (!items.length) return;
  const names = items.slice(0, 3).map((i) => baseName(i.path)).join('、');
  if (!confirm(`把 ${items.length} 个文件移到回收站？\n\n${names}${items.length > 3 ? ' 等' : ''}\n\n（可以随时从回收站恢复）`)) return;
  const r = await apiPost('/api/delete', { items });
  const ok = r.results.filter((x) => x.ok).length;
  Log.add('🗑', `删除 ${ok} 项到回收站`, items.map((i) => '  · ' + baseName(i.path)).join('\n'));
  toast(`已移到回收站：${ok} 项`, ok ? 'ok' : 'err');
  S.sel.clear();
  await refresh();
}

async function renameEntry(entry) {
  const cur = baseName(entry.path);
  const name = prompt('重命名：', cur);
  if (!name || name === cur) return;
  try {
    await apiPost('/api/rename', { root: S.rootId, path: entry.path, newName: name });
    Log.add('✎', `重命名：${cur} → ${name}`);
    toast('已重命名', 'ok');
    S.sel.clear();
    await refresh();
    await reloadTreeNode(S.path);
  } catch (e) { toast(e.message, 'err'); }
}

function openBatchRename() {
  const useAll = S.selectAll;
  const items = useAll ? [] : Array.from(S.sel).filter((p) => !isVirtualPath(p));
  const count = useAll ? S.totalFiles : items.length;
  if (!count) return toast('请先选择文件', 'warn');
  const ext = items.length && !items[0].includes('.') ? '' : (items[0].match(/\.[^.\/]+$/) || [''])[0];
  showModal(`
    <h3>批量重命名</h3>
    <div class="modal-sub">${useAll ? `全选模式：当前视图全部 ${count} 个文件（含未加载）` : `共 ${count} 个文件`}，按当前顺序编号</div>
    <label>文件名前缀</label>
    <input type="text" id="brPrefix" placeholder="例如：域外恶魔_" value="">
    <label>起始序号</label>
    <input type="number" id="brStart" value="1" min="0">
    <label>序号位数</label>
    <input type="number" id="brPad" value="3" min="1" max="6">
    <label style="display:flex;align-items:center;gap:8px;margin-top:12px">
      <input type="checkbox" id="brKeepExt" checked style="width:auto"> 保留原扩展名
    </label>
    <div class="tpl-preview" id="brPreview"></div>
    <div class="modal-actions">
      <button class="btn" data-close>取消</button>
      <button class="btn primary" id="brOk">重命名</button>
    </div>
  `);
  const upd = () => {
    const prefix = $('#brPrefix').value;
    const start = parseInt($('#brStart').value, 10) || 1;
    const pad = Math.min(6, Math.max(1, parseInt($('#brPad').value, 10) || 3));
    const keep = $('#brKeepExt').checked;
    let lines;
    if (useAll) {
      lines = [
        `全选模式：按当前排序对 ${count} 个文件依次编号`,
        `  ${prefix}${String(start).padStart(pad, '0')}${ext}`,
        `  ${prefix}${String(start + 1).padStart(pad, '0')}${ext}`,
        `  ${prefix}${String(start + 2).padStart(pad, '0')}${ext}`,
        '  …',
      ];
    } else {
      lines = items.slice(0, 6).map((p, i) => {
        const old = baseName(p);
        const e = keep ? (old.match(/\.[^.\/]+$/) || [''])[0] : '';
        return `${old}  →  ${prefix}${String(start + i).padStart(pad, '0')}${e}`;
      });
      if (items.length > 6) lines.push(`… 其余 ${items.length - 6} 个依次编号`);
    }
    $('#brPreview').textContent = lines.join('\n');
  };
  $('#brPrefix').oninput = upd;
  $('#brStart').oninput = upd;
  $('#brPad').oninput = upd;
  $('#brKeepExt').onchange = upd;
  upd();
  $('#brOk').onclick = async () => {
    const payload = {
      root: S.rootId,
      prefix: $('#brPrefix').value,
      start: parseInt($('#brStart').value, 10) || 1,
      pad: parseInt($('#brPad').value, 10) || 3,
      keepExt: $('#brKeepExt').checked,
    };
    if (useAll) payload.scope = scopePayload();
    else payload.items = items;
    try {
      const r = await apiPost('/api/rename-batch', payload);
      const ok = r.results.filter((x) => x.ok).length;
      const bad = r.results.filter((x) => !x.ok);
      Log.add('✎', `批量重命名 ${ok} 个文件（前缀「${payload.prefix}」起 ${payload.start}）`,
        r.results.filter((x) => x.ok && x.to).map((x) => `  · ${x.from}  →  ${x.to}`).join('\n'));
      toast(`已重命名 ${ok} 个${bad.length ? `，${bad.length} 个失败` : ''}`, bad.length ? 'warn' : 'ok');
      closeModal();
      S.sel.clear();
      await refresh();
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ===================== 虚拟分类（归类，不动文件） ===================== */

/** 把文件归入某个虚拟分类 —— 只写引用，文件本体不动 */
async function assignToGroup(groupId, paths) {
  const files = paths.map((p) => baseName(p));
  if (!files.length) return;
  try {
    await apiPost('/api/vgroups/assign', { root: S.rootId, id: groupId, files, mode: 'add' });
    Log.add('🗂', `归入 ${files.length} 个文件`, files.join('\n'));
    toast(`已归类 ${files.length} 个文件（文件没有移动）`, 'ok');
    S.sel.clear();
    await refresh();
    await reloadTreeNode('');
  } catch (e) { toast(e.message, 'err'); }
}

/** 取消归类：从所有虚拟分类里移除引用 */
async function unassignFiles(paths) {
  const useAll = (!paths || !paths.length) && S.selectAll;
  const files = useAll ? [] : (paths || []).map((p) => baseName(p));
  const count = useAll ? S.totalFiles : files.length;
  if (!count) return;
  try {
    const body = { root: S.rootId, mode: 'remove' };
    if (useAll) body.scope = scopePayload();
    else body.files = files;
    await apiPost('/api/vgroups/assign', body);
    Log.add('↩', `移出归类 ${count} 个文件`, useAll ? '范围：' + viewLabel() : files.join('\n'));
    toast(`已移出归类 ${count} 个文件`, 'ok');
    S.selectAll = false;
    S.sel.clear();
    await refresh();
    await reloadTreeNode('');
  } catch (e) { toast(e.message, 'err'); }
}

/** 虚拟新建：创建一个虚拟分类，并把当前选中的文件归进去 */
function openNewVGroupDialog() {
  if (!S.rootId) return toast('请先添加文件夹', 'warn');
  const useAll = S.selectAll;
  const files = useAll ? [] : Array.from(S.sel)
    .filter((p) => !isVirtualPath(p))
    .map((p) => baseName(p));
  showModal(`
    <h3>虚拟新建（归类）</h3>
    <div class="modal-sub">
      只记录文件名引用 —— <b>不会移动任何文件</b>，也不会在硬盘上建文件夹。
      文件仍然待在原来的位置，资源管理器里看不出变化。
    </div>
    <label>分类名称</label>
    <input type="text" id="vgName" placeholder="例如：第1集素材">
    <div class="tpl-preview" id="vgPreview"></div>
    <div class="modal-actions">
      <button class="btn" data-close>取消</button>
      <button class="btn primary" id="vgOk">创建并归类</button>
    </div>
  `);
  const n = useAll ? S.totalFiles : files.length;
  $('#vgPreview').textContent = useAll
    ? `全选模式：当前视图全部 ${n} 个文件都会归入这个虚拟分类（含还没加载出来的）。`
    : n
      ? `将把选中的 ${n} 个文件归入这个虚拟分类：\n` +
        files.slice(0, 8).map((f) => '  · ' + f).join('\n') +
        (n > 8 ? `\n  … 还有 ${n - 8} 个` : '')
      : '当前没有选中文件 —— 会先建一个空分类，之后把文件拖到它上面即可归类。';
  setTimeout(() => $('#vgName').focus(), 30);
  const submit = async () => {
    const name = $('#vgName').value.trim();
    if (!name) return toast('请填分类名称', 'warn');
    try {
      const body = { root: S.rootId, name };
      if (useAll) body.scope = scopePayload();
      else body.files = files;
      await apiPost('/api/vgroups', body);
      Log.add('🗂', `归类 ${n} 个文件到「${name}」`, useAll ? '范围：' + viewLabel() : files.join('\n'));
      toast('已创建虚拟分类：' + name, 'ok');
      closeModal();
      S.selectAll = false;
      S.sel.clear();
      await refresh();
      await reloadTreeNode('');
    } catch (e) { toast(e.message, 'err'); }
  };
  $('#vgOk').onclick = submit;
  $('#vgName').onkeydown = (ev) => { if (ev.key === 'Enter') submit(); };
}

async function renameVGroup(g) {
  const name = prompt('虚拟分类改名：', g.name);
  if (!name || name === g.name) return;
  try {
    await apiPost('/api/vgroups/update', { root: S.rootId, id: g.id, name });
    toast('已改名', 'ok');
    await refresh();
    await reloadTreeNode('');
  } catch (e) { toast(e.message, 'err'); }
}

async function deleteVGroup(g) {
  const id = g && g.id;
  if (!id) return toast('拿不到这个虚拟分类的 ID —— 刷新页面（Ctrl+F5）重试', 'err');
  if (!confirm(`删除虚拟分类「${g.name}」？\n\n只解散这个分组，里面的文件一个都不会删，会退回到「散-未归类」。`)) return;
  try {
    await apiPost('/api/vgroups/delete', { root: S.rootId, id: g.id });
    Log.add('🗑', `删除虚拟分类「${g.name}」（文件一个都没删）`);
    toast('已删除虚拟分类，文件退回散-未归类', 'ok');
    if (isVGroup(S.path)) S.path = '';
    await refresh();
    await reloadTreeNode('');
  } catch (e) { toast(e.message, 'err'); }
}

/** 虚拟分类 -> 实体文件夹：真正落到硬盘上，可选「平移」或「复制」 */
function openMaterializeDialog(g) {
  if (!g) return toast('请先选择要转实体的虚拟分类', 'warn');
  const n = (g.files || []).length;
  if (!n) return toast('这个虚拟分类里还没有文件', 'warn');

  showModal(`
    <h3>📦 转为实体文件夹</h3>
    <div class="modal-sub">
      「${esc(g.name)}」里的 ${n} 个文件会真正落到硬盘上，在根目录创建一个真实的文件夹。
      这一步之后资源管理器里就能看到它了。
    </div>

    <label>新文件夹名称</label>
    <input type="text" id="mtName" value="${esc(g.name)}">

    <label>处理方式</label>
    <div class="radio-list">
      <label class="radio-item">
        <input type="radio" name="mtMode" value="move" checked>
        <div><b>平移（移动）</b><span>原文件移进新文件夹，根目录不再保留 —— 不占额外空间</span></div>
      </label>
      <label class="radio-item">
        <input type="radio" name="mtMode" value="copy">
        <div><b>复制</b><span>原文件留在根目录，新文件夹里放一份副本 —— 会占双倍空间</span></div>
      </label>
    </div>

    <label>将要处理</label>
    <div class="tpl-preview" id="mtPreview"></div>

    <div class="modal-actions">
      <button class="btn" data-close>取消</button>
      <button class="btn primary" id="mtOk">转为实体</button>
    </div>
  `);

  const modeOf = () => (document.querySelector('input[name=mtMode]:checked') || {}).value || 'move';
  const preview = () => {
    const mode = modeOf();
    const name = ($('#mtName').value || '').trim() || g.name;
    const head = mode === 'move'
      ? `${n} 个文件将被【移动】到：${name}\\    （原文件不再保留）`
      : `${n} 个文件将被【复制】到：${name}\\    （原文件保留，占双倍空间）`;
    const list = (g.files || []).slice(0, 8).map((f) => '  · ' + f).join('\n');
    $('#mtPreview').textContent = head + '\n' + list + (n > 8 ? `\n  … 还有 ${n - 8} 个` : '');
  };
  $$('input[name=mtMode]').forEach((r) => { r.onchange = preview; });
  $('#mtName').oninput = preview;
  preview();
  setTimeout(() => $('#mtName').focus(), 30);

  $('#mtOk').onclick = async () => {
    const mode = modeOf();
    const folderName = ($('#mtName').value || '').trim() || g.name;
    const btn = $('#mtOk');
    btn.disabled = true;
    btn.textContent = mode === 'move' ? '正在移动…' : '正在复制…';
    try {
      const r = await apiPost('/api/vgroups/materialize', { root: S.rootId, id: g.id, mode, folderName });
      closeModal();
      Log.add(
        '📦',
        `${mode === 'move' ? '平移' : '复制'} ${r.created} 个文件 → 实体文件夹「${r.folderName}」`,
        `虚拟分类「${g.name}」${mode === 'move' ? '（已消费，分组消失）' : '（原文件保留，分组保留）'}\n` +
        (r.results || []).filter((x) => x.ok).map((x) => `  · ${x.file}  →  ${x.to}`).join('\n') +
        (r.failed ? `\n  ⚠ ${r.failed} 个失败` : '')
      );
      toast(
        `已生成实体文件夹「${r.folderName}」：${mode === 'move' ? '移动' : '复制'}了 ${r.created} 个文件` +
        (r.failed ? `，${r.failed} 个失败` : ''),
        r.failed ? 'warn' : 'ok', 4200
      );
      if (isVGroup(S.path)) S.path = '';   // 平移后分组已被消费掉，回根目录
      await refresh();
      await reloadTreeNode('');
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '转为实体';
      toast(e.message, 'err');
    }
  };
}

async function moveItems(paths, targetPath) {
  const items = paths.map((p) => ({ root: S.rootId, path: p }));
  try {
    const r = await apiPost('/api/move', { targetRoot: S.rootId, targetPath, items });
    const ok = r.results.filter((x) => x.ok).length;
    const bad = r.results.filter((x) => !x.ok);
    Log.add('📥', `移动 ${ok} 个文件到「${baseName(targetPath) || '根目录'}」`,
      items.map((i) => '  · ' + baseName(i.path)).join('\n'));
    toast(`已移动 ${ok} 个文件${bad.length ? `，${bad.length} 个失败` : ''}`, bad.length ? 'warn' : 'ok');
    S.sel.clear();
    await refresh();
    await reloadTreeNode(targetPath);
  } catch (e) { toast(e.message, 'err'); }
}

async function pasteClipboard() {
  if (!S.internalClip) return toast('网页剪贴板是空的 —— 先在素材上按 Ctrl+C', 'warn');
  const { op, items } = S.internalClip;
  try {
    const r = await apiPost(op === 'cut' ? '/api/move' : '/api/copy', {
      targetRoot: S.rootId, targetPath: realPath(S.path), items,
    });
    const ok = r.results.filter((x) => x.ok).length;
    Log.add(op === 'cut' ? '✂' : '📋',
      `${op === 'cut' ? '剪切' : '复制'} ${ok} 个文件到「${baseName(S.path) || '根目录'}」`,
      items.map((i) => '  · ' + baseName(i.path)).join('\n'));
    toast(`${op === 'cut' ? '已移动' : '已复制'} ${ok} 个文件`, 'ok');
    if (op === 'cut') S.internalClip = null;
    await refresh();
  } catch (e) { toast(e.message, 'err'); }
}

function newFolderHere() { openNewFolderDialog(realPath(S.path)); }

function openNewFolderDialog(parentPath) {
  showModal(`
    <h3>新建文件夹</h3>
    <div class="modal-sub">位置：${esc(parentPath || '根目录')}</div>
    <label>文件夹名称</label>
    <input type="text" id="nfName" placeholder="例如：03_分镜">
    <label style="display:flex;align-items:center;gap:8px;margin-top:14px">
      <input type="checkbox" id="nfTemplate" style="width:auto"> 按项目模板创建整套子目录
    </label>
    <div class="tpl-preview" id="nfTpl">${esc((S.cfg.projectTemplate || []).map((s) => '  ├── ' + s).join('\n'))}</div>
    <div class="modal-actions">
      <button class="btn" data-close>取消</button>
      <button class="btn primary" id="nfOk">创建</button>
    </div>
  `);
  setTimeout(() => $('#nfName').focus(), 30);
  const submit = async () => {
    const name = $('#nfName').value.trim();
    if (!name) return;
    try {
      const useTpl = $('#nfTemplate').checked;
      if (useTpl) await apiPost('/api/mkdir-template', { root: S.rootId, path: parentPath, name });
      else await apiPost('/api/mkdir', { root: S.rootId, path: parentPath, name });
      Log.add('📁', `新建真实文件夹「${name}」${useTpl ? '（含项目模板）' : ''}`,
        '位置：' + (parentPath || '根目录'));
      toast('已创建：' + name, 'ok');
      closeModal();
      await refresh();
      await reloadTreeNode(parentPath || '');
    } catch (e) { toast(e.message, 'err'); }
  };
  $('#nfOk').onclick = submit;
  $('#nfName').onkeydown = (ev) => { if (ev.key === 'Enter') submit(); };
}

/* ===================== 文本编辑 ===================== */

function openTextEditor(entry) {
  showModal(`
    <h3>${esc(entry.name)}</h3>
    <div class="modal-sub">${fmtSize(entry.size)} · 编辑后点保存会直接写入文件</div>
    <textarea id="teContent" style="height:340px">加载中…</textarea>
    <div class="modal-actions">
      <button class="btn" data-close>关闭</button>
      <button class="btn primary" id="teSave">保存</button>
    </div>
  `);
  api(`/api/text?root=${encodeURIComponent(S.rootId)}&path=${encodeURIComponent(entry.path)}`)
    .then((r) => { $('#teContent').value = r.content; })
    .catch((e) => { $('#teContent').value = '无法读取：' + e.message; });
  $('#teSave').onclick = async () => {
    try {
      await apiPost('/api/text', { root: S.rootId, path: entry.path, content: $('#teContent').value });
      toast('已保存', 'ok');
      closeModal();
      await refresh();
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ===================== 上传 ===================== */

let uploading = false;

async function uploadFiles(files) {
  if (!files || !files.length) return;
  if (!S.rootId) return toast('请先添加文件夹', 'warn');
  if (uploading) return toast('正在上传中，请稍候', 'warn');
  uploading = true;

  const bar = document.createElement('div');
  bar.className = 'up-bar';
  bar.innerHTML = `<div id="upText">准备上传 ${files.length} 个文件…</div>
    <div class="up-track"><div class="up-fill" id="upFill"></div></div>`;
  document.body.appendChild(bar);

  let done = 0, failed = 0;
  for (const f of files) {
    $('#upText').textContent = `(${done + 1}/${files.length}) ${f.name}`;
    $('#upFill').style.width = (done / files.length * 100) + '%';
    try {
      await uploadOne(f);
      done++;
    } catch (e) { failed++; console.warn('上传失败', f.name, e); }
  }
  $('#upFill').style.width = '100%';
  bar.remove();
  uploading = false;
  Log.add('⬆', `上传 ${done} 个文件到「${baseName(S.path) || '根目录'}」`,
    files.map((f) => '  · ' + f.name).join('\n') + (failed ? `\n  ⚠ ${failed} 个失败` : ''));
  toast(`上传完成：成功 ${done} 个${failed ? `，失败 ${failed} 个` : ''}`, failed ? 'warn' : 'ok');
  await refresh();
}

function uploadOne(file) {
  return new Promise((resolve, reject) => {
    const q = new URLSearchParams({ root: S.rootId, path: realPath(S.path), name: file.name });
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', '/api/upload?' + q.toString());
    xhr.onload = () => {
      if (xhr.status === 200) resolve();
      else reject(new Error(xhr.responseText || ('HTTP ' + xhr.status)));
    };
    xhr.onerror = () => reject(new Error('网络错误'));
    xhr.send(file);
  });
}

/* ===================== 目录选择器（添加文件夹） ===================== */

function openAddRootDialog(startPath) {
  showModal(`
    <h3>添加要管理的文件夹</h3>
    <div class="modal-sub">在网页里能访问的路径被限制在添加的文件夹内，其他位置无法访问</div>
    <div class="picker-path" id="pkPath">读取中…</div>
    <div class="drive-grid" id="pkDrives"></div>
    <div class="picker-list" id="pkList" style="margin-top:10px">加载中…</div>
    <label>显示名称（可选）</label>
    <input type="text" id="pkName" placeholder="留空则用文件夹名">
    <div class="modal-actions">
      <button class="btn" data-close>取消</button>
      <button class="btn primary" id="pkOk">添加这个文件夹</button>
    </div>
  `);

  let cur = startPath || null;

  const load = async (p) => {
    $('#pkList').innerHTML = '<div class="picker-row">加载中…</div>';
    try {
      const r = await api('/api/fs/dirs' + (p ? '?path=' + encodeURIComponent(p) : ''));
      cur = r.path;
      $('#pkPath').textContent = r.path;
      const list = $('#pkList');
      list.innerHTML = '';
      if (r.parent) {
        const up = document.createElement('div');
        up.className = 'picker-row up';
        up.innerHTML = '⬆ <span class="pname">返回上一级</span>';
        up.onclick = () => load(r.parent);
        list.appendChild(up);
      }
      for (const d of r.dirs) {
        const row = document.createElement('div');
        row.className = 'picker-row';
        row.innerHTML = `📁 <span class="pname">${esc(d.name)}</span>`;
        row.onclick = () => load(d.path);
        row.ondblclick = () => { load(d.path); };
        list.appendChild(row);
      }
      if (!r.dirs.length && !r.parent) list.innerHTML = '<div class="picker-row">（没有子文件夹）</div>';
      if (!$('#pkName').value && r.path.split('\\').filter(Boolean).length) {
        $('#pkName').placeholder = r.path.split('\\').filter(Boolean).pop();
      }
    } catch (e) {
      $('#pkList').innerHTML = `<div class="picker-row" style="color:var(--danger)">${esc(e.message)}</div>`;
    }
  };

  api('/api/fs/drives').then((r) => {
    const box = $('#pkDrives');
    box.innerHTML = '';
    const quick = [
      { label: '🏠 用户目录', path: r.home },
      { label: '💻 程序目录', path: r.app },
    ];
    for (const q of quick) {
      const c = document.createElement('div');
      c.className = 'drive-chip';
      c.textContent = q.label;
      c.onclick = () => load(q.path);
      box.appendChild(c);
    }
    for (const d of r.drives) {
      const c = document.createElement('div');
      c.className = 'drive-chip';
      c.textContent = d.replace('\\', '');
      c.onclick = () => load(d);
      box.appendChild(c);
    }
  });

  load(startPath || null);

  $('#pkOk').onclick = async () => {
    if (!cur) return toast('请先选择一个文件夹', 'warn');
    try {
      const name = $('#pkName').value.trim();
      const r = await apiPost('/api/roots', { path: cur, name: name || undefined });
      await reloadConfig();
      S.rootId = r.root.id;
      renderRoots();
      closeModal();
      await selectRoot(r.root.id);
      toast('已添加：' + r.root.name, 'ok');
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ===================== 模态框 ===================== */

function showModal(html) {
  $('#modalBox').innerHTML = html;
  $('#modalMask').classList.remove('hidden');
  $$('#modalBox [data-close]').forEach((b) => { b.onclick = closeModal; });
}

function closeModal() {
  $('#modalMask').classList.add('hidden');
  $('#modalBox').innerHTML = '';
}

/* ===================== 设置 ===================== */

async function openSettings() {
  const stats = await Thumb.stats();
  showModal(`
    <h3>设置</h3>
    <div class="modal-sub">配置保存在程序目录的 config.json</div>

    <label>标题</label>
    <input type="text" id="stTitle" value="${esc(S.cfg.title || '')}">

    <label style="display:flex;align-items:center;gap:8px;margin-top:14px">
      <input type="checkbox" id="stHidden" style="width:auto" ${S.cfg.showHidden ? 'checked' : ''}>
      显示隐藏文件（以 . 开头的文件）
    </label>

    <label>新下载文件的处理策略</label>
    <select id="stPolicy">
      <option value="smart" ${S.cfg.autoPolicy === 'smart' ? 'selected' : ''}>智能：文件名无意义时弹窗询问</option>
      <option value="always" ${S.cfg.autoPolicy === 'always' ? 'selected' : ''}>总是询问</option>
      <option value="never" ${S.cfg.autoPolicy === 'never' ? 'selected' : ''}>全自动：直接入库不打扰</option>
    </select>
    <div style="font-size:11.5px;color:var(--text-faint);margin-top:6px">
      （P1 阶段接入收件箱监听后生效）
    </div>

    <label>项目模板（每行一个，新建项目时自动创建）</label>
    <textarea id="stTpl" style="height:120px">${esc((S.cfg.projectTemplate || []).join('\n'))}</textarea>

    <label>缩略图缓存</label>
    <div class="tpl-preview">已缓存 ${stats.count} 张，占用 ${fmtSize(stats.bytes)}</div>

    <div class="modal-actions">
      <button class="btn" id="stClearThumb">清空缩略图缓存</button>
      <span class="spacer"></span>
      <button class="btn" data-close>关闭</button>
      <button class="btn primary" id="stSave">保存</button>
    </div>
  `);
  $('#stClearThumb').onclick = async () => {
    await Thumb.clear();
    toast('缩略图缓存已清空', 'ok');
    openSettings();
  };
  $('#stSave').onclick = async () => {
    try {
      await apiPost('/api/config', {
        title: $('#stTitle').value.trim() || '漫剧素材管理',
        showHidden: $('#stHidden').checked,
        autoPolicy: $('#stPolicy').value,
        projectTemplate: $('#stTpl').value.split('\n').map((s) => s.trim()).filter(Boolean),
      });
      await reloadConfig();
      toast('设置已保存', 'ok');
      closeModal();
      await refresh();
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ===================== 投放素材助手 ===================== */

const DELIVER_TARGETS = [
  { id: 'doubao', icon: '🫘', name: '豆包', url: 'https://www.doubao.com/chat/' },
];

/** 点左侧栏按钮 → 弹出平台菜单 */
function openDeliverMenu(anchor) {
  const r = anchor.getBoundingClientRect();
  const items = [{ label: '投放到哪个平台', disabled: true }, { sep: true }];
  for (const t of DELIVER_TARGETS) {
    items.push({ label: `${t.icon} ${t.name}`, fn: () => openDeliverPanel(t) });
  }
  renderCtxMenu($('#ctxMenu'), r.left, r.top - 10, items);
}

/**
 * 用 iframe 加载探针页，检查篡改猴脚本有没有在本地页面挂上「已安装」标记。
 * 用 iframe 而不是看当前页面，是为了不用刷新主页面就能实时检测。
 */
function checkMjaInstalled() {
  return new Promise((resolve) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none';
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      try { f.remove(); } catch { }
      resolve(v);
    };
    f.onload = () => {
      setTimeout(() => {
        try {
          const d = f.contentDocument;
          finish(!!(d && d.documentElement.dataset.mjaReady === '1'));
        } catch { finish(false); }
      }, 500);
    };
    f.src = '/tools/probe.html?t=' + Date.now();
    document.body.appendChild(f);
    setTimeout(() => finish(false), 4000);
  });
}

function dvStatusHTML(ok) {
  return ok
    ? '<b>✅ 已经装好了</b><span>直接打开豆包就能用：右上角会出现蓝色「📁 素材」</span>'
    : '<b>⚠️ 还没装好</b><span>照下面 4 步做一遍，大约 2 分钟</span>';
}

async function openDeliverPanel(t) {
  showModal(`
    <h3>📤 投放素材助手 · ${esc(t.name)}</h3>
    <div class="modal-sub">
      在${esc(t.name)}页面加一个素材侧边栏 —— 从你的素材库点一下，文件直接进${esc(t.name)}的输入框。
    </div>

    <div class="dv-status" id="dvStatus"><b>正在检测…</b><span>稍等一秒</span></div>

    <div class="dv-steps">
      <div class="dv-step"><span class="dv-n">1</span><div>
        <b>复制脚本代码</b>
        <span>点下面那个蓝色的【📋 复制脚本代码】按钮，代码就进剪贴板了</span>
      </div></div>
      <div class="dv-step"><span class="dv-n">2</span><div>
        <b>打开篡改猴</b>
        <span>Edge 右上角那个拼图图标 → 点 <code>篡改猴</code>（Tampermonkey）→ <code>管理面板</code></span>
      </div></div>
      <div class="dv-step"><span class="dv-n">3</span><div>
        <b>粘贴并保存</b>
        <span>点 <code>➕ 添加新脚本</code> → 在编辑区按 <code>Ctrl+A</code> <b>全选</b> → <code>Ctrl+V</code> 粘贴 → <code>Ctrl+S</code> 保存<br>
        <span style="color:#f5b544">⚠️ 一定要先 Ctrl+A 全选覆盖掉默认模板，否则脚本会失效</span></span>
      </div></div>
      <div class="dv-step"><span class="dv-n">4</span><div>
        <b>回来验证</b>
        <span>点下面的【🔍 重新检测】—— 上面那行变成绿色的「✅ 已经装好了」就成了</span>
      </div></div>
    </div>

    <div style="margin-top:18px;font-size:12px;color:var(--text-faint);line-height:1.8">
      <b style="color:var(--text-dim)">装好之后怎么用：</b><br>
      打开豆包 → 页面<b>右上角</b>点蓝色「📁 素材」→ 侧边栏滑出 → <b>点一下素材</b>，文件就进豆包输入框了。<br>
      侧边栏<b>左边缘可以拖动调宽</b>，素材是缩略图，看画面就知道是什么。
    </div>

    <div class="modal-actions">
      <button class="btn" id="dvCheck">🔍 重新检测</button>
      <button class="btn" id="dvOpen">打开${esc(t.name)}</button>
      <button class="btn primary" id="dvCopy">📋 复制脚本代码</button>
    </div>
  `);

  const box = $('#dvStatus');
  const setStatus = (ok, checking) => {
    box.className = 'dv-status' + (checking ? '' : ok ? ' ok' : ' no');
    box.innerHTML = checking ? '<b>正在检测…</b><span>稍等一秒</span>' : dvStatusHTML(ok);
  };

  setStatus(false, true);
  setStatus(await checkMjaInstalled());

  $('#dvCheck').onclick = async () => {
    setStatus(false, true);
    const ok = await checkMjaInstalled();
    setStatus(ok);
    toast(ok ? '✅ 检测到脚本已安装' : '还没检测到 —— 确认脚本保存了，并且是「启用」状态', ok);
  };

  $('#dvOpen').onclick = () => window.open(t.url, '_blank');

  $('#dvCopy').onclick = async () => {
    const btn = $('#dvCopy');
    try {
      const res = await fetch('/tools/doubao-helper.js', { cache: 'no-store' });
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      btn.textContent = '✓ 已复制，去粘贴';
      toast('代码已复制 —— 去篡改猴里点「添加新脚本」粘贴保存', 'ok', 4200);
      setTimeout(() => { btn.textContent = '📋 复制脚本代码'; }, 2800);
    } catch (e) {
      toast('复制失败：' + e.message, 'err');
    }
  };
}

function openHelp() {
  showModal(`
    <h3>快捷键 & 用法</h3>
    <div class="modal-sub">鼠标拖拽文件到左侧目录即可移动</div>
    <div class="tpl-preview" style="font-size:12.5px;line-height:2">${
    [
      '双击 / 回车        打开（图片视频进灯箱，文件夹进入）',
      '单击 / Ctrl+单击    选择 / 多选',
      'Shift+单击          连选',
      'Ctrl+A              全选',
      '← →                 灯箱里翻上一张 / 下一张',
      'Esc                 关闭灯箱或弹窗',
      'F2                  重命名（多选时批量重命名）',
      'Delete              删除到回收站',
      'Ctrl+C / Ctrl+X     复制 / 剪切',
      'Ctrl+V              粘贴到当前文件夹',
      'Ctrl+Shift+N        新建文件夹',
      'F5                  刷新',
      'Backspace           返回上一级',
    ].join('\n')
    }</div>
    <div class="modal-actions"><button class="btn primary" data-close>知道了</button></div>
  `);
}

/* ===================== 搜索 ===================== */

let searchTimer = null;
function onSearchInput() {
  const v = $('#searchInput').value.trim();
  $('#btnClearSearch').classList.toggle('hidden', !v);
  clearTimeout(searchTimer);
  if (!v) {
    S.searchResults = null; S.selectAll = false; S.sel.clear();
    S.pageOffset = 0; S.hasMore = false;
    return loadDir(S.path);
  }
  searchTimer = setTimeout(() => doSearch(v), 280);
}

async function doSearch(kw, append) {
  if (!kw) { S.searchResults = null; S.hasMore = false; return renderContent(); }
  if (!S.rootId) return;
  const offset = append ? S.pageOffset : 0;
  if (!append) setStatus('搜索中…');
  try {
    const r = await api(`/api/search?root=${encodeURIComponent(S.rootId)}`
      + `&path=${encodeURIComponent(realPath(S.path))}&q=${encodeURIComponent(kw)}`
      + `&offset=${offset}&limit=${TUNING.searchLimit}&sort=${encodeURIComponent(S.sort)}`);
    const got = r.results.map((e) => Object.assign(e, { path: e.path }));
    S.searchResults = append ? (S.searchResults || []).concat(got) : got;
    S.pageOffset = offset + got.length;
    S.hasMore = !!r.hasMore;
    S.totalFiles = r.total || 0;
    renderContent(append);
    setStatus(`搜索到 ${r.total} 个结果${r.truncated ? '（已达扫描上限）' : ''}`);
  } catch (e) { toast(e.message, 'err'); }
}

/* ===================== 右键菜单 ===================== */

function showCtxMenu(x, y, entry) {
  const menu = $('#ctxMenu');
  const items = [];

  if (S.mode === 'trash') {
    items.push({ label: '♻ 恢复', fn: () => trashRestore(Array.from(S.sel)) });
    items.push({ label: '🗑 彻底删除', fn: () => trashPurge(Array.from(S.sel)) });
  } else if (entry && entry.virtual) {
    items.push({ label: '👁 打开', fn: () => navigateTo(entry.path) });
    items.push({ sep: true });
    if (entry.vgroup) {
      const grp = S.vgroups.find((x) => x.id === entry.id);
      items.push({ label: '📦 转为实体文件夹…', fn: () => openMaterializeDialog(grp) });
      items.push({ sep: true });
      items.push({ label: '✎ 虚拟分类改名', fn: () => renameVGroup({ id: entry.id, name: entry.name }) });
      items.push({ label: '🗑 删除虚拟分类（不删文件）', danger: true, fn: () => deleteVGroup({ id: entry.id, name: entry.name }) });
    } else {
      items.push({ label: '🗂 虚拟新建（把选中的文件归类）', fn: openNewVGroupDialog });
    }
    items.push({ sep: true });
    items.push({ label: '⟳ 刷新', k: 'F5', fn: refresh });
  } else if (entry) {
    items.push({ label: '👁 打开', fn: () => openEntry(entry), disabled: entry.isDir === false && !previewable([entry]).length && entry.kind !== 'text' });
    if (!entry.isDir) items.push({ label: '⤓ 下载', fn: () => { location.href = fileUrl(S.rootId, entry.path, true); } });
    items.push({ sep: true });
    if (S.sel.size > 1) items.push({ label: '✎ 批量重命名', k: 'F2', fn: openBatchRename });
    else items.push({ label: '✎ 重命名', k: 'F2', fn: () => renameEntry(entry) });
    items.push({ label: '📋 复制（网页内粘贴用）', k: 'Ctrl+C', fn: () => { S.internalClip = { op: 'copy', items: selectedItems() }; toast(`已放入网页剪贴板：${S.sel.size} 项 —— 到别的文件夹按 Ctrl+V`); } });
    items.push({ label: '✂ 剪切（网页内粘贴用）', k: 'Ctrl+X', fn: () => { S.internalClip = { op: 'cut', items: selectedItems() }; toast(`已剪切 ${S.sel.size} 项 —— 到别的文件夹按 Ctrl+V`); } });
    if (S.internalClip) items.push({ label: `📥 粘贴到「${baseName(S.path) || '根目录'}」`, k: 'Ctrl+V', fn: pasteClipboard });
    items.push({ sep: true });
    items.push({ label: '📁 添加为根目录', fn: async () => {
      const path = entry.isDir ? entry.path : parentOf(entry.path);
      const full = (S.cfg.roots.find((r) => r.id === S.rootId).path + '\\' + path.replace(/\//g, '\\'));
      try {
        const r = await apiPost('/api/roots', { path: full, name: baseName(path) || undefined });
        await reloadConfig();
        renderRoots();
        toast('已添加为根目录：' + r.root.name, 'ok');
      } catch (e) { toast(e.message, 'err'); }
    } });
    items.push({ label: '📋 复制到剪贴板（去豆包 Ctrl+V）', fn: copyToClipboard });
    items.push({ label: '🖥 在资源管理器中显示', fn: () => revealInExplorer(entry.path) });
    items.push({ sep: true });
    items.push({ label: '🗑 删除', k: 'Delete', danger: true, fn: deleteSelected });
  } else {
    items.push({ label: '📁 新建文件夹（真实）', k: 'Ctrl+Shift+N', fn: newFolderHere });
    items.push({ label: '＋ 新建项目（含模板）', fn: () => openNewFolderDialog(realPath(S.path)) });
    if (S.path === '' || isLoose(S.path)) {
      items.push({ label: '🗂 虚拟新建（归类，不动文件）', fn: openNewVGroupDialog });
    }
    if (S.internalClip) items.push({ label: '📥 粘贴', k: 'Ctrl+V', fn: pasteClipboard });
    items.push({ sep: true });
    items.push({ label: '⟳ 刷新', k: 'F5', fn: refresh });
    items.push({ label: '🔍 检测重复文件', fn: checkDuplicates });
  }

  renderCtxMenu(menu, x, y, items);
}

function renderCtxMenu(menu, x, y, items) {
  menu.innerHTML = '';
  for (const it of items) {
    if (!it) continue;
    if (it.sep) { const d = document.createElement('div'); d.className = 'sep'; menu.appendChild(d); continue; }
    const d = document.createElement('div');
    d.className = 'mi' + (it.disabled ? ' disabled' : '');
    d.innerHTML = `<span>${it.label}</span>${it.k ? `<span class="k">${it.k}</span>` : ''}`;
    if (it.danger) d.style.color = 'var(--danger)';
    if (!it.disabled) d.onclick = () => { hideCtxMenu(); it.fn(); };
    menu.appendChild(d);
  }
  menu.classList.remove('hidden');
  const rect = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, window.innerWidth - rect.width - 8) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - rect.height - 8) + 'px';
}

/** 左侧目录树的右键菜单（真实文件夹 / 虚拟分类 / 散-未归类 / 根目录） */
function showTreeCtxMenu(x, y, info) {
  const menu = $('#ctxMenu');
  const items = [];
  const isRoot = info.path === '';

  if (info.kind === 'loose') {
    items.push({ label: '👁 打开「' + LOOSE_NAME + '」', fn: () => navigateTo(LOOSE) });
    items.push({ sep: true });
    items.push({ label: '🗂 虚拟新建（归类）', fn: openNewVGroupDialog });
    items.push({ label: '📁 新建真实文件夹', fn: () => openNewFolderDialog('') });
  } else if (info.kind === 'vgroup') {
    const grp = S.vgroups.find((g) => g.id === info.id);
    items.push({ label: '👁 打开', fn: () => navigateTo(VG_PREFIX + info.id) });
    items.push({ sep: true });
    items.push({ label: '📦 转为实体文件夹…', fn: () => openMaterializeDialog(grp) });
    items.push({ label: '✎ 虚拟分类改名', fn: () => renameVGroup({ id: info.id, name: grp ? grp.name : info.name }) });
    items.push({ label: '🗑 删除虚拟分类（不删文件）', danger: true, fn: () => deleteVGroup({ id: info.id, name: grp ? grp.name : info.name }) });
  } else {
    items.push({ label: '👁 在主窗口打开', fn: () => navigateTo(info.path) });
    items.push({ label: '📁 新建子文件夹', k: isRoot ? 'Ctrl+Shift+N' : '', fn: () => openNewFolderDialog(info.path) });
    if (isRoot) items.push({ label: '🗂 虚拟新建（归类）', fn: openNewVGroupDialog });
    items.push({ sep: true });
    if (!isRoot) {
      items.push({ label: '✎ 重命名文件夹', fn: () => renamePathByPath(info.path) });
      items.push({ label: '🖥 在资源管理器中显示', fn: () => revealInExplorer(info.path) });
      items.push({ sep: true });
      items.push({ label: '🗑 删除文件夹（进回收站）', danger: true, fn: () => deletePathByPath(info.path) });
    }
  }
  renderCtxMenu(menu, x, y, items);
}

/** 重命名任意文件夹（树里右键用） */
async function renamePathByPath(p) {
  const cur = baseName(p);
  const name = prompt('重命名文件夹：', cur);
  if (!name || name === cur) return;
  try {
    await apiPost('/api/rename', { root: S.rootId, path: p, newName: name });
    Log.add('✎', `重命名文件夹：${cur} → ${name}`);
    toast('已重命名', 'ok');
    if (S.path === p) S.path = S.path.split('/').slice(0, -1).join('/');
    await refresh();
    await buildTree();
    await ensureVisible(S.path);
  } catch (e) { toast(e.message, 'err'); }
}

/** 删除任意文件夹到回收站（树里右键用） */
async function deletePathByPath(p) {
  if (!p) return toast('不能删除根目录本身', 'warn');
  const cur = baseName(p);
  if (!confirm(`把文件夹「${cur}」移到回收站？\n\n里面的文件会一起进回收站，之后可以随时恢复。`)) return;
  try {
    const r = await apiPost('/api/delete', { items: [{ root: S.rootId, path: p }] });
    const ok = r.results.filter((x) => x.ok).length;
    if (ok) Log.add('🗑', `删除文件夹「${cur}」到回收站`);
    toast(ok ? `已移到回收站：${cur}` : '删除失败', ok ? 'ok' : 'err');
    if (S.path === p || S.path.startsWith(p + '/')) S.path = '';
    S.sel.clear();
    await refresh();
    await buildTree();
    await ensureVisible(S.path);
  } catch (e) { toast(e.message, 'err'); }
}

function hideCtxMenu() { $('#ctxMenu').classList.add('hidden'); }

async function revealInExplorer(path) {
  try {
    await apiPost('/api/reveal', { root: S.rootId, path });
  } catch (e) { toast('无法打开资源管理器：' + e.message, 'warn'); }
}

/** 把选中的文件按 Windows 文件格式放进系统剪贴板，之后可在任意程序里 Ctrl+V */
async function copyToClipboard() {
  if (!S.sel.size && !S.selectAll) return toast('请先选择文件', 'warn');
  try {
    const r = await apiPost('/api/clipboard', selectionBody());
    Log.add('📋', `复制 ${r.count} 个文件到系统剪贴板`, (r.paths || []).join('\n'));
    toast(`已复制 ${r.count} 个文件 —— 切到豆包按 Ctrl+V 试试`, 'ok', 4600);
  } catch (e) { toast(e.message, 'err'); }
}

async function checkDuplicates() {
  try {
    const r = await api(`/api/duplicates?root=${encodeURIComponent(S.rootId)}&path=${encodeURIComponent(realPath(S.path))}`);
    if (!r.groups.length) return toast('没有发现可疑的重复文件', 'ok');
    const lines = r.groups.slice(0, 20).map((g) => g.names.join('   |   ')).join('\n');
    showModal(`<h3>可疑的重复文件</h3>
      <div class="modal-sub">文件名去掉 (1)(2) 后缀后相同、且大小一致，共 ${r.groups.length} 组</div>
      <div class="tpl-preview" style="max-height:340px;overflow:auto">${esc(lines)}</div>
      <div class="modal-actions"><button class="btn primary" data-close>知道了</button></div>`);
  } catch (e) { toast(e.message, 'err'); }
}

/* ===================== 拖拽视觉 ===================== */

let dragGhost = null;

function showDragGhost(n, x, y) {
  hideDragGhost();
  dragGhost = document.createElement('div');
  dragGhost.className = 'drag-ghost';
  dragGhost.innerHTML = `<b>移动 ${n} 个文件</b><span>拖到左侧目录，或文件夹卡片上</span>`;
  document.body.appendChild(dragGhost);
  moveDragGhost(x, y);
}

function moveDragGhost(x, y) {
  if (!dragGhost) return;
  dragGhost.style.left = (x + 16) + 'px';
  dragGhost.style.top = (y + 16) + 'px';
}

function hideDragGhost() {
  if (dragGhost) { dragGhost.remove(); dragGhost = null; }
}

function setDropHints(on) {
  const tree = $('#tree');
  if (tree) tree.classList.toggle('drag-active', on);
  if (content()) content().classList.toggle('drag-active', on);
}

function clearDropTargets() {
  $$('.drop-target').forEach((el) => el.classList.remove('drop-target'));
}

/**
 * 是否是从系统（资源管理器）拖进来的文件。
 * 只看 dataTransfer.types 里的 'Files'：它同时覆盖外部文件拖入和「在桌面/Finder 里拖文件」，
 * 而网页内部拖拽（S.dragPaths）虽然也带 Files 类型，调用处一律先排除 S.dragPaths。
 */
function isFileDrag(ev) {
  const dt = ev.dataTransfer;
  if (!dt) return false;
  return Array.from(dt.types || []).includes('Files');
}

/* ===================== 事件绑定 ===================== */

/**
 * 事件绑定总入口 —— 只负责调用，具体绑定都在下面各自的函数里。
 * 原来这里是 313 行的巨型函数，改一处容易碰坏别处，现已按区域拆分。
 */
function bindEvents() {
  bindToolbarEvents();
  bindLogEvents();
  bindNavEvents();
  bindContentEvents();
  bindOverlayEvents();
  bindDragDropEvents();
  bindKeyboardEvents();
}

/** 左树 ＋ / 视图切换 / 排序 / 筛选 / 缩放 / 滚动加载 */
function bindToolbarEvents() {
  // 根
  $('#btnAddRoot').onclick = () => openAddRootDialog();

  // 视图
  $('#viewSwitch').onclick = (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    S.view = b.dataset.view;
    $$('#viewSwitch button').forEach((x) => x.classList.toggle('active', x === b));
    renderContent();
  };

  $('#sortSelect').onchange = (e) => { S.sort = e.target.value; reloadCurrent(); };
  $('#filterSelect').onchange = (e) => { S.filter = e.target.value; reloadCurrent(); };

  // 滚到底自动加载下一页
  content().addEventListener('scroll', () => {
    if (S.loadingMore || !S.hasMore) return;
    const el = content();
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 600) loadMore();
  });
  $('#zoomRange').oninput = (e) => {
    document.documentElement.style.setProperty('--cell', e.target.value + 'px');
  };
}

/** 操作日志面板：开关、清空、点外部关闭 */
function bindLogEvents() {
  // 操作日志
  $('#btnLog').onclick = (ev) => {
    ev.stopPropagation();
    const panel = $('#logPanel');
    const show = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !show);
    $('#btnLog').classList.toggle('active', show);
    if (show) renderLogPanel();
  };
  $('#logPanel').onclick = (ev) => ev.stopPropagation();
  $('#logClear').onclick = () => {
    if (!Log.items.length) return;
    if (!confirm('清空操作日志？（只是记录，不影响任何文件）')) return;
    Log.clear();
    toast('日志已清空', 'ok');
  };
  document.addEventListener('click', () => {
    $('#logPanel').classList.add('hidden');
    $('#btnLog').classList.remove('active');
  });

}

/** 导航按钮 / 侧栏按钮 / 搜索框 */
function bindNavEvents() {
  $('#btnBack').onclick = () => navigateTo(parentOf(S.path));
  $('#btnRefresh').onclick = refresh;
  $('#btnTrash').onclick = openTrash;
  $('#btnSettings').onclick = openSettings;
  $('#btnHelp').onclick = openHelp;
  // 投放素材助手：点一下弹出平台菜单（stopPropagation 防止被"点外部关闭"立刻收掉）
  $('#btnDeliver').onclick = (ev) => {
    ev.stopPropagation();
    openDeliverMenu($('#btnDeliver'));
  };
  $('#btnNewFolderSide').onclick = () => { if (!S.rootId) return toast('请先添加文件夹', 'warn'); newFolderHere(); };

  $('#searchInput').oninput = onSearchInput;
  $('#btnClearSearch').onclick = () => {
    $('#searchInput').value = '';
    S.searchResults = null; S.selectAll = false; S.sel.clear();
    S.pageOffset = 0; S.hasMore = false;
    $('#btnClearSearch').classList.add('hidden');
    loadDir(S.path);
  };

}

/** 内容区：单击选中 / 双击打开 / 右键菜单 / 点空白关菜单 */
function bindContentEvents() {
  // 内容区点击
  content().addEventListener('click', (ev) => {
    const el = ev.target.closest('.card, .lrow');
    if (!el || el.classList.contains('head')) return;
    const path = el.dataset.path;
    const list = S.mode === 'trash' ? S.trash.map((t) => ({ path: t.id })) : visibleEntries();
    const idx = list.findIndex((x) => x.path === path);
    if (S.mode === 'trash') {
      if (ev.ctrlKey || ev.metaKey) {
        if (S.sel.has(path)) S.sel.delete(path); else S.sel.add(path);
      } else { S.sel.clear(); S.sel.add(path); }
      updateSelectionStatus();
      return;
    }
    const entry = visibleEntries().find((x) => x.path === path);
    if (!entry) return;
    if (entry.virtual) return navigateTo(entry.path);   // 虚拟节点单击直接进入
    clickSelect(ev, entry, idx, ev);
  });

  content().addEventListener('dblclick', (ev) => {
    const el = ev.target.closest('.card, .lrow');
    if (!el) return;
    if (S.mode === 'trash') return;
    const entry = visibleEntries().find((x) => x.path === el.dataset.path);
    if (entry) openEntry(entry);
  });

  content().addEventListener('contextmenu', (ev) => {
    const el = ev.target.closest('.card, .lrow');
    ev.preventDefault();
    if (el && !el.classList.contains('head')) {
      const path = el.dataset.path;
      if (!S.sel.has(path)) { S.sel.clear(); S.sel.add(path); updateSelectionStatus(); }
      if (S.mode === 'trash') return showCtxMenu(ev.clientX, ev.clientY, null);
      const entry = visibleEntries().find((x) => x.path === path);
      showCtxMenu(ev.clientX, ev.clientY, entry || null);
    } else {
      S.sel.clear(); updateSelectionStatus();
      showCtxMenu(ev.clientX, ev.clientY, null);
    }
  });

  document.addEventListener('click', (ev) => {
    if (!ev.target.closest('#ctxMenu')) hideCtxMenu();
  });

}

/** 灯箱 / 模态遮罩 / 左侧分割条拖拽 */
function bindOverlayEvents() {
  // 灯箱
  $('#lbClose').onclick = closeLightbox;
  $('#lbPrev').onclick = () => lbStep(-1);
  $('#lbNext').onclick = () => lbStep(1);
  $('#lightbox').addEventListener('click', (ev) => {
    if (ev.target.id === 'lightbox' || ev.target.id === 'lbStage') closeLightbox();
  });

  // 模态遮罩
  $('#modalMask').addEventListener('mousedown', (ev) => { if (ev.target.id === 'modalMask') closeModal(); });

  // 分割条
  (function splitter() {
    const sp = $('#splitter');
    let dragging = false;
    sp.addEventListener('mousedown', () => { dragging = true; sp.classList.add('dragging'); document.body.style.cursor = 'col-resize'; });
    window.addEventListener('mousemove', (ev) => {
      if (!dragging) return;
      const w = Math.max(180, Math.min(520, ev.clientX));
      $('#sidebar').style.width = w + 'px';
    });
    window.addEventListener('mouseup', () => { dragging = false; sp.classList.remove('dragging'); document.body.style.cursor = ''; });
  })();

}

/** 拖拽：素材内部移动 + 外部文件拖入上传（从 bindEvents 拆出，纯搬迁） */
function bindDragDropEvents() {
  // 拖拽：内部移动
  content().addEventListener('dragstart', (ev) => {
    const el = ev.target.closest('.card, .lrow');
    if (!el) return;
    const entry = visibleEntries().find((x) => x.path === el.dataset.path);
    if (entry && entry.virtual) { ev.preventDefault(); return; }   // 虚拟节点本身不能拖
    if (!S.sel.has(el.dataset.path)) { S.sel.clear(); S.sel.add(el.dataset.path); updateSelectionStatus(); }
    S.dragPaths = Array.from(S.sel).filter((p) => !isVirtualPath(p));
    if (!S.dragPaths.length) return;
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', S.dragPaths.join('\n'));
    // 用一张透明图顶掉浏览器默认的半透明拖影，换成我们自己的清晰浮标
    const blank = new Image();
    blank.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    ev.dataTransfer.setDragImage(blank, 0, 0);
    showDragGhost(S.dragPaths.length, ev.clientX, ev.clientY);
    document.body.classList.add('dragging');
    setDropHints(true);
  });

  // 拖拽中：浮标跟随鼠标 + 高亮内容区里的文件夹卡片
  content().addEventListener('dragover', (ev) => {
    if (!S.dragPaths || !S.dragPaths.length) return;
    moveDragGhost(ev.clientX, ev.clientY);
    const card = ev.target.closest('.card, .lrow');
    clearDropTargets();
    if (!card || card.classList.contains('head')) return;
    const entry = visibleEntries().find((x) => x.path === card.dataset.path);
    if (!entry) return;
    if (entry.virtual || entry.isDir) {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      card.classList.add('drop-target');
    }
  });

  // 放下：拖到文件夹卡片 / 虚拟节点卡片上
  content().addEventListener('drop', async (ev) => {
    if (!S.dragPaths || !S.dragPaths.length) return;
    const card = ev.target.closest('.card, .lrow');
    clearDropTargets();
    if (!card) return;
    const entry = visibleEntries().find((x) => x.path === card.dataset.path);
    if (!entry || (!entry.virtual && !entry.isDir)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const paths = S.dragPaths.slice();
    S.dragPaths = null;
    hideDragGhost();
    if (entry.virtual) {
      if (entry.vgroup) await assignToGroup(entry.id, paths);
      else await unassignFiles(paths);
    } else {
      await moveItems(paths, entry.path);
    }
  });

  // 拖拽结束：清理所有视觉状态
  document.addEventListener('dragend', () => {
    hideDragGhost();
    clearDropTargets();
    document.body.classList.remove('dragging');
    setDropHints(false);
    S.dragPaths = null;
  });

  // 拖拽：外部文件上传
  let dragDepth = 0;
  window.addEventListener('dragenter', (ev) => {
    if (isFileDrag(ev) && !S.dragPaths) {
      dragDepth++;
      $('#dropMask').classList.remove('hidden');
    }
  });
  window.addEventListener('dragleave', () => {
    if (--dragDepth <= 0) { dragDepth = 0; $('#dropMask').classList.add('hidden'); }
  });
  window.addEventListener('dragover', (ev) => {
    // 内部拖拽（移动素材）
    if (S.dragPaths) { ev.preventDefault(); moveDragGhost(ev.clientX, ev.clientY); return; }
    // 外部文件拖入：必须显式取消默认行为，否则浏览器认为页面不是放置目标，
    // 松手时直接用新标签页打开这个文件（页面被“截胡”，上传永远收不到）。
    if (isFileDrag(ev)) {
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
    }
  });
  window.addEventListener('drop', (ev) => {
    // 只要 drop 落在页面里，就无条件阻止浏览器默认动作（打开文件 / 导航）
    ev.preventDefault();
    dragDepth = 0;
    $('#dropMask').classList.add('hidden');
    if (S.dragPaths) {
      // 拖到了空白处 = 取消，什么都不做
      S.dragPaths = null;
      hideDragGhost();
      setDropHints(false);
      clearDropTargets();
      return;
    }
    if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length) {
      uploadFiles(Array.from(ev.dataTransfer.files));
    }
  });

}

/**
 * 键盘快捷键 + 页面级粘贴。
 * 从 bindEvents（原 313 行）里独立出来的第一批 —— 纯搬迁，逻辑一行没改。
 */
function bindKeyboardEvents() {
  document.addEventListener('keydown', (ev) => {
    const tag = (ev.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select';

    if (ev.key === 'Escape') {
      if (!$('#lightbox').classList.contains('hidden')) return closeLightbox();
      if (!$('#modalMask').classList.contains('hidden')) return closeModal();
      return hideCtxMenu();
    }
    if (!$('#lightbox').classList.contains('hidden')) {
      if (ev.key === 'ArrowLeft') return lbStep(-1);
      if (ev.key === 'ArrowRight') return lbStep(1);
      if (ev.key === ' ') { ev.preventDefault(); const v = $('#lbStage video'); if (v) { v.paused ? v.play() : v.pause(); } return; }
      return;
    }
    if (!$('#modalMask').classList.contains('hidden')) return;
    if (typing) return;

    if (ev.key === 'F5') { ev.preventDefault(); return refresh(); }
    if (ev.key === 'F2') {
      ev.preventDefault();
      if (S.mode === 'trash') return;
      const real = Array.from(S.sel).filter((p) => !isVirtualPath(p));
      if (!real.length) return;
      return real.length > 1 ? openBatchRename() : renameEntry({ path: real[0] });
    }
    if (ev.key === 'Delete') { ev.preventDefault(); return S.mode === 'trash' ? trashPurge(Array.from(S.sel)) : deleteSelected(); }
    if (ev.key === 'Backspace') { ev.preventDefault(); return navigateTo(parentOf(S.path)); }
    if (ev.key === 'Enter' && S.sel.size === 1 && S.mode !== 'trash') {
      const entry = visibleEntries().find((x) => x.path === Array.from(S.sel)[0]);
      if (entry) return openEntry(entry);
    }
    if (ev.ctrlKey && ev.key.toLowerCase() === 'a') {
      ev.preventDefault();
      if (S.mode === 'trash') {
        S.sel.clear();
        S.trash.forEach((t) => S.sel.add(t.id));
        return updateSelectionStatus();
      }
      if (!S.totalFiles) return toast('当前视图没有可选的文件', 'warn');
      S.sel.clear();
      S.selectAll = true;            // 全选整个视图，含还没加载出来的
      return updateSelectionStatus();
    }
    if (ev.ctrlKey && ev.shiftKey && ev.key.toLowerCase() === 'n') { ev.preventDefault(); return newFolderHere(); }
    if (ev.ctrlKey && ev.key.toLowerCase() === 'c' && !ev.shiftKey) {
      // 用户正在复制选中的文本（比如文件名），走浏览器默认
      if (String(window.getSelection() || '').trim()) return;
      if (S.mode === 'trash') return;
      if (!S.sel.size && !S.selectAll) return;
      ev.preventDefault();
      // 一份给网页内部（供「粘贴到别的文件夹」用），一份给 Windows 剪贴板（供豆包等外部程序用）
      S.internalClip = { op: 'copy', items: selectedItems() };
      return copyToClipboard();
    }
    if (ev.ctrlKey && ev.key.toLowerCase() === 'x') {
      if (S.sel.size) { S.internalClip = { op: 'cut', items: selectedItems() }; toast(`已剪切 ${S.sel.size} 项 —— 到别的文件夹按 Ctrl+V`); }
      return;
    }
    if (ev.ctrlKey && ev.key.toLowerCase() === 'v') { ev.preventDefault(); return pasteClipboard(); }
  });

  // 页面级粘贴（截图粘贴上传）
  window.addEventListener('paste', (ev) => {
    const tag = (ev.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    const items = ev.clipboardData && ev.clipboardData.items;
    if (!items) return;
    const files = [];
    for (const it of items) if (it.kind === 'file') { const f = it.getAsFile(); if (f) files.push(f); }
    if (files.length) uploadFiles(files);
  });
}

/* ===================== 启动 ===================== */

async function init() {
  Log.load();
  renderLogButton();
  await Thumb.init();
  bindEvents();
  try {
    await reloadConfig();
  } catch (e) {
    return showEmpty('无法连接后端', e.message, null, null);
  }
  if (S.rootId) {
    await selectRoot(S.rootId);
  } else {
    renderRoots();
    buildTree();
    showEmpty('还没有添加文件夹', '点左上角的 ＋ 选择要管理的文件夹（可以是任意磁盘位置）', '添加文件夹', openAddRootDialog);
    setStatus('就绪');
  }
}

init();
