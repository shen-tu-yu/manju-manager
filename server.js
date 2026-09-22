#!/usr/bin/env node
'use strict';

/**
 * 漫剧素材管理器 —— 零依赖本地文件管理 WebUI
 *
 * 启动： node server.js  [--port 8899] [--host 127.0.0.1]
 * 特点： 不依赖任何 npm 包；根目录在网页里自由添加/切换；
 *       所有读写路径都锁死在已添加的根目录内（防越界）。
 */

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');

const APP_DIR = __dirname;

// 数据层：Node 内置 node:sqlite，零依赖。数据库文件在这个目录里，不占 C 盘。
const DB = require('./db');
DB.migrate();   // 首次启动把旧的 config.json / vgroups.json 导进库（库非空时什么都不做）
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const CONFIG_PATH = path.join(APP_DIR, 'config.json');
const RECYCLE_NAME = '.recycle';          // 每个根目录下的回收站

// ---------------------------------------------------------------- 文件类型

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.jfif', '.gif', '.webp', '.bmp', '.avif', '.svg', '.ico']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v', '.flv', '.wmv', '.mpg', '.mpeg', '.ts']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg', '.wma']);
const TEXT_EXT = new Set(['.txt', '.md', '.json', '.js', '.mjs', '.cjs', '.ts', '.css', '.html', '.htm', '.xml',
  '.yml', '.yaml', '.log', '.csv', '.ini', '.conf', '.bat', '.cmd', '.ps1', '.sh', '.py', '.java', '.c',
  '.cpp', '.h', '.hpp', '.go', '.rs', '.sql', '.vue', '.jsx', '.tsx', '.srt', '.ass', '.toml']);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.jfif': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
  '.m4v': 'video/mp4', '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.flac': 'audio/flac',
  '.ogg': 'audio/ogg', '.aac': 'audio/aac',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf', '.zip': 'application/zip',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function extOf(name) { return path.extname(name).toLowerCase(); }

function kindOf(name) {
  const ext = extOf(name);
  if (IMAGE_EXT.has(ext)) return 'image';
  if (VIDEO_EXT.has(ext)) return 'video';
  if (AUDIO_EXT.has(ext)) return 'audio';
  if (TEXT_EXT.has(ext)) return 'text';
  return 'other';
}

// ---------------------------------------------------------------- 配置

const DEFAULT_CONFIG = {
  port: 8899,
  host: '127.0.0.1',
  title: '漫剧素材管理',
  roots: [],                 // [{ id, name, path }]
  autoPolicy: 'smart',       // smart | always | never
  inboxEnabled: true,        // 是否监听已挂载根目录里的"新文件到达"
  lastIngestTarget: null,    // 「全自动入库」的落点，记住上次选的 { root, path, gid }
  showHidden: false,
  projectTemplate: ['01_场景', '02_人物', '03_分镜', '04_视频片段', '05_成片'],
  smartRules: [
    { name: '纯数字文件名', pattern: '^\\d{6,}(\\s*\\(\\d+\\))?$' },
    { name: '纯数字下划线组合', pattern: '^[\\d_\\-\\s]{8,}$' },
    { name: '长十六进制串', pattern: '^[0-9a-fA-F]{12,}$' },
    { name: '日期加序号', pattern: '^\\d{1,4}[年\\-\\/]?\\d{1,2}[月\\-\\/]\\d{1,2}日?\\s*(\\(\\d+\\))*$' },
    { name: '无意义短串', pattern: '^(img|image|video|vid|download|微信图片|QQ图片|截图)[_\\-\\s]*\\d*$' },
  ],

  // 阈值集中在这里，不再散落成各处的字面量
  limits: {
    pageDefault: 200,     // /api/list 每页条数
    pageMax: 1000,        // /api/list 每页上限
    searchDefault: 100,   // /api/search 每页条数
    searchMax: 500,       // 搜索结果总数上限
    searchDepth: 8,       // 搜索最大递归层数
    textPreviewBytes: 2 * 1024 * 1024,   // 文本预览上限
  },
};

function loadConfig() {
  const cfg = Object.assign({}, DEFAULT_CONFIG, DB.getSettings());
  cfg.roots = DB.getRoots()
    .filter((r) => r && r.path)
    .map((r) => ({ id: String(r.id), name: String(r.name || path.basename(r.path)), path: path.resolve(r.path) }));
  return cfg;
}

function saveConfig() {
  try {
    const s = {};
    for (const k of ['port', 'host', 'title', 'autoPolicy', 'inboxEnabled', 'lastIngestTarget',
      'showHidden', 'projectTemplate', 'smartRules', 'limits']) {
      s[k] = config[k];
    }
    DB.setSettings(s);
    DB.replaceRoots(config.roots);
  } catch (e) {
    console.error('[warn] 写入数据库失败:', e.message);
  }
}

let config = loadConfig();
let rootSeq = config.roots.length;

// 命令行覆盖
(function applyArgv() {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port' && argv[i + 1]) config.port = Number(argv[++i]);
    else if (argv[i] === '--host' && argv[i + 1]) config.host = argv[++i];
    else if ((argv[i] === '--root' || argv[i] === '-r') && argv[i + 1]) addRoot(argv[++i], null, true);
  }
})();

// ---------------------------------------------------------------- 工具

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function sendJSON(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

/**
 * 排查用的简易日志（只记关键动作，出问题才看）。
 *
 * 先攒在内存里、每秒批量落盘一次 —— 原来是每个请求 appendFileSync 同步写盘，
 * 高并发时会拖慢接口响应。日志晚一秒出现不影响排查。
 */
const LOG_PATH = path.join(APP_DIR, 'debug.log');
const LOG_MAX_BYTES = 1024 * 1024;   // 超过 1MB 就清空重来，防止无限增长
let logQueue = [];
let logTimer = null;

function LOG(msg) {
  logQueue.push(`${new Date().toLocaleString('zh-CN')}  ${msg}\n`);
  if (logQueue.length >= 200) flushLog();               // 攒太多立刻写
  else if (!logTimer) logTimer = setTimeout(flushLog, 1000);
}

function flushLog() {
  if (logTimer) { clearTimeout(logTimer); logTimer = null; }
  if (!logQueue.length) return;
  const data = logQueue.join('');
  logQueue = [];
  try {
    if (fs.existsSync(LOG_PATH) && fs.statSync(LOG_PATH).size > LOG_MAX_BYTES) fs.writeFileSync(LOG_PATH, '');
    fs.appendFileSync(LOG_PATH, data);
  } catch { /* 日志写不进去不该影响主流程 */ }
}

// 退出前把没落盘的日志补上
process.on('exit', flushLog);

/**
 * 异步跑一个外部命令，返回 { code, stdout, stderr }。
 * 用 spawn 而不是 spawnSync —— spawnSync 会把整个 Node 事件循环卡住，
 * 期间所有 HTTP 请求都得排队等它跑完。
 */
/**
 * 把一段 PowerShell 脚本编码成 -EncodedCommand 的参数（UTF-16LE Base64）。
 *
 * 为什么不用 -Command：
 * 路径里带空格或括号时（例如 `9月9日 (1)(1).png`），
 * 命令行传参会把参数拆开，PowerShell 拿到的是残缺的命令。
 * EncodedCommand 是整块 Base64，不存在拆分和编码问题。
 */
function psArgs(script) {
  return ['-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];
}

/**
 * 剪贴板是 Windows 的全局独占资源：同一时刻只允许一个进程打开它。
 * 这里用一条 Promise 链把写入操作串起来，避免快速连点时互相抢占。
 */
let clipboardChain = Promise.resolve();
function withClipboardLock(fn) {
  const run = clipboardChain.then(fn, fn);
  clipboardChain = run.then(() => { }, () => { });
  return run;
}

/** PowerShell 走 stderr 时会吐 CLIXML（进度/错误都在里面），这里挑出人话 */
function cleanPsOutput(stderr, stdout) {
  const raw = `${stderr || ''}\n${stdout || ''}`;
  const errs = raw.match(/<S S="Error">[\s\S]*?<\/S>/g);
  if (errs) {
    return errs.map((x) => x.replace(/<[^>]*>/g, '')
      .replace(/_x000D_/g, '').replace(/_x000A_/g, ' '))
      .join(' ').replace(/\s+/g, ' ').trim();
  }
  return raw.replace(/#< CLIXML[\s\S]*?<\/Objs>/g, '')
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function runCommand(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    let out = '', err = '', done = false;
    const finish = (r) => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    const child = spawn(cmd, args, { windowsHide: true });
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* 已经退出了 */ }
      finish({ code: -1, stdout: out, stderr: '执行超时' });
    }, timeoutMs || 20000);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => finish({ code: -1, stdout: out, stderr: e.message }));
    child.on('close', (code) => finish({ code, stdout: out, stderr: err }));
  });
}

function sendError(res, err) {
  const status = err && err.status ? err.status : 500;
  if (status >= 500) console.error('[error]', err);
  sendJSON(res, status, { error: (err && err.message) || '服务器内部错误' });
}

function readJSONBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, '请求体过大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch (e) { reject(new HttpError(400, 'JSON 解析失败: ' + e.message)); }
    });
    req.on('error', reject);
  });
}

/** 把「相对于根的 POSIX 路径」解析成绝对路径，并保证不越界 */
function resolveSafe(rootPath, relPath) {
  const rootAbs = path.resolve(rootPath);
  let rel = String(relPath == null ? '' : relPath).replace(/\\/g, '/');
  rel = rel.replace(/^\/+/, '');
  const segs = rel.split('/').filter((s) => s.length && s !== '.');
  if (segs.some((s) => s === '..')) throw new HttpError(403, '路径越界：不允许 ..');
  const target = path.resolve(rootAbs, ...segs);
  const diff = path.relative(rootAbs, target);
  if (diff && (diff.startsWith('..') || path.isAbsolute(diff))) throw new HttpError(403, '路径越界');
  return target;
}

/** 绝对路径 -> 相对根的 POSIX 路径 */
function toRel(rootPath, absPath) {
  const rel = path.relative(path.resolve(rootPath), path.resolve(absPath));
  return rel.split(path.sep).join('/');
}

function getRoot(id) {
  const r = config.roots.find((x) => x.id === id);
  if (!r) throw new HttpError(404, '根目录不存在，请重新添加文件夹');
  return r;
}

function uniqueName(dir, name) {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  let candidate = name;
  let i = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base} (${i})${ext}`;
    i++;
  }
  return candidate;
}

const INVALID_NAME = /[<>:"/\\|?*\x00-\x1f]/;

function assertValidName(name) {
  const n = String(name == null ? '' : name).trim();
  if (!n) throw new HttpError(400, '名称不能为空');
  if (n === '.' || n === '..') throw new HttpError(400, '名称非法');
  if (INVALID_NAME.test(n)) throw new HttpError(400, '名称含有非法字符 \\ / : * ? " < > |');
  if (n.length > 200) throw new HttpError(400, '名称过长');
  return n;
}

async function listDrives() {
  const out = [];
  const letters = [];
  for (let c = 67; c <= 90; c++) letters.push(String.fromCharCode(c) + ':\\'); // C: .. Z:
  letters.push('A:\\', 'B:\\');
  for (const p of letters) {
    try {
      const st = await fsp.stat(p);
      if (st.isDirectory()) out.push(p);
    } catch { /* 不存在 */ }
  }
  out.sort();
  return out;
}

// ---------------------------------------------------------------- 虚拟分类
//
// 「虚拟分类」是归类用的：只记录根目录下的文件名引用，文件本体一动不动，
// 也不用在你的素材夹里建任何东西。数据存在程序目录的 vgroups.json，
// 以「根目录绝对路径」为键，所以重新添加同一个文件夹也不会丢。

// 内存镜像 + 落库：vgroups 结构保持不变，只有存取改走 SQLite
let vgroups = DB.getVGroups();     // { [根绝对路径]: { groups: [{ id, name, files: [] }] } }

function saveVGroupsFile() {
  try { DB.replaceVGroups(vgroups); }
  catch (e) { console.error('[warn] 写入数据库失败:', e.message); }
}

function groupsOf(root) {
  if (!vgroups[root.path] || !Array.isArray(vgroups[root.path].groups)) {
    vgroups[root.path] = { groups: [] };
  }
  return vgroups[root.path].groups;
}

/**
 * 读出该根的虚拟分类，顺手清掉已经失效的引用
 * （文件被真实移走 / 改名 / 删除后，引用就没意义了），
 * 顺便算出还有多少散文件没被归类。
 */
async function readGroupsClean(root, knownNames) {
  const groups = groupsOf(root);
  // 调用方已经列过目录时直接把文件名传进来，避免重复扫盘
  const names = knownNames instanceof Set ? knownNames : new Set();
  if (!(knownNames instanceof Set)) {
    try {
      const ds = await fsp.readdir(root.path, { withFileTypes: true });
      for (const d of ds) if (d.isFile() && !d.name.startsWith('.')) names.add(d.name);
    } catch { /* 目录读不到就当空的 */ }
  }

  let changed = false;
  const out = groups.map((g) => {
    const raw = Array.isArray(g.files) ? g.files : [];
    const files = raw.filter((f) => names.has(f));
    if (files.length !== raw.length) changed = true;
    return { id: g.id, name: g.name, files };
  });
  if (changed) { vgroups[root.path].groups = out; saveVGroupsFile(); }

  const assigned = new Set();
  for (const g of out) for (const f of g.files) assigned.add(f);
  return { groups: out, looseCount: Math.max(0, names.size - assigned.size), total: names.size };
}

// ---------------------------------------------------------------- 回收站

function trashDirOf(rootPath) { return path.join(rootPath, RECYCLE_NAME); }
function trashIndexPath(rootPath) { return path.join(trashDirOf(rootPath), 'index.json'); }

async function readTrashIndex(rootPath) {
  try {
    const txt = await fsp.readFile(trashIndexPath(rootPath), 'utf8');
    const arr = JSON.parse(txt);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

async function writeTrashIndex(rootPath, arr) {
  await fsp.mkdir(trashDirOf(rootPath), { recursive: true });
  await fsp.writeFile(trashIndexPath(rootPath), JSON.stringify(arr, null, 2), 'utf8');
}

/** 删除（移动）到回收站 */
async function moveToTrash(root, rel, absPath) {
  const st = await fsp.stat(absPath);
  const stamp = new Date();
  const id = `${stamp.getTime().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const bucket = path.join(trashDirOf(root.path), id);
  await fsp.mkdir(bucket, { recursive: true });
  const fileName = path.basename(absPath);
  await fsp.rename(absPath, path.join(bucket, fileName));
  const index = await readTrashIndex(root.path);
  index.push({
    id,
    name: fileName,
    originalPath: rel,
    isDir: st.isDirectory(),
    size: st.isDirectory() ? 0 : st.size,
    deletedAt: stamp.toISOString(),
  });
  await writeTrashIndex(root.path, index);
  return id;
}

// ---------------------------------------------------------------- 静态文件

async function serveStatic(req, res, urlPath) {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  rel = decodeURIComponent(rel).replace(/^\/+/, '');
  const abs = path.join(PUBLIC_DIR, rel);
  if (!abs.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('forbidden'); return; }
  try {
    const data = await fsp.readFile(abs);
    res.writeHead(200, {
      'Content-Type': MIME[extOf(abs)] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
}

// ---------------------------------------------------------------- 文件流（支持 Range）

function streamFile(req, res, absPath, opts) {
  const download = !!(opts && opts.download);
  let st;
  try { st = fs.statSync(absPath); }
  catch { throw new HttpError(404, '文件不存在'); }
  if (st.isDirectory()) throw new HttpError(400, '这是一个文件夹');

  const ext = extOf(absPath);
  const type = MIME[ext] || 'application/octet-stream';
  const name = path.basename(absPath);
  const headers = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=60',
  };
  if (download) {
    headers['Content-Disposition'] =
      `attachment; filename="${encodeURIComponent(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`;
  }

  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
    if (m) {
      let start = m[1] === '' ? null : parseInt(m[1], 10);
      let end = m[2] === '' ? null : parseInt(m[2], 10);
      if (start === null && end === null) { /* 忽略 */ }
      else {
        if (start === null) { start = Math.max(0, st.size - end); end = st.size - 1; }
        else if (end === null || end >= st.size) { end = st.size - 1; }
        if (start > end || start >= st.size) {
          res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
          res.end();
          return;
        }
        headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
        headers['Content-Length'] = end - start + 1;
        res.writeHead(206, headers);
        fs.createReadStream(absPath, { start, end }).pipe(res);
        return;
      }
    }
  }
  headers['Content-Length'] = st.size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(absPath).pipe(res);
}

// ---------------------------------------------------------------- 目录列举

async function statEntry(dirAbs, dirent) {
  const abs = path.join(dirAbs, dirent.name);
  let st = null;
  try { st = await fsp.stat(abs); } catch { return null; }
  const isDir = st.isDirectory();
  return {
    name: dirent.name,
    isDir,
    size: isDir ? 0 : st.size,
    mtime: st.mtimeMs,
    ctime: st.ctimeMs,
    kind: isDir ? 'folder' : kindOf(dirent.name),
    ext: isDir ? '' : extOf(dirent.name),
    hidden: dirent.name.startsWith('.') || dirent.name === 'Thumbs.db' || dirent.name === 'desktop.ini',
  };
}

/**
 * 判断一个目录下是否还有子目录。
 * 用 opendir 流式读取，一旦找到第一个子目录就立刻返回，
 * 避免为了一个三角箭头把上千个文件的目录整个读完。
 */
async function hasSubDir(abs) {
  let dir;
  try { dir = await fsp.opendir(abs); }
  catch { return false; }
  try {
    for await (const d of dir) {
      if (d.isDirectory() && !d.name.startsWith('.') && d.name !== RECYCLE_NAME) return true;
    }
  } catch { /* 权限等问题按「没有下级」处理 */ }
  finally { try { await dir.close(); } catch { /* ignore */ } }
  return false;
}

async function listDir(rootPath, relPath) {
  const abs = resolveSafe(rootPath, relPath);
  let dirents;
  try { dirents = await fsp.readdir(abs, { withFileTypes: true }); }
  catch (e) {
    if (e.code === 'ENOENT') throw new HttpError(404, '文件夹不存在');
    if (e.code === 'ENOTDIR') throw new HttpError(400, '这不是文件夹');
    throw e;
  }
  const settled = await Promise.all(dirents.map((d) => statEntry(abs, d)));
  let entries = settled.filter(Boolean);
  // 默认隐藏 .recycle 与系统垃圾文件；showHidden 打开后仍不显示回收站本体
  entries = entries.filter((e) => e.name !== RECYCLE_NAME);
  if (!config.showHidden) entries = entries.filter((e) => !e.hidden);
  return { abs, entries };
}

/** 服务端排序 —— 分页之后排序必须在这里做，否则只排当前页 */
function sortEntries(list, sort) {
  const [key, dir] = String(sort || 'name-asc').split('-');
  const mul = dir === 'asc' ? 1 : -1;
  return list.slice().sort((a, b) => {
    let r = 0;
    if (key === 'mtime') r = (a.mtime || 0) - (b.mtime || 0);
    else if (key === 'size') r = (a.size || 0) - (b.size || 0);
    else r = a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true });
    return r * mul;
  });
}

/**
 * 把「当前视图 + 路径 + 筛选」解析成完整条目列表。
 * /api/list 用它做分页；批量操作用它拿【全部】——
 * 这样「全选整个目录」就不会被分页截断。
 */
async function resolveScope(scope) {
  const root = getRoot(scope.root);
  const rel = scope.path || '';
  const view = scope.view || '';
  const gid = scope.gid || '';
  const filter = scope.filter || 'all';

  const { entries } = await listDir(root.path, rel);
  const folders = entries.filter((e) => e.isDir);
  let files = entries.filter((e) => !e.isDir);

  let vgroupsOut = null, looseCount = 0;
  if (view === 'loose' || view === 'vgroup' || rel === '') {
    // 复用这次 readdir 的结果，不再重复扫盘（只算文件，文件夹不算散文件）
    const names = new Set(files.map((e) => e.name));
    const clean = await readGroupsClean(root, names);
    vgroupsOut = clean.groups;
    looseCount = clean.looseCount;
    if (view === 'loose' || view === 'vgroup') {
      const assigned = new Set();
      for (const g of clean.groups) for (const f of g.files) assigned.add(f);
      if (view === 'loose') files = files.filter((f) => !assigned.has(f.name));
      else {
        const g = clean.groups.find((x) => x.id === gid);
        files = g ? files.filter((f) => g.files.includes(f.name)) : [];
      }
    }
  }
  if (filter !== 'all') files = files.filter((f) => f.kind === filter);

  return { root, rel, view, gid, folders: view ? [] : folders, files, vgroups: vgroupsOut, looseCount };
}

/** 批量接口入参：给明确 items，或给 scope（= 全选当前视图的全部文件） */
async function expandItems(b) {
  if (Array.isArray(b.items) && b.items.length) return b.items;
  if (!b.scope) return [];
  const s = await resolveScope(b.scope);
  const mk = (name) => ({ root: s.root.id, path: s.rel ? `${s.rel}/${name}` : name });
  const out = s.files.map((f) => mk(f.name));
  if (b.includeFolders) out.push(...s.folders.map((f) => mk(f.name)));
  return out;
}

// ---------------------------------------------------------------- 收件箱：Edge 同步 + 新文件监听
//
// 干的事：Edge 下载完（或任何手动拷进素材夹）的文件一落到根目录顶层，就弹「入库卡片」
// 问「进哪个库 + 要不要改名」，而不是等用户自己去翻目录。
//
// 三条硬规矩：
//   ① 收件箱目录不在网页里单独配 —— 直接同步 Edge 的 download.default_directory，
//      改 Edge 就生效，避免"改一次要改两处"
//   ② 只认「根目录顶层的新增文件」，且必须等大小稳定（同名 .crdownload 消失）才算下载完成
//   ③ 网页自己产生的文件（上传/改名/移动/恢复）必须登记忽略，否则自己弹自己

const INBOX_TICK = 1500;              // 目录事件去抖：等一会儿再扫，避免下一个文件来三次事件扫三遍
const INBOX_IGNORE_MS = 60 * 1000;    // 自产文件的忽略时间窗

const inboxPending = new Map();       // id -> item（等用户决定进哪个库）
const inboxClients = new Set();       // SSE 连接
const inboxIgnored = new Map();       // 绝对路径(小写) -> 忽略截止时间
const inboxKnown = new Map();         // rootId -> Set<文件名>（上一轮扫描的快照）
const inboxWatchers = new Map();      // rootId -> { watcher, timer }

const inboxSleep = (ms) => new Promise((r) => setTimeout(r, ms));

function edgeUserDataDir() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return path.join(local, 'Microsoft', 'Edge', 'User Data');
}

/**
 * 同步 Edge 的下载设置。
 * 读各 profile 的 Preferences → download.default_directory / prompt_for_download；
 * 读到用 Edge 的，读不到回退系统「下载」文件夹。
 */
async function readEdgePrefs() {
  const out = { available: false, source: 'system', profile: '', dir: '', prompt: false, profiles: [], error: '' };
  const base = edgeUserDataDir();
  let names = [];
  try {
    names = (await fsp.readdir(base, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && (d.name === 'Default' || /^Profile \d+$/.test(d.name)))
      .map((d) => d.name);
  } catch {
    out.error = '读不到 Edge 用户数据目录';
  }
  // Default 排最前，优先用它
  names.sort((a, b) => (a === 'Default' ? -1 : b === 'Default' ? 1 : a.localeCompare(b)));
  for (const name of names) {
    try {
      const raw = await fsp.readFile(path.join(base, name, 'Preferences'), 'utf8');
      const j = JSON.parse(raw);
      const dl = j.download || {};
      out.profiles.push({
        profile: name,
        dir: dl.default_directory || (j.savefile && j.savefile.default_directory) || '',
        prompt: dl.prompt_for_download === true,
      });
    } catch { /* 这个 profile 读不了就跳 */ }
  }
  const pick = out.profiles.find((x) => x.dir) || out.profiles[0];
  if (pick && pick.dir) {
    out.available = true; out.source = 'edge';
    out.profile = pick.profile; out.dir = pick.dir; out.prompt = pick.prompt;
  } else {
    out.dir = path.join(os.homedir(), 'Downloads');
    if (!out.error) out.error = 'Edge 里没读到下载目录，已回退系统下载文件夹';
  }
  return out;
}

/** 网页自己写入的文件：登记忽略，否则监听器会把自己的操作当成"新下载" */
function markSelfWrite(absPath) {
  if (!absPath) return;
  const abs = path.resolve(absPath);
  inboxIgnored.set(abs.toLowerCase(), Date.now() + INBOX_IGNORE_MS);
  for (const r of config.roots) {
    if (path.dirname(abs).toLowerCase() === r.path.toLowerCase()) {
      const known = inboxKnown.get(r.id);
      if (known) known.add(path.basename(abs));    // 双保险：直接写进快照
    }
  }
}

function isSelfWrite(absPath) {
  const key = path.resolve(absPath).toLowerCase();
  const until = inboxIgnored.get(key);
  if (!until) return false;
  if (until < Date.now()) { inboxIgnored.delete(key); return false; }
  return true;
}

async function snapshotTop(root) {
  const set = new Set();
  try {
    const ds = await fsp.readdir(root.path, { withFileTypes: true });
    for (const d of ds) if (d.isFile() && !d.name.startsWith('.')) set.add(d.name);
  } catch { /* 读不到就当空目录 */ }
  return set;
}

function sseSend(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of inboxClients) {
    try { res.write(payload); } catch { inboxClients.delete(res); }
  }
}

/** 等文件写完：同级还有 .crdownload、或大小还在变，都不算下载完成 */
async function waitFileReady(abs) {
  const crd = abs + '.crdownload';
  for (let i = 0; i < 24; i++) {
    const a = await fsp.stat(abs).catch(() => null);
    if (!a || !a.isFile()) return null;
    await inboxSleep(700);
    const b = await fsp.stat(abs).catch(() => null);
    if (!b || !b.isFile()) return null;
    if (b.size === a.size && b.size > 0 && !fs.existsSync(crd)) return b;
  }
  return null;   // 一直没稳定（比如大文件还在下），这轮放弃
}

/** 文件名"有没有意义"：命中设置里的 smartRules 正则就算没意义 */
function matchSmartRule(name) {
  const base = path.basename(name, path.extname(name));
  for (const r of (Array.isArray(config.smartRules) ? config.smartRules : [])) {
    try { if (new RegExp(r.pattern).test(base)) return r.name || '规则命中'; } catch { /* 正则写错就跳过 */ }
  }
  return '';
}

function queueInboxItem(root, name, st, extra) {
  const ext = path.extname(name);
  const item = Object.assign({
    id: 'nx' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    root: root.id, rootName: root.name, rootPath: root.path,
    name, base: path.basename(name, ext), ext,
    size: st.size, mtime: st.mtimeMs, at: Date.now(),
  }, extra || {});
  inboxPending.set(item.id, item);
  LOG(`[收件箱] 新文件 ${name} -> 待用户选择（${item.reason}）`);
  sseSend('inbox', item);
  return item;
}

/**
 * 入库：把 srcRoot 顶层的 name 放到目标位置，可选改名，可选加进虚拟分类。
 * target = { root, path, gid, kind }，kind: dir | vgroup | root
 * newBase 只给「主名」，后缀强制沿用原后缀 —— 用户改不出没后缀的文件。
 */
async function ingestFile(srcRoot, name, target, newBase) {
  const srcAbs = path.join(srcRoot.path, name);
  const tRoot = (target && target.root) ? getRoot(target.root) : srcRoot;
  const kind = (target && target.kind) || 'root';
  const destDirAbs = kind === 'vgroup' ? tRoot.path : resolveSafe(tRoot.path, (target && target.path) || '');
  const dst = await fsp.stat(destDirAbs).catch(() => null);
  if (!dst || !dst.isDirectory()) throw new HttpError(404, '目标文件夹不存在：' + destDirAbs);

  const ext = path.extname(name);
  let finalName = name;
  if (newBase != null && String(newBase).trim() !== '' && String(newBase).trim() + ext !== name) {
    finalName = assertValidName(String(newBase).trim() + ext);
  }

  const srcDirAbs = path.dirname(srcAbs);
  let destAbs = path.join(destDirAbs, finalName);
  const sameName = destAbs.toLowerCase() === srcAbs.toLowerCase();

  if (!sameName) {
    if (fs.existsSync(destAbs)) destAbs = path.join(destDirAbs, uniqueName(destDirAbs, finalName));
    try {
      await fsp.rename(srcAbs, destAbs);
    } catch (e) {
      if (e.code === 'EXDEV') {                      // 跨盘：先复制再删
        await fsp.cp(srcAbs, destAbs, { recursive: false });
        await fsp.rm(srcAbs, { force: true });
      } else throw e;
    }
  }
  markSelfWrite(destAbs);

  const finalBase = path.basename(destAbs);
  if (kind === 'vgroup' && target.gid) {
    const g = groupsOf(tRoot).find((x) => x.id === target.gid);
    if (g) {
      const set = new Set(Array.isArray(g.files) ? g.files : []);
      set.add(finalBase);
      g.files = Array.from(set);
      saveVGroupsFile();
    }
  }

  // 记住落点：下次「全自动」直接往这儿放
  config.lastIngestTarget = {
    root: tRoot.id,
    path: toRel(tRoot.path, destDirAbs),
    gid: kind === 'vgroup' ? String(target.gid || '') : '',
  };
  saveConfig();

  return { name: finalBase, root: tRoot.id, path: toRel(tRoot.path, destAbs), from: toRel(srcRoot.path, srcAbs), kind };
}

/** 「全自动：直接入库不打扰」/ smart 判定为"名字有意义"时走这里 */
async function autoIngestQuiet(root, name) {
  const t = config.lastIngestTarget;
  if (!t || !t.root) return null;                    // 还没选过落点：就留在原地，等用户自己归类
  try {
    return await ingestFile(root, name, { root: t.root, path: t.path || '', gid: t.gid || '', kind: t.gid ? 'vgroup' : 'root' }, null);
  } catch (e) {
    LOG(`[收件箱] 自动入库失败 ${name}: ${e.message}`);
    return null;
  }
}

/** 扫一个根目录的顶层，找出"新增的文件"并按策略分派 */
async function scanRoot(root) {
  const known = inboxKnown.get(root.id) || new Set();
  const now = await snapshotTop(root);
  const added = [];
  for (const n of now) if (!known.has(n)) added.push(n);
  inboxKnown.set(root.id, now);
  if (!added.length) return;

  const t = Date.now();
  for (const [k, v] of inboxIgnored) if (v < t) inboxIgnored.delete(k);

  for (const name of added) {
    const abs = path.join(root.path, name);
    if (isSelfWrite(abs)) continue;
    const st = await waitFileReady(abs);
    if (!st) {
      // 还没写完：从快照里撤回，过几秒再看一次
      const set = inboxKnown.get(root.id);
      if (set) set.delete(name);
      setTimeout(() => { scanRoot(root).catch(() => { }); }, 4000);
      continue;
    }
    const rule = matchSmartRule(name);
    const policy = config.autoPolicy;
    if (policy === 'never' || (policy === 'smart' && !rule)) {
      const r = await autoIngestQuiet(root, name);
      LOG(`[收件箱] 静默入库 ${name}${r ? ' -> ' + r.path : '（未设置落点，留在原处）'}`);
      sseSend('inbox-done', { name, to: r ? r.path : '', action: 'auto' });
      continue;
    }
    queueInboxItem(root, name, st, { reason: policy === 'smart' ? `文件名无意义（${rule}）` : '总是询问' });
  }
}

function stopInbox() {
  for (const [, w] of inboxWatchers) {
    try { w.watcher.close(); } catch { /* 已关就算了 */ }
    if (w.timer) clearTimeout(w.timer);
  }
  inboxWatchers.clear();
}

/** （重新）挂上所有根目录的监听。roots 变了、开关变了都要重来一遍 */
async function startInbox() {
  stopInbox();
  if (config.inboxEnabled === false) { LOG('[收件箱] 已关闭监听'); return; }
  let ok = 0;
  for (const root of config.roots) {
    if (!fs.existsSync(root.path)) continue;
    inboxKnown.set(root.id, await snapshotTop(root));   // 先立快照：已有的文件不算"新到的"
    try {
      const watcher = fs.watch(root.path, { persistent: true }, () => {
        const w = inboxWatchers.get(root.id);
        if (!w) return;
        if (w.timer) clearTimeout(w.timer);
        w.timer = setTimeout(() => { scanRoot(root).catch((e) => LOG('[收件箱] 扫描失败: ' + e.message)); }, INBOX_TICK);
      });
      watcher.on('error', () => { /* 目录被删/拔盘：忽略，下次启动重来 */ });
      inboxWatchers.set(root.id, { watcher, timer: null });
      ok++;
    } catch (e) {
      LOG(`[收件箱] 无法监听 ${root.path}: ${e.message}`);
    }
  }
  const edge = await readEdgePrefs();
  LOG(`[收件箱] 监听 ${ok}/${config.roots.length} 个根目录 · Edge 下载目录：${edge.dir}${edge.prompt ? '（Edge 开着"下载前询问保存位置"）' : ''}`);
}

/** 可选入库位置：每个根的文件夹（限深）+ 虚拟分类 + 根目录本身（散-未归类） */
async function listIngestTargets() {
  const out = [];
  for (const root of config.roots) {
    out.push({
      kind: 'root', root: root.id, path: '', gid: '',
      label: `📦 ${root.name} — 根目录（散-未归类）`,
    });
    let count = 0;
    const queue = [{ abs: root.path, rel: '', d: 0 }];
    while (queue.length && count < 400) {
      const cur = queue.shift();
      if (cur.d >= 3) continue;
      let ds = [];
      try { ds = await fsp.readdir(cur.abs, { withFileTypes: true }); } catch { continue; }
      for (const d of ds) {
        if (!d.isDirectory() || d.name.startsWith('.') || d.name === RECYCLE_NAME) continue;
        const rel = cur.rel ? cur.rel + '/' + d.name : d.name;
        out.push({ kind: 'dir', root: root.id, path: rel, gid: '', label: `📁 ${root.name} › ${rel}` });
        if (++count >= 400) break;
        queue.push({ abs: path.join(cur.abs, d.name), rel, d: cur.d + 1 });
      }
    }
    for (const g of groupsOf(root)) {
      out.push({ kind: 'vgroup', root: root.id, path: '', gid: g.id, label: `🗂 ${g.name}（虚拟分类）` });
    }
  }
  return { targets: out, lastTarget: config.lastIngestTarget || null };
}

// ---------------------------------------------------------------- 路由

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  let parsed;
  try {
    parsed = new URL(req.url, 'http://localhost');
  } catch {
    return sendError(res, new HttpError(400, '非法 URL'));
  }
  const p = parsed.pathname;
  const q = parsed.searchParams;

  // 排查用：记下每一个写操作请求（/api/file 是图片流、/api/events 是长连接，太频繁，跳过）
  if (p.startsWith('/api/') && p !== '/api/file' && p !== '/api/events') LOG(`${req.method} ${p}`);

  // 只允许豆包域名跨域读这个本地服务（给浏览器扩展用）。
  // 用白名单而不是 *，否则任何网页都能读你硬盘上的东西。
  const origin = req.headers.origin || '';
  if (/^https?:\/\/([a-z0-9-]+\.)*doubao\.com(:\d+)?$/i.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    // ---- 静态资源
    if (!p.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendError(res, new HttpError(405, '方法不允许'));
      return await serveStatic(req, res, p);
    }

    const body = () => readJSONBody(req);

    // ============================ 配置 / 根目录 ============================
    if (p === '/api/config' && req.method === 'GET') {
      return sendJSON(res, 200, {
        title: config.title,
        roots: config.roots.map((r) => ({ id: r.id, name: r.name, path: r.path, exists: fs.existsSync(r.path) })),
        autoPolicy: config.autoPolicy,
        inboxEnabled: config.inboxEnabled !== false,
        lastIngestTarget: config.lastIngestTarget || null,
        showHidden: config.showHidden,
        projectTemplate: config.projectTemplate,
        smartRules: config.smartRules,
        limits: config.limits,          // 阈值以服务端为单一数据源，前端不再自己写死
        platform: process.platform,
      });
    }

    if (p === '/api/config' && req.method === 'POST') {
      const b = await body();
      const oldInbox = config.inboxEnabled !== false;
      if (typeof b.title === 'string') config.title = b.title;
      if (typeof b.autoPolicy === 'string') config.autoPolicy = b.autoPolicy;
      if (typeof b.inboxEnabled === 'boolean') config.inboxEnabled = b.inboxEnabled;
      if (typeof b.showHidden === 'boolean') config.showHidden = b.showHidden;
      if (Array.isArray(b.projectTemplate)) config.projectTemplate = b.projectTemplate.map(String);
      saveConfig();
      if (oldInbox !== (config.inboxEnabled !== false)) startInbox().catch(() => { });
      return sendJSON(res, 200, { ok: true, config });
    }

    // ============================ 收件箱（新文件到达） ============================

    // 同步到的 Edge 下载设置 —— 网页里只读展示，配置源始终是 Edge 自己
    if (p === '/api/edge' && req.method === 'GET') {
      const edge = await readEdgePrefs();
      const abs = path.resolve(edge.dir).toLowerCase();
      const managed = config.roots.find((r) => {
        const a = r.path.toLowerCase();
        return a === abs || abs.startsWith(a + path.sep);
      });
      return sendJSON(res, 200, Object.assign(edge, {
        managed: managed ? { id: managed.id, name: managed.name, path: managed.path } : null,
        policy: config.autoPolicy,
        enabled: config.inboxEnabled !== false,
        lastTarget: config.lastIngestTarget || null,
        pending: inboxPending.size,
      }));
    }

    // SSE：新文件到达时主动推给页面，不用前端轮询
    if (p === '/api/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });
      res.write('retry: 3000\n\n');
      inboxClients.add(res);
      const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* 断线了 */ } }, 25000);
      req.on('close', () => { clearInterval(ping); inboxClients.delete(res); });
      return;
    }

    // 还没处理的新文件（页面刷新 / 服务重启后的兜底）
    if (p === '/api/inbox' && req.method === 'GET') {
      return sendJSON(res, 200, {
        pending: Array.from(inboxPending.values()),
        enabled: config.inboxEnabled !== false,
        policy: config.autoPolicy,
        lastTarget: config.lastIngestTarget || null,
      });
    }

    if (p === '/api/inbox/targets' && req.method === 'GET') {
      return sendJSON(res, 200, await listIngestTargets());
    }

    // 入库 / 跳过
    if (p === '/api/inbox/ingest' && req.method === 'POST') {
      const b = await body();
      const item = inboxPending.get(String(b.id || ''));
      if (!item) throw new HttpError(404, '这条新文件记录已经处理过了');
      const srcRoot = getRoot(item.root);
      let result = null;
      if (b.action === 'skip') {
        LOG(`[收件箱] 跳过 ${item.name}（留在原处）`);
      } else {
        const t = b.target || {};
        result = await ingestFile(srcRoot, item.name, {
          root: t.root || item.root,
          path: t.path || '',
          gid: t.gid || '',
          kind: t.kind || 'root',
        }, b.name);
        LOG(`[收件箱] 入库 ${item.name} -> ${result.path}${result.name !== item.name ? `（已改名 ${result.name}）` : ''}`);
      }
      inboxPending.delete(item.id);
      sseSend('inbox-done', { id: item.id, name: item.name, to: result ? result.path : '', action: b.action === 'skip' ? 'skip' : 'ingest' });
      return sendJSON(res, 200, { ok: true, result });
    }

    if (p === '/api/roots' && req.method === 'POST') {
      const b = await body();
      const rawPath = String(b.path || '').trim();
      if (!rawPath) throw new HttpError(400, '请提供文件夹路径');
      const abs = path.resolve(rawPath);
      const st = await fsp.stat(abs).catch(() => null);
      if (!st || !st.isDirectory()) throw new HttpError(400, '文件夹不存在或不是目录：' + abs);
      const dup = config.roots.find((r) => r.path.toLowerCase() === abs.toLowerCase());
      if (dup) return sendJSON(res, 200, { ok: true, root: dup, existed: true });
      const root = { id: `r${++rootSeq}_${Date.now().toString(36)}`, name: String(b.name || path.basename(abs) || abs), path: abs };
      config.roots.push(root);
      saveConfig();
      startInbox().catch(() => { });      // 新挂的文件夹也要被监听
      return sendJSON(res, 200, { ok: true, root });
    }

    if (p.startsWith('/api/roots/') && req.method === 'DELETE') {
      const id = decodeURIComponent(p.slice('/api/roots/'.length));
      const i = config.roots.findIndex((r) => r.id === id);
      if (i < 0) throw new HttpError(404, '根目录不存在');
      config.roots.splice(i, 1);
      saveConfig();
      startInbox().catch(() => { });      // 摘掉的文件夹别再监听
      return sendJSON(res, 200, { ok: true });
    }

    // ============================ 磁盘浏览（用于选择文件夹） ============================
    if (p === '/api/fs/drives' && req.method === 'GET') {
      return sendJSON(res, 200, { drives: await listDrives(), home: os.homedir(), app: APP_DIR });
    }

    if (p === '/api/fs/dirs' && req.method === 'GET') {
      const raw = q.get('path');
      const abs = raw ? path.resolve(raw) : os.homedir();
      let dirents;
      try { dirents = await fsp.readdir(abs, { withFileTypes: true }); }
      catch (e) { throw new HttpError(400, '无法读取目录：' + e.message); }
      const dirs = dirents.filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== '$RECYCLE.BIN' && d.name !== 'System Volume Information')
        .map((d) => ({ name: d.name, path: path.join(abs, d.name) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true }));
      const parent = path.dirname(abs);
      return sendJSON(res, 200, {
        path: abs,
        parent: parent && parent !== abs ? parent : null,
        dirs,
        roots: await listDrives(),
      });
    }

    // ============================ 目录列举 ============================
    if (p === '/api/list' && req.method === 'GET') {
      const offset = Math.max(0, parseInt(q.get('offset') || '0', 10) || 0);
      const limit = Math.min(config.limits.pageMax,
        Math.max(1, parseInt(q.get('limit') || '', 10) || config.limits.pageDefault));
      const sort = q.get('sort') || 'name-asc';

      const s = await resolveScope({
        root: q.get('root'), path: q.get('path'),
        view: q.get('view'), gid: q.get('gid'), filter: q.get('filter'),
      });

      const ordered = sortEntries(s.files, sort);
      const total = ordered.length;
      const page = ordered.slice(offset, offset + limit);
      const parent = s.rel ? s.rel.split('/').slice(0, -1).join('/') : null;

      return sendJSON(res, 200, {
        root: { id: s.root.id, name: s.root.name, path: s.root.path },
        path: s.rel,
        parent,
        view: s.view, gid: s.gid,
        folders: sortEntries(s.folders, sort),   // 文件夹是导航入口，不分页
        files: page,
        total, offset, limit,
        hasMore: offset + page.length < total,
        vgroups: s.vgroups,
        looseCount: s.looseCount,
        hasRecycle: fs.existsSync(trashDirOf(s.root.path)),
      });
    }

    // 轻量目录树（懒加载一层）
    if (p === '/api/tree' && req.method === 'GET') {
      const root = getRoot(q.get('root'));
      const rel = q.get('path') || '';
      const abs = resolveSafe(root.path, rel);
      let dirents = [];
      try { dirents = await fsp.readdir(abs, { withFileTypes: true }); } catch { dirents = []; }
      const visible = dirents.filter((d) => !d.name.startsWith('.') && d.name !== RECYCLE_NAME);
      // 只有根目录需要知道「有多少散文件」，前端靠它决定要不要显示「散-未归类」虚拟节点
      const looseCount = rel === '' ? visible.filter((d) => d.isFile()).length : 0;
      const dirs = visible
        .filter((d) => d.isDirectory())
        .map((d) => ({ name: d.name, path: (rel ? rel + '/' : '') + d.name }));
      dirs.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true }));
      // 并发探测每个子目录是否还有下级，让前端一开始就把三角画对
      const withFlag = await Promise.all(dirs.map(async (d) => {
        const childAbs = path.join(abs, d.name);
        return { name: d.name, path: d.path, hasChildren: await hasSubDir(childAbs) };
      }));
      return sendJSON(res, 200, { path: rel, dirs: withFlag, hasChildren: withFlag.length > 0, looseCount });
    }

    // ============================ 文件读取 / 下载 ============================
    if (p === '/api/file' && (req.method === 'GET' || req.method === 'HEAD')) {
      const root = getRoot(q.get('root'));
      const abs = resolveSafe(root.path, q.get('path') || '');
      return streamFile(req, res, abs, { download: q.get('download') === '1' });
    }

    if (p === '/api/text' && req.method === 'GET') {
      const root = getRoot(q.get('root'));
      const abs = resolveSafe(root.path, q.get('path') || '');
      const st = await fsp.stat(abs).catch(() => null);
      if (!st || !st.isFile()) throw new HttpError(404, '文件不存在');
      if (st.size > config.limits.textPreviewBytes) {
        const mb = Math.round(config.limits.textPreviewBytes / 1048576);
        throw new HttpError(413, `文件过大，无法在线预览（超过 ${mb}MB）`);
      }
      const buf = await fsp.readFile(abs);
      if (buf.includes(0)) throw new HttpError(415, '这是二进制文件，无法以文本预览');
      return sendJSON(res, 200, { content: buf.toString('utf8'), size: st.size, mtime: st.mtimeMs });
    }

    if (p === '/api/text' && req.method === 'POST') {
      const b = await body();
      const root = getRoot(b.root);
      const abs = resolveSafe(root.path, b.path || '');
      await fsp.writeFile(abs, String(b.content == null ? '' : b.content), 'utf8');
      markSelfWrite(abs);
      return sendJSON(res, 200, { ok: true });
    }

    // ============================ 上传 ============================
    if (p === '/api/upload' && req.method === 'PUT') {
      const root = getRoot(q.get('root'));
      const dirAbs = resolveSafe(root.path, q.get('path') || '');
      const name = assertValidName(decodeURIComponent(q.get('name') || ''));
      const overwrite = q.get('overwrite') === '1';
      const st = await fsp.stat(dirAbs).catch(() => null);
      if (!st || !st.isDirectory()) throw new HttpError(404, '目标文件夹不存在');
      let target = path.join(dirAbs, name);
      if (fs.existsSync(target) && !overwrite) target = path.join(dirAbs, uniqueName(dirAbs, name));
      const ws = fs.createWriteStream(target);
      await new Promise((resolve, reject) => {
        req.on('error', reject);
        ws.on('error', reject);
        ws.on('finish', resolve);
        req.pipe(ws);
      });
      const st2 = await fsp.stat(target);
      markSelfWrite(target);          // 自己传的，别让收件箱再弹一次
      return sendJSON(res, 200, { ok: true, name: path.basename(target), size: st2.size });
    }

    // ============================ 新建文件夹 ============================
    if (p === '/api/mkdir' && req.method === 'POST') {
      const b = await body();
      const root = getRoot(b.root);
      const parentAbs = resolveSafe(root.path, b.path || '');
      const name = assertValidName(b.name);
      const target = path.join(parentAbs, name);
      if (fs.existsSync(target)) throw new HttpError(409, '同名文件夹或文件已存在');
      await fsp.mkdir(target, { recursive: true });
      return sendJSON(res, 200, { ok: true, path: toRel(root.path, target) });
    }

    // 按模板批量创建项目目录
    if (p === '/api/mkdir-template' && req.method === 'POST') {
      const b = await body();
      const root = getRoot(b.root);
      const parentAbs = resolveSafe(root.path, b.path || '');
      const name = assertValidName(b.name);
      const subs = Array.isArray(b.template) && b.template.length ? b.template.map(String) : config.projectTemplate;
      const projectAbs = path.join(parentAbs, name);
      if (fs.existsSync(projectAbs)) throw new HttpError(409, '同名文件夹已存在');
      await fsp.mkdir(projectAbs, { recursive: true });
      for (const s of subs) {
        const safe = assertValidName(s);
        await fsp.mkdir(path.join(projectAbs, safe), { recursive: true });
      }
      return sendJSON(res, 200, { ok: true, path: toRel(root.path, projectAbs), created: subs });
    }

    // ============================ 重命名 ============================
    if (p === '/api/rename' && req.method === 'POST') {
      const b = await body();
      const root = getRoot(b.root);
      const abs = resolveSafe(root.path, b.path || '');
      const name = assertValidName(b.newName);
      const st = await fsp.stat(abs).catch(() => null);
      if (!st) throw new HttpError(404, '文件不存在');
      const target = path.join(path.dirname(abs), name);
      if (target.toLowerCase() !== abs.toLowerCase() && fs.existsSync(target)) throw new HttpError(409, '同名文件已存在');
      await fsp.rename(abs, target);
      markSelfWrite(target);
      return sendJSON(res, 200, { ok: true, path: toRel(root.path, target), name });
    }

    // ============================ 批量重命名（前缀 + 序号） ============================
    if (p === '/api/rename-batch' && req.method === 'POST') {
      const b = await body();
      const root = getRoot(b.root || (b.scope && b.scope.root));
      let items;
      if (b.scope) {
        const s = await resolveScope(b.scope);
        items = s.files.map((f) => (s.rel ? `${s.rel}/${f.name}` : f.name));
      } else {
        items = Array.isArray(b.items) ? b.items : [];
      }
      const prefix = String(b.prefix == null ? '' : b.prefix);
      const start = Number.isFinite(Number(b.start)) ? Number(b.start) : 1;
      const pad = Math.min(6, Math.max(1, Number(b.pad) || 3));
      const keepExt = b.keepExt !== false;
      const results = [];
      for (let i = 0; i < items.length; i++) {
        const abs = resolveSafe(root.path, items[i]);
        const st = await fsp.stat(abs).catch(() => null);
        if (!st) { results.push({ from: items[i], ok: false, error: '不存在' }); continue; }
        const ext = keepExt && st.isFile() ? path.extname(abs) : '';
        const num = String(start + i).padStart(pad, '0');
        const newName = assertValidName(`${prefix}${num}${ext}`);
        const target = path.join(path.dirname(abs), newName);
        if (target === abs) { results.push({ from: items[i], to: toRel(root.path, abs), ok: true, skipped: true }); continue; }
        if (fs.existsSync(target)) { results.push({ from: items[i], ok: false, error: '目标已存在：' + newName }); continue; }
        await fsp.rename(abs, target);
        markSelfWrite(target);
        results.push({ from: items[i], to: toRel(root.path, target), ok: true });
      }
      return sendJSON(res, 200, { ok: true, results });
    }

    // ============================ 移动 / 复制 ============================
    if ((p === '/api/move' || p === '/api/copy') && req.method === 'POST') {
      const b = await body();
      const isMove = p === '/api/move';
      const targetRoot = getRoot(b.targetRoot);
      const targetDirAbs = resolveSafe(targetRoot.path, b.targetPath || '');
      const tst = await fsp.stat(targetDirAbs).catch(() => null);
      if (!tst || !tst.isDirectory()) throw new HttpError(404, '目标文件夹不存在');
      const items = await expandItems(b);      // 支持 scope = 全选整个目录
      const results = [];
      for (const it of items) {
        try {
          const srcRoot = getRoot(it.root || b.sourceRoot);
          const srcAbs = resolveSafe(srcRoot.path, it.path);
          const st = await fsp.stat(srcAbs);
          if (st.isDirectory() && targetDirAbs.toLowerCase().startsWith(srcAbs.toLowerCase() + path.sep)) {
            throw new Error('不能把文件夹移动到它自己的子目录');
          }
          if (path.dirname(srcAbs).toLowerCase() === targetDirAbs.toLowerCase()) {
            results.push({ from: it.path, ok: true, skipped: true, reason: '已在目标位置' });
            continue;
          }
          const name = uniqueName(targetDirAbs, path.basename(srcAbs));
          const dest = path.join(targetDirAbs, name);
          if (isMove) await fsp.rename(srcAbs, dest);
          else await fsp.cp(srcAbs, dest, { recursive: true });
          markSelfWrite(dest);
          results.push({ from: it.path, to: toRel(targetRoot.path, dest), ok: true });
        } catch (e) {
          results.push({ from: it.path, ok: false, error: e.message });
        }
      }
      return sendJSON(res, 200, { ok: true, results });
    }

    // ============================ 删除 -> 回收站 ============================
    if (p === '/api/delete' && req.method === 'POST') {
      const b = await body();
      const items = await expandItems(b);      // 支持 scope = 全选整个目录
      const results = [];
      for (const it of items) {
        try {
          const root = getRoot(it.root);
          const abs = resolveSafe(root.path, it.path);
          const st = await fsp.stat(abs).catch(() => null);
          if (!st) throw new Error('不存在');
          const id = await moveToTrash(root, it.path, abs);
          results.push({ from: it.path, ok: true, trashId: id });
        } catch (e) {
          results.push({ from: it.path, ok: false, error: e.message });
        }
      }
      return sendJSON(res, 200, { ok: true, results });
    }

    // ============================ 回收站 ============================
    if (p === '/api/trash' && req.method === 'GET') {
      const root = getRoot(q.get('root'));
      const index = await readTrashIndex(root.path);
      const alive = [];
      for (const it of index) {
        const dir = path.join(trashDirOf(root.path), it.id);
        const exists = fs.existsSync(dir);
        if (!it.isDir && exists) {
          try {
            const files = await fsp.readdir(dir);
            if (!files.length) continue;
          } catch { /* ignore */ }
        }
        if (exists) alive.push(it);
      }
      alive.sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
      return sendJSON(res, 200, { root: root.id, items: alive });
    }

    if (p === '/api/trash/restore' && req.method === 'POST') {
      const b = await body();
      const root = getRoot(b.root);
      const ids = Array.isArray(b.ids) ? b.ids.map(String) : [String(b.id || '')];
      const index = await readTrashIndex(root.path);
      const results = [];
      for (const id of ids) {
        const rec = index.find((x) => x.id === id);
        if (!rec) { results.push({ id, ok: false, error: '记录不存在' }); continue; }
        try {
          const bucket = path.join(trashDirOf(root.path), id);
          const srcAbs = path.join(bucket, rec.name);
          const destDir = resolveSafe(root.path, path.dirname(rec.originalPath) === '.' ? '' : path.dirname(rec.originalPath));
          await fsp.mkdir(destDir, { recursive: true });
          const destName = uniqueName(destDir, rec.name);
          await fsp.rename(srcAbs, path.join(destDir, destName));
          await fsp.rm(bucket, { recursive: true, force: true });
          markSelfWrite(path.join(destDir, destName));
          results.push({ id, ok: true, path: toRel(root.path, path.join(destDir, destName)) });
        } catch (e) { results.push({ id, ok: false, error: e.message }); }
      }
      const remain = (await readTrashIndex(root.path)).filter((x) => !ids.includes(x.id));
      await writeTrashIndex(root.path, remain);
      return sendJSON(res, 200, { ok: true, results });
    }

    if (p === '/api/trash/purge' && req.method === 'POST') {
      const b = await body();
      const root = getRoot(b.root);
      const ids = Array.isArray(b.ids) ? b.ids.map(String) : null;
      const index = await readTrashIndex(root.path);
      const targets = ids ? index.filter((x) => ids.includes(x.id)) : index;
      for (const rec of targets) {
        await fsp.rm(path.join(trashDirOf(root.path), rec.id), { recursive: true, force: true });
      }
      const remain = ids ? index.filter((x) => !ids.includes(x.id)) : [];
      await writeTrashIndex(root.path, remain);
      return sendJSON(res, 200, { ok: true, purged: targets.length });
    }

    // ============================ 搜索 ============================
    if (p === '/api/search' && req.method === 'GET') {
      const root = getRoot(q.get('root'));
      const kw = String(q.get('q') || '').trim().toLowerCase();
      const baseRel = q.get('path') || '';
      if (!kw) return sendJSON(res, 200, { results: [], truncated: false });
      const maxResults = config.limits.searchMax;
      const maxDepth = config.limits.searchDepth;
      const results = [];
      let truncated = false;
      const queue = [{ rel: baseRel, depth: 0 }];
      const baseAbs = resolveSafe(root.path, baseRel);
      while (queue.length && !truncated) {
        const cur = queue.shift();
        const abs = resolveSafe(root.path, cur.rel);
        let dirents;
        try { dirents = await fsp.readdir(abs, { withFileTypes: true }); } catch { continue; }
        for (const d of dirents) {
          if (d.name.startsWith('.') && d.name !== RECYCLE_NAME) continue;
          const childRel = cur.rel ? `${cur.rel}/${d.name}` : d.name;
          if (d.name.toLowerCase().includes(kw)) {
            const info = await statEntry(abs, d);
            if (info) results.push(Object.assign(info, { path: childRel }));
            if (results.length >= maxResults) { truncated = true; break; }
          }
          if (d.isDirectory() && cur.depth < maxDepth) queue.push({ rel: childRel, depth: cur.depth + 1 });
        }
      }
      const ordered = sortEntries(results, q.get('sort') || 'name-asc');
      const offset = Math.max(0, parseInt(q.get('offset') || '0', 10) || 0);
      const limit = Math.min(config.limits.searchMax,
        Math.max(1, parseInt(q.get('limit') || '', 10) || config.limits.searchDefault));
      const page = ordered.slice(offset, offset + limit);
      return sendJSON(res, 200, {
        results: page,
        total: ordered.length,
        offset, limit,
        hasMore: offset + page.length < ordered.length,
        truncated,
        base: toRel(root.path, baseAbs),
      });
    }

    // ============================ 虚拟分类（只记引用，不动文件） ============================
    if (p === '/api/vgroups' && req.method === 'GET') {
      const root = getRoot(q.get('root'));
      return sendJSON(res, 200, await readGroupsClean(root));
    }

    if (p === '/api/vgroups' && req.method === 'POST') {
      const b = await body();
      const root = getRoot(b.root || (b.scope && b.scope.root));
      const name = assertValidName(b.name);
      const groups = groupsOf(root);
      if (groups.some((g) => g.name === name)) throw new HttpError(409, '已经有同名的虚拟分类了');
      const files = b.scope
        ? (await resolveScope(b.scope)).files.map((f) => f.name)
        : (Array.isArray(b.files) ? b.files.map(String) : []);
      const g = {
        id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name,
        files,
      };
      groups.push(g);
      saveVGroupsFile();
      return sendJSON(res, 200, { ok: true, group: g });
    }

    if (p === '/api/vgroups/update' && req.method === 'POST') {
      const b = await body();
      const root = getRoot(b.root);
      const g = groupsOf(root).find((x) => x.id === b.id);
      if (!g) throw new HttpError(404, '虚拟分类不存在');
      if (b.name != null) g.name = assertValidName(b.name);
      if (Array.isArray(b.files)) g.files = b.files.map(String);
      saveVGroupsFile();
      return sendJSON(res, 200, { ok: true, group: g });
    }

    // 把文件加入 / 移出虚拟分类（不移动文件本体）
    if (p === '/api/vgroups/assign' && req.method === 'POST') {
      const b = await body();
      const root = getRoot(b.root || (b.scope && b.scope.root));
      const files = b.scope
        ? (await resolveScope(b.scope)).files.map((f) => f.name)
        : (Array.isArray(b.files) ? b.files.map(String) : []);
      const mode = b.mode === 'remove' ? 'remove' : 'add';
      const targets = b.id ? groupsOf(root).filter((g) => g.id === b.id) : groupsOf(root);
      for (const g of targets) {
        const set = new Set(Array.isArray(g.files) ? g.files : []);
        for (const f of files) { if (mode === 'add') set.add(f); else set.delete(f); }
        g.files = Array.from(set);
      }
      saveVGroupsFile();
      return sendJSON(res, 200, { ok: true, changed: targets.length });
    }

    // 删除虚拟分类本身 —— 只解散分组，文件一个都不会少
    if (p === '/api/vgroups/delete' && req.method === 'POST') {
      const b = await body();
      const root = getRoot(b.root);
      const groups = groupsOf(root);
      const i = groups.findIndex((x) => x.id === b.id);
      if (i < 0) throw new HttpError(404, '虚拟分类不存在');
      groups.splice(i, 1);
      saveVGroupsFile();
      return sendJSON(res, 200, { ok: true });
    }

    // 虚拟分类 -> 实体文件夹（落地）
    // mode='move' 平移：原文件移进新文件夹，根目录不再保留
    // mode='copy' 复制：原文件留在根目录，新文件夹里放一份副本
    if (p === '/api/vgroups/materialize' && req.method === 'POST') {
      const b = await body();
      const root = getRoot(b.root);
      const mode = b.mode === 'copy' ? 'copy' : 'move';
      const groups = groupsOf(root);
      const g = groups.find((x) => x.id === b.id);
      if (!g) throw new HttpError(404, '虚拟分类不存在');

      const folderName = assertValidName(b.folderName || g.name);
      // 目标文件夹建在根目录下，重名就自动加序号，绝不覆盖已有目录
      let destDir = path.join(root.path, folderName);
      if (fs.existsSync(destDir)) destDir = path.join(root.path, uniqueName(root.path, folderName));
      await fsp.mkdir(destDir, { recursive: true });

      const results = [];
      for (const f of (Array.isArray(g.files) ? g.files : [])) {
        try {
          const src = resolveSafe(root.path, f);
          const st = await fsp.stat(src).catch(() => null);
          if (!st || !st.isFile()) { results.push({ file: f, ok: false, error: '文件已不存在' }); continue; }
          const destName = uniqueName(destDir, path.basename(f));
          const dest = path.join(destDir, destName);
          if (mode === 'move') await fsp.rename(src, dest);
          else await fsp.copyFile(src, dest);
          results.push({ file: f, to: toRel(root.path, dest), ok: true });
        } catch (e) {
          results.push({ file: f, ok: false, error: e.message });
        }
      }

      const okList = results.filter((x) => x.ok);
      const failed = results.filter((x) => !x.ok);

      // 平移模式下文件已经不在根目录，引用自然失效：移走成功的从引用里摘掉，
      // 一个都不剩就把这个虚拟分类删掉（文件都在新文件夹里了，分组使命完成）
      if (mode === 'move' && okList.length) {
        const moved = new Set(okList.map((x) => x.file));
        g.files = (Array.isArray(g.files) ? g.files : []).filter((f) => !moved.has(f));
        if (!g.files.length) {
          const i = groups.findIndex((x) => x.id === g.id);
          if (i >= 0) groups.splice(i, 1);
        }
      }
      saveVGroupsFile();

      return sendJSON(res, 200, {
        ok: true,
        mode,
        folder: toRel(root.path, destDir),
        folderName: path.basename(destDir),
        created: okList.length,
        failed: failed.length,
        results,
      });
    }

    // ============================ 重复文件检测 ============================
    if (p === '/api/duplicates' && req.method === 'GET') {
      const root = getRoot(q.get('root'));
      const rel = q.get('path') || '';
      const { entries } = await listDir(root.path, rel);
      const byKey = new Map();
      for (const e of entries) {
        if (e.isDir) continue;
        const key = `${e.size}:${path.basename(e.name, e.ext).replace(/\s*\(\d+\)\s*$/, '')}${e.ext}`;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(e.name);
      }
      const groups = [];
      for (const [key, names] of byKey) if (names.length > 1) groups.push({ key, names });
      return sendJSON(res, 200, { groups });
    }

    // ============================ 复制文件到系统剪贴板 ============================
    // 浏览器没法把文件交给别的程序（桌面端豆包之类），但剪贴板是跨应用的：
    // 把文件按 CF_HDROP 放进剪贴板，到目标程序里 Ctrl+V 就行。
    if (p === '/api/clipboard' && req.method === 'POST') {
      LOG('clipboard: >>> 收到请求');
      const b = await body();
      const items = await expandItems(b);
      LOG(`clipboard: 解析出 ${items.length} 项`);
      if (!items.length) throw new HttpError(400, '没有选中任何文件');
      if (process.platform !== 'win32') throw new HttpError(400, '这个功能目前只支持 Windows');

      const paths = [];
      for (const it of items) {
        try {
          const root = getRoot(it.root);
          const abs = resolveSafe(root.path, it.path);
          if (fs.existsSync(abs)) paths.push(abs);
        } catch { /* 跳过无效项 */ }
      }
      if (!paths.length) throw new HttpError(400, '选中的文件都不存在了');

      LOG(`clipboard: 有效路径 ${paths.length} 个 → ${paths.join(' ; ')}`);

      // 路径里可能有空格/括号/中文，用单引号转义后整块 Base64 传过去
      const list = paths.map((x) => `'${x.replace(/'/g, "''")}'`).join(',');
      LOG(`clipboard: 准备写入 ${paths.length} 个路径`);

      const PS_HEAD = `$ProgressPreference='SilentlyContinue'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; `;

      // 串行执行：剪贴板是全局独占资源，并发写会互相踩
      const { r, back } = await withClipboardLock(async () => {
        const res = await runCommand('powershell.exe',
          psArgs(`${PS_HEAD}Set-Clipboard -LiteralPath @(${list})`), 20000);
        // 写完回读一次 —— 判断是「没写进去」还是「写进去了但你粘不到」
        const chk = await runCommand('powershell.exe',
          psArgs(`${PS_HEAD}Get-Clipboard -Format FileDropList`), 20000);
        return { r: res, back: (chk.stdout || '(空)').trim().replace(/\s+/g, ' ') };
      });
      LOG(`clipboard: 退出码=${r.code}  stderr=${r.stderr ? cleanPsOutput(r.stderr, '').slice(0, 200) : '无'}`);
      LOG(`clipboard: 写完回读 = ${back.slice(0, 220)}`);
      if (r.code !== 0) {
        const detail = cleanPsOutput(r.stderr, r.stdout) || ('退出码 ' + r.code);
        throw new HttpError(500, '放进剪贴板失败：' + detail.slice(0, 220));
      }
      return sendJSON(res, 200, { ok: true, count: paths.length, paths });
    }

    // ============================ 在资源管理器中定位 ============================
    if (p === '/api/reveal' && req.method === 'POST') {
      const b = await body();
      const root = getRoot(b.root);
      const abs = resolveSafe(root.path, b.path || '');
      if (process.platform === 'win32') {
        const { spawn } = require('child_process');
        spawn('explorer.exe', ['/select,' + abs], { detached: true, stdio: 'ignore' }).unref();
      } else if (process.platform === 'darwin') {
        const { spawn } = require('child_process');
        spawn('open', ['-R', abs], { detached: true, stdio: 'ignore' }).unref();
      } else {
        const { spawn } = require('child_process');
        spawn('xdg-open', [path.dirname(abs)], { detached: true, stdio: 'ignore' }).unref();
      }
      return sendJSON(res, 200, { ok: true });
    }

    // ============================ 磁盘 / 系统信息 ============================
    if (p === '/api/sysinfo' && req.method === 'GET') {
      return sendJSON(res, 200, {
        platform: process.platform,
        node: process.version,
        host: config.host,
        port: config.port,
        home: os.homedir(),
        app: APP_DIR,
        uptime: process.uptime(),
        covers: await (async () => {
          try {
            const covers = [];
            for (const r of config.roots) {
              let a = null, b2 = null;
              try { const s = await fsp.statfs(r.path); a = s.bavail * s.bsize; b2 = s.blocks * s.bsize; } catch { }
              covers.push({ id: r.id, path: r.path, free: a, total: b2 });
            }
            return covers;
          } catch { return []; }
        })(),
      });
    }

    return sendError(res, new HttpError(404, '接口不存在: ' + p));
  } catch (err) {
    return sendError(res, err);
  } finally {
    if (process.env.DSH_FM_VERBOSE) {
      console.log(`${req.method} ${p} -> ${res.statusCode} (${Date.now() - started}ms)`);
    }
  }
});

// ---------------------------------------------------------------- 启动

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n[启动失败] 端口 ${config.port} 已被占用。`);
    console.error(`请换端口启动： node server.js --port ${config.port + 1}\n`);
  } else {
    console.error('[启动失败]', e.message);
  }
  process.exit(1);
});

/** 服务就绪后自动打开浏览器（启动.bat 传 --open 时启用） */
function openBrowser(url) {
  try {
    const { spawn } = require('child_process');
    if (process.platform === 'win32') {
      spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch { /* 打不开就算了，用户手动访问即可 */ }
}

server.listen(config.port, config.host, () => {
  const url = `http://${config.host === '0.0.0.0' ? '127.0.0.1' : config.host}:${config.port}`;
  console.log('');
  console.log('  ┌────────────────────────────────────────────┐');
  console.log('  │        漫剧素材管理器  已启动              │');
  console.log('  └────────────────────────────────────────────┘');
  console.log('');
  console.log('   浏览器打开： ' + url);
  console.log('   程序目录：   ' + APP_DIR);
  console.log('   已挂载根目录： ' + (config.roots.length ? config.roots.map((r) => r.name + ' -> ' + r.path).join('\n                  ') : '(无，请在网页里点「添加文件夹」)'));
  console.log('');
  console.log('   按 Ctrl+C 停止服务');
  console.log('');
  if (process.argv.includes('--open')) openBrowser(url);
  // 收件箱：给所有已挂载根目录挂上"新文件到达"监听（Edge 下载完就弹入库卡片）
  startInbox().catch((e) => console.error('[收件箱] 启动监听失败:', e.message));
});

function addRoot(p, name, quiet) {
  const abs = path.resolve(p);
  if (config.roots.some((r) => r.path.toLowerCase() === abs.toLowerCase())) return null;
  const root = { id: `r${++rootSeq}_${Date.now().toString(36)}`, name: name || path.basename(abs) || abs, path: abs };
  config.roots.push(root);
  if (!quiet) saveConfig();
  return root;
}

process.on('SIGINT', () => {
  console.log('\n服务已停止。');
  process.exit(0);
});
