#!/usr/bin/env node
'use strict';

/**
 * 启动器 —— 双击「启动.bat」进来的就是这个。
 *
 * 它干三件事：
 *   ① 把"启动前想预设的东西"摆成一个菜单（浏览器、是否自动打开、端口…）
 *   ② 把选择记在 launcher.json，下次回车直接用（不用每次重选）
 *   ③ 带着这些选择去拉起 server.js
 *
 * ═══════════════════════════════════════════════════════════════════
 * ★ 以后要加一个新的启动选项：只改下面 OPTIONS 这一张表。
 *   菜单、记忆、命令行拼装、连"手动输入"入口都会自动带上，别处不用动。
 *
 *   每一项长这样：
 *     key     存进 launcher.json 的字段名，也是命令行直通时用的名字
 *     title   菜单上显示的名字
 *     def     没选过时的默认值
 *     choices () => [{ value, label, note }]  —— 可以动态生成（比如扫注册表）
 *     args    (值) => ['--传给server的参数', ...]  —— 后端认这个参数就行
 *     custom  非空则提供"手动输入"入口，字符串是提示语
 *     type    'list'（默认，给几个选项）| 'text'（自由文本）
 *
 *   后端要支持新参数：在 server.js 的 applyArgv() 里加一行认它即可。
 * ═══════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');
const browsers = require('./browsers');

const DIR = __dirname;
const STORE = path.join(DIR, 'launcher.json');   // 记住选择（运行时数据，已 gitignore）

const OPTIONS = [
  {
    key: 'browser',
    title: '用哪个浏览器打开',
    def: 'default',
    type: 'list',
    // 动态发现：装哪个盘都能找到，加新浏览器不用改代码（见 browsers.js）
    choices: () => [
      { value: 'default', label: '系统默认浏览器', note: '跟着 Windows 的默认设置走' },
      ...browsers.discover().map((b) => ({ value: b.path, label: b.name, note: `${b.path}  [${b.source}]` })),
    ],
    args: (v) => (v && v !== 'default' ? ['--browser-exe=' + v] : []),
    custom: '浏览器 exe 的完整路径（比如装在 D 盘、绿色版）',
  },
  {
    key: 'autoOpen',
    title: '启动后自动打开页面',
    def: 'yes',
    type: 'list',
    choices: () => [
      { value: 'yes', label: '自动打开（推荐）' },
      { value: 'no', label: '不打开，我自己点' },
    ],
    args: (v) => (v === 'no' ? [] : ['--open']),
  },
  {
    key: 'port',
    title: '端口',
    def: '8899',
    type: 'list',
    choices: () => [
      { value: '8899', label: '8899（默认）' },
      { value: '8898', label: '8898' },
      { value: '8900', label: '8900' },
    ],
    args: (v) => ['--port=' + v],
    custom: '自定义端口号（1~65535）',
  },
  // ==== 下一个选项照抄上面任意一项的形状加在这里即可 ====
];

/* ---------------- 记忆 ---------------- */

function loadValues() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(STORE, 'utf8')) || {}; } catch { /* 第一次跑，文件还不存在 */ }
  const v = {};
  for (const o of OPTIONS) {
    const raw = saved[o.key];
    v[o.key] = (raw == null || raw === '') ? o.def : String(raw);
  }
  return v;
}

function saveValues(v) {
  try { fs.writeFileSync(STORE, JSON.stringify(v, null, 2), 'utf8'); } catch { /* 存不了就算了，下次用默认 */ }
}

/* ---------------- 启动 ---------------- */

function buildArgs(values) {
  const args = ['server.js'];
  for (const o of OPTIONS) {
    const extra = typeof o.args === 'function' ? o.args(values[o.key]) : [];
    for (const a of (extra || [])) args.push(a);
  }
  return args;
}

const prettyArgs = (args) => args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ');

function start(values) {
  const args = buildArgs(values);
  console.log('');
  console.log('  ▶ 启动： node ' + prettyArgs(args));
  console.log('');
  const child = spawn(process.execPath, args, { cwd: DIR, stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    if (signal) process.exit(0);
    process.exit(code == null ? 0 : code);
  });
}

/* ---------------- 菜单 ---------------- */

const ask = (rl, q) => new Promise((r) => rl.question(q, r));

function refreshChoices() {
  for (const o of OPTIONS) {
    try { o._choices = o.choices() || []; } catch { o._choices = []; }
  }
}

/** 菜单上显示当前值：优先显示选项的 label，找不到就原样显示 */
function currentText(o, v) {
  if (o.type === 'text') return String(v);
  const hit = (o._choices || []).find((c) => c.value === v);
  if (hit) return hit.label;
  const base = path.basename(String(v));
  return base || String(v);
}

function render(values) {
  refreshChoices();
  console.log('');
  console.log('  ┌────────────────────────────────────────────────────┐');
  console.log('  │          漫剧素材管理器 · 启动器                   │');
  console.log('  └────────────────────────────────────────────────────┘');
  console.log('');
  OPTIONS.forEach((o, i) => {
    console.log(`   ${String(i + 1).padStart(2)}. ${o.title.padEnd(20, '　')} ${currentText(o, values[o.key])}`);
  });
  console.log('');
  console.log('   回车 = 就这样启动      输入编号 = 改这一项      r = 恢复默认      q = 退出');
  console.log('');
}

async function editOption(rl, opt, values) {
  refreshChoices();
  const list = opt._choices || [];
  console.log('');
  if (opt.type === 'text') {
    const v = (await ask(rl, `  ${opt.title}（当前 ${values[opt.key]}）：`)).trim();
    if (v) { values[opt.key] = v; console.log('  ✓ 已设为 ' + v); }
    return;
  }
  list.forEach((c, i) => {
    console.log(`   ${String(i + 1).padStart(2)}. ${c.label}${c.note ? '    ' + c.note : ''}`);
  });
  const customIdx = list.length + 1;
  if (opt.custom) console.log(`   ${String(customIdx).padStart(2)}. 手动输入 —— ${opt.custom}`);
  console.log('    0. 返回');
  const ans = (await ask(rl, '  > ')).trim();
  const n = Number(ans);
  if (!n) return;
  if (n >= 1 && n <= list.length) {
    values[opt.key] = list[n - 1].value;
    console.log('  ✓ 已设为 ' + list[n - 1].label);
    return;
  }
  if (opt.custom && n === customIdx) {
    const raw = (await ask(rl, '  粘贴/输入后回车：')).trim().replace(/^"(.*)"$/, '$1');
    if (!raw) return;
    if (opt.key === 'browser') {
      if (!fs.existsSync(raw)) { console.log('  ✗ 这个路径不存在，没保存'); return; }
    }
    values[opt.key] = raw;
    console.log('  ✓ 已设为 ' + raw);
  }
}

/** 命令行直通：node launcher.js browser=chrome port=8898 （给快捷方式用） */
function parseDirect(argv) {
  const out = {};
  for (const a of argv) {
    const m = a.match(/^([A-Za-z][\w-]*)=(.*)$/);
    if (m && OPTIONS.some((o) => o.key === m[1])) out[m[1]] = m[2];
  }
  return Object.keys(out).length ? out : null;
}

async function main() {
  const values = loadValues();

  const direct = parseDirect(process.argv.slice(2));
  if (direct) {                                  // 快捷方式：跳过菜单直接启动
    Object.assign(values, direct);
    saveValues(values);
    return start(values);
  }

  // 没有交互终端（被别的程序拉起）时别卡住，直接用记住的设置启动
  if (!process.stdin.isTTY) return start(values);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      render(values);
      const ans = (await ask(rl, '  > ')).trim();
      if (ans === '') { saveValues(values); rl.close(); return start(values); }
      if (/^q$/i.test(ans)) { rl.close(); console.log('\n  已取消。\n'); return; }
      if (/^r$/i.test(ans)) {
        for (const o of OPTIONS) values[o.key] = o.def;
        saveValues(values);
        console.log('  已恢复默认。');
        continue;
      }
      const n = Number(ans);
      if (!Number.isInteger(n) || n < 1 || n > OPTIONS.length) { console.log('  没有这个编号。'); continue; }
      await editOption(rl, OPTIONS[n - 1], values);
      saveValues(values);
    }
  } finally {
    try { rl.close(); } catch { /* 已经关了 */ }
  }
}

main().catch((e) => { console.error('启动器出错：' + e.message); process.exit(1); });
