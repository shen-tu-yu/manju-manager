#!/usr/bin/env node
'use strict';

/**
 * 刷新 CODE_MAP.index.md —— 精确行号索引，**全部由脚本生成**。
 *
 * 为什么要有这个文件：
 *   行号是易失信息。以前把行号写进手写的 CODE_MAP.md，每次改代码就整体位移，
 *   于是要手工重刷几十处行号 —— 又慢又容易漏。
 *   现在分工：CODE_MAP.md 手写「职责 / 规则 / 踩坑」，永不含行号；
 *   行号一律由本脚本生成到 CODE_MAP.index.md。改完代码跑一条命令就行。
 *
 * 用法：
 *   node map.js             刷新 CODE_MAP.index.md
 *   node map.js --print     只打印到控制台，不落盘
 *   node map.js inbox       按关键词直接查行号（最常用）
 *
 * 零依赖，只用 Node 原生模块。
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'CODE_MAP.index.md');
// 从 server.js 拆出去的模块：lib/ 下有几个 .js 就收几个 —— 以后新增模块**不用改这里**
const LIB = fs.existsSync(path.join(ROOT, 'lib'))
  ? fs.readdirSync(path.join(ROOT, 'lib')).filter((f) => f.endsWith('.js')).sort().map((f) => 'lib/' + f)
  : [];
const SOURCES = ['server.js', 'db.js', 'launcher.js', 'browsers.js',
  'public/app.js', 'public/index.html', 'public/style.css', ...LIB];

/** 函数定义 / 常量定义 */
const RE_FUNC = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/;
const RE_ARROW = /^const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/;
const RE_CONST = /^const\s+([A-Za-z_$][\w$]*)\s*=/;

/** 路由：if ((p === '/api/x' || p === '/api/y') && req.method === 'POST') */
const RE_IF = /^\s*if\s*\(.*p\s*(?:===|\.startsWith)/;
const RE_METHOD = /req\.method\s*===\s*'(\w+)'/;
const RE_PATH = /p(?:\.startsWith)?\s*===\s*'([^']+)'|p\.startsWith\('([^']+)'\)/g;

function readLines(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf8').split('\n');
}

const cut = (s, n = 72) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** 往上找最近的注释，当作这个符号的说明 */
function describe(lines, idx) {
  for (let i = idx - 1; i >= Math.max(0, idx - 6); i--) {
    const t = lines[i].trim();
    if (!t) { if (i < idx - 1) break; continue; }
    if (t.startsWith('*') || t.startsWith('/**') || t.startsWith('/*')) {
      const txt = t.replace(/^\/?\*+\s?/, '').replace(/\*\/\s*$/, '').trim();
      if (txt && !/^=+$/.test(txt) && !txt.startsWith('====')) return cut(txt);
      continue;
    }
    if (t.startsWith('//')) {
      const txt = t.slice(2).trim();
      if (txt && !/^=+$/.test(txt) && !txt.startsWith('====')) return cut(txt);
      continue;
    }
    break;
  }
  return '';
}

/** 扫一个文件，抽出路由 / 函数 / 常量 */
function scan(rel) {
  const lines = readLines(rel);
  if (!lines) return null;
  const routes = [], funcs = [], consts = [];
  lines.forEach((line, i) => {
    const no = i + 1;
    if (rel === 'server.js' && RE_IF.test(line)) {
      const paths = [];
      let m;
      RE_PATH.lastIndex = 0;
      while ((m = RE_PATH.exec(line))) {
        const p = m[1] || m[2];
        if (p && p.startsWith('/api/') && p !== '/api/') paths.push(p);
      }
      if (paths.length) {
        const mm = RE_METHOD.exec(line);
        routes.push({ no, method: mm ? mm[1] : '', paths });
      }
    }
    const f = RE_FUNC.exec(line);
    if (f) { funcs.push({ no, name: f[1], desc: describe(lines, i) }); return; }
    const a = RE_ARROW.exec(line) || RE_CONST.exec(line);
    if (a && /^(server|db|launcher|browsers|public\/app)\.js$/.test(rel)) {
      consts.push({ no, name: a[1], desc: describe(lines, i) });
    }
  });
  return { lines: lines.length, routes, funcs, consts };
}

function build() {
  const out = [];
  const stamp = new Date().toLocaleString('zh-CN', { hour12: false });
  out.push('# 代码索引 CODE_MAP.index');
  out.push('');
  out.push('> **本文件由 `node map.js` 自动生成，不要手改。**');
  out.push('> 职责、规则、踩坑、排查表在 **[`CODE_MAP.md`](CODE_MAP.md)**（那份不含行号，所以不用维护）。');
  out.push(`> 生成时间：${stamp}`);
  out.push('');
  out.push('查行号最快的办法：`node map.js <关键词>`（例：`node map.js 收件箱`）。');
  out.push('');

  const scanned = {};
  out.push('## 一、文件行数');
  out.push('');
  out.push('| 文件 | 行数 |');
  out.push('|---|---|');
  for (const rel of SOURCES) {
    const s = scan(rel);
    scanned[rel] = s;
    out.push(`| \`${rel}\` | ${s ? s.lines : '（不存在）'} |`);
  }
  out.push('');

  const srv = scanned['server.js'];
  if (srv) {
    out.push(`## 二、后端路由（${srv.routes.length} 个分支，全在 \`http.createServer\` 里）`);
    out.push('');
    out.push('| 行 | 方法 | 路由 |');
    out.push('|---|---|---|');
    for (const r of srv.routes) out.push(`| ${r.no} | ${r.method} | ${r.paths.map((p) => '`' + p + '`').join(' · ')} |`);
    out.push('');
    out.push(`## 三、后端函数 / 常量（${srv.funcs.length} 个函数）`);
    out.push('');
    out.push('| 行 | 名字 | 说明 |');
    out.push('|---|---|---|');
    for (const f of srv.funcs) out.push(`| ${f.no} | \`${f.name}()\` | ${f.desc} |`);
    out.push('');
  }

  const app = scanned['public/app.js'];
  if (app) {
    out.push(`## 四、前端函数 / 常量（${app.funcs.length} 个函数）`);
    out.push('');
    out.push('| 行 | 名字 | 说明 |');
    out.push('|---|---|---|');
    for (const f of app.funcs) out.push(`| ${f.no} | \`${f.name}()\` | ${f.desc} |`);
    out.push('');
    if (app.consts.length) {
      out.push('### 前端顶层常量');
      out.push('');
      out.push('| 行 | 名字 | 说明 |');
      out.push('|---|---|---|');
      for (const c of app.consts) out.push(`| ${c.no} | \`${c.name}\` | ${c.desc} |`);
      out.push('');
    }
  }

  // 其余模块（数据层 / 启动器 / 浏览器发现 / 拆出去的子模块）
  // —— 加新模块只要放进 SOURCES/LIB，这里跟着走：OTHERS 与 SOURCES 同源
  const OTHERS = ['db.js', 'launcher.js', 'browsers.js', ...LIB];
  const NUM = ['五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];
  OTHERS.forEach((rel, idx) => {
    const m = scanned[rel];
    if (!m) return;
    out.push(`## ${NUM[idx] || '附'}、${rel}（${m.lines} 行）`);
    out.push('');
    out.push('| 行 | 名字 | 说明 |');
    out.push('|---|---|---|');
    for (const f of m.funcs) out.push(`| ${f.no} | \`${f.name}()\` | ${f.desc} |`);
    out.push('');
  });

  return out.join('\n') + '\n';
}

/* ---------------- 关键词查询模式 ---------------- */
const args = process.argv.slice(2);
const kw = args.find((a) => !a.startsWith('-'));

if (kw) {
  const key = kw.toLowerCase();
  let hit = 0;
  for (const rel of SOURCES) {
    const lines = readLines(rel);
    if (!lines) continue;
    lines.forEach((line, i) => {
      if (line.toLowerCase().includes(key)) {
        console.log(`${rel}:${i + 1}  ${line.trim().slice(0, 120)}`);
        hit++;
      }
    });
  }
  console.log(`\n命中 ${hit} 行（文件:行号  原文）`);
  process.exit(0);
}

const text = build();
if (args.includes('--print')) {
  console.log(text);
} else {
  fs.writeFileSync(OUT, text, 'utf8');
  const n = text.split('\n').length;
  console.log(`已刷新 ${path.basename(OUT)}（${n} 行）`);
}
