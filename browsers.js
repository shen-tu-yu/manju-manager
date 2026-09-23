'use strict';

/**
 * 发现这台电脑上装了哪些浏览器 —— **不写死任何安装路径**。
 *
 * 来源按可靠度排序，任何一个失败都不影响其它（全部 try 住）：
 *   ① 注册表 Clients\StartMenuInternet —— Windows 官方登记浏览器的地方，
 *      装在哪个盘都会在这里出现（HKLM 和 HKCU 两处都查，用户级安装的也在）
 *   ② 注册表 App Paths\<exe> —— 安装程序登记的完整路径
 *   ③ 常见安装路径 —— 只在上面都没命中时兜底（绿色版 / 注册表被清理过）
 *   ④ PATH 查找
 *
 * 所以：**加新浏览器不用改代码**，只要它按 Windows 规范注册，①就会带出来；
 * 实在发现不了，启动器里还能手动粘贴 exe 路径。
 *
 * 注：注册表那两条要走 `reg.exe`（Node 没有内置注册表 API）。
 * 若运行环境禁止起子进程，①②会静默失败，自动退到 ③④ —— 功能不中断，只是列表短一些。
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { TextDecoder } = require('util');

const IS_WIN = process.platform === 'win32';

/* ---------------- 已知浏览器的友好名 + 常见安装位置 ---------------- */

const KNOWN = [
  { exe: 'chrome.exe', name: 'Google Chrome', rel: ['Google\\Chrome\\Application\\chrome.exe'] },
  { exe: 'msedge.exe', name: 'Microsoft Edge', rel: ['Microsoft\\Edge\\Application\\msedge.exe'] },
  { exe: 'firefox.exe', name: 'Mozilla Firefox', rel: ['Mozilla Firefox\\firefox.exe'] },
  { exe: 'brave.exe', name: 'Brave', rel: ['BraveSoftware\\Brave-Browser\\Application\\brave.exe'] },
  { exe: 'vivaldi.exe', name: 'Vivaldi', rel: [] },
  { exe: 'opera.exe', name: 'Opera', rel: [] },
  { exe: '360se.exe', name: '360 安全浏览器', rel: [] },
  { exe: '360chrome.exe', name: '360 极速浏览器', rel: [] },
  { exe: 'sogouexplorer.exe', name: '搜狗浏览器', rel: [] },
  { exe: 'qqbrowser.exe', name: 'QQ 浏览器', rel: [] },
];

/** exe 名 → 友好名（注册表里叫 "Google Chrome" 的，兜底路径里也叫 "Google Chrome"） */
function friendlyName(exe) {
  const hit = KNOWN.find((k) => k.exe.toLowerCase() === String(exe || '').toLowerCase());
  return hit ? hit.name : String(exe || '').replace(/\.exe$/i, '');
}

/* ---------------- 注册表读取 ---------------- */

/**
 * 跑 reg.exe 查询。返回文本（失败返回空串，绝不抛）。
 * 中文 Windows 的 reg 输出是 GBK，直接按 utf8 读会乱码，所以拿 Buffer 自己解码。
 */
function regQuery(args) {
  if (!IS_WIN) return '';
  try {
    const buf = execFileSync('reg', args, { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    const gbk = new TextDecoder('gbk', { fatal: false }).decode(buf);
    return gbk.includes('\uFFFD') ? buf.toString('utf8') : gbk;
  } catch {
    return '';   // 键不存在 / 没权限 / 不许起子进程
  }
}

/** 从 reg 输出里取 REG_SZ 的值 */
function regValue(out) {
  const m = String(out).match(/REG_(?:SZ|EXPAND_SZ)\s+([^\r\n]+)/);
  return m ? m[1].trim() : '';
}

/** `"C:\x\chrome.exe" --single-argument` → `C:\x\chrome.exe` */
function exeFromCommand(cmd) {
  const s = String(cmd || '').trim();
  if (!s) return '';
  if (s[0] === '"') {
    const end = s.indexOf('"', 1);
    return end > 1 ? s.slice(1, end) : '';
  }
  const m = s.match(/^(.+?\.exe)\b/i);
  return m ? m[1] : s.split(/\s+/)[0];
}

/* ---------------- 四个来源 ---------------- */

/** ① StartMenuInternet：系统里"注册为浏览器"的都在这里（装哪个盘都躲不掉） */
function fromStartMenu() {
  const out = [];
  for (const hive of ['HKLM', 'HKCU']) {
    const base = `${hive}\\SOFTWARE\\Clients\\StartMenuInternet`;
    const listing = regQuery(['query', base]);
    if (!listing) continue;
    for (const line of listing.split(/\r?\n/)) {
      const m = line.match(/^\s*HKEY_[A-Z_]+\\[^\r\n]*?\\StartMenuInternet\\([^\\\r\n]+)\s*$/);
      if (!m) continue;
      const key = m[1];
      if (/^iexplore/i.test(key)) continue;                 // 老 IE 的残留登记，不是能用的浏览器
      const cmd = regValue(regQuery(['query', `${base}\\${key}\\shell\\open\\command`, '/ve']));
      const exe = exeFromCommand(cmd);
      if (exe) out.push({ name: key, path: exe, source: 'StartMenuInternet' });
    }
  }
  return out;
}

/** ② App Paths：安装程序登记的完整路径 */
function fromAppPaths() {
  const out = [];
  for (const hive of ['HKLM', 'HKCU']) {
    for (const k of KNOWN) {
      const key = `${hive}\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${k.exe}`;
      const v = regValue(regQuery(['query', key, '/ve']));
      if (v) out.push({ name: k.name, path: v, source: 'App Paths' });
    }
  }
  return out;
}

/** ③ 常见安装路径（兜底：绿色版 / 注册表没登记的） */
function fromCommonPaths() {
  if (!IS_WIN) return [];
  const env = process.env;
  const roots = [env.LOCALAPPDATA, env.ProgramFiles, env['ProgramFiles(x86)'], env.ProgramW6432].filter(Boolean);
  const out = [];
  for (const k of KNOWN) {
    for (const rel of k.rel) {
      for (const r of roots) {
        const p = path.join(r, rel);
        try { if (fs.existsSync(p)) out.push({ name: k.name, path: p, source: '常见路径' }); } catch { /* 忽略 */ }
      }
    }
  }
  return out;
}

/** ④ PATH 查找 */
function fromPath() {
  const out = [];
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const k of KNOWN) {
      try {
        const p = path.join(dir, k.exe);
        if (fs.existsSync(p)) out.push({ name: k.name, path: p, source: 'PATH' });
      } catch { /* 忽略 */ }
    }
  }
  return out;
}

/** 非 Windows：给几个常见位置（macOS / Linux） */
function discoverUnix() {
  const cands = process.platform === 'darwin'
    ? [['Google Chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
      ['Microsoft Edge', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
      ['Mozilla Firefox', '/Applications/Firefox.app/Contents/MacOS/firefox']]
    : [['Google Chrome', '/usr/bin/google-chrome'], ['Chromium', '/usr/bin/chromium'],
      ['Mozilla Firefox', '/usr/bin/firefox'], ['Microsoft Edge', '/usr/bin/microsoft-edge']];
  return cands.filter(([, p]) => { try { return fs.existsSync(p); } catch { return false; } })
    .map(([name, p]) => ({ name, path: p, source: '常见路径' }));
}

/* ---------------- 汇总 ---------------- */

let cache = null;                    // 进程内缓存 30 秒：设置面板会被反复打开
let cacheAt = 0;

/** 列出本机浏览器：[{ name, path, source }]，按可靠度去重 */
function discover(force) {
  const now = Date.now();
  if (!force && cache && now - cacheAt < 30000) return cache;
  const all = IS_WIN
    ? [...fromStartMenu(), ...fromAppPaths(), ...fromCommonPaths(), ...fromPath()]
    : discoverUnix();
  const seenPath = new Set();
  const seenName = new Set();
  cache = all.filter((b) => {
    let ok = false;
    try { ok = !!b.path && fs.existsSync(b.path); } catch { ok = false; }
    if (!ok) return false;                              // 注册表可能残留，路径不存在就别列
    const kp = b.path.toLowerCase();
    const kn = b.name.toLowerCase();
    if (seenPath.has(kp) || seenName.has(kn)) return false;
    seenPath.add(kp); seenName.add(kn);
    return true;
  });
  cacheAt = now;
  return cache;
}

/**
 * 把"用户说的那个东西"解析成 exe 路径。
 * 接受：完整路径 / 浏览器名（Google Chrome）/ exe 名（chrome.exe）/ 简称（chrome）/ 'default'。
 */
function resolve(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s || s === 'default') return null;
  try { if (fs.existsSync(s)) return s; } catch { /* 不是路径，继续按名字找 */ }
  const low = s.toLowerCase().replace(/\.exe$/, '');
  const tail = low.split(/\s+/).pop();                  // "google chrome" → "chrome"
  const hit = discover().find((b) => {
    const bn = path.basename(b.path).toLowerCase().replace(/\.exe$/, '');
    return b.path.toLowerCase() === s.toLowerCase()
      || b.name.toLowerCase() === low
      || bn === low
      || bn === tail;
  });
  return hit ? hit.path : null;
}

module.exports = { discover, resolve, friendlyName, IS_WIN };
