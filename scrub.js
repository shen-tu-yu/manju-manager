/**
 * 推送前检查 / 体检。
 *
 *   node scrub.js            # 只检查并报告（默认，不动任何文件）
 *   node scrub.js --fix      # 执行清理
 *
 * 清理的是**要公开的文本里**不该出现的个人化措辞：
 *   · 需求方的**转述式引用**（某某说"…"这类）和"某某实测/某某要求"的口吻
 *   · 示例里的**作品名**（换成占位符）
 *   · 谈论"仓库自身整理"的话题（那本身就是线索）
 * **不动**正常说法（"用户目录""等用户决定"这类泛指），以及面向使用者的"你"。
 *
 * ⚠️ 只改**当前文件**；git 历史里的旧版本改不掉（要连历史一起改得重写历史 + force push）。
 */
const fs = require('fs');
const path = require('path');

const FILES = [
  'README.md', 'CHANGELOG.md', 'CODE_MAP.md', 'AGENTS.md', '.gitignore',
  'map.js', 'launcher.js', 'browsers.js', 'server.js', 'db.js',
  'public/index.html', 'public/app.js', 'public/style.css',
  'public/tools/install.html', 'public/tools/probe.html',
  'public/tools/doubao-helper.user.js', 'public/tools/doubao-helper.js',
  'extension/manifest.json', 'extension/content.js',
  '启动.bat',
];

// 有序规则表：长/具体的放前面，避免被短的先吃掉。
// 每条都写成**完整短语**（不是裸的"用户"），所以"用户目录"这类术语不会被误伤。
// ⚠️ 匹配模式里**不许出现需求方的原话**（这个文件是公开的！）—— 引用一律用 ["“”][^"“”]*["“”] 通配。
const RULES = [
  // —— 引用/口语原话：整句换掉，不保留原话 ——
  ['引用→中性（转述式）', /用户(?:回|说|要求)["“”][^"“”]*["“”][。.]?现在是/g, '后来改成'],
  ['引用→中性（弹窗那句）', /用户要求["“”][^"“”]*["“”](?= *——)/g, '要求：**所有弹窗都照这个来**'],
  ['原话：层级要明确', /用户(?:原话|明确要求)"层级要明确不能又被覆盖"/g, '要求"层级要明确、不能被覆盖"'],
  ['否掉过一次', /（用户明确否掉过一次）/g, '（被否掉过一次）'],
  // —— "谁提的要求"改成中性 ——
  ['用户要求：', /（用户要求：/g, '（'],
  ['（用户要求）', /（用户要求）/g, '（硬性要求）'],
  ['用户明确要求', /用户明确要求/g, '明确要求'],
  ['用户明确纠正过一次', /用户明确纠正过一次/g, '明确纠正过一次'],
  ['用户明确说不需要预设', /用户明确说不需要预设/g, '明确说过不需要预设'],
  ['用户明确要求层级感', /用户明确要求层级感/g, '要求有层级感'],
  ['用户实测：', /用户实测：/g, '实测：'],
  ['用户从 DevTools 实测给的', /用户从 DevTools 实测给的/g, '从 DevTools 实测得来'],
  ['用户从 DevTools 实测截图', /用户从 DevTools 实测截图/g, 'DevTools 实测截图'],
  ['（用户定的：', /（用户定的：/g, '（固定：'],
  ['（用户定的，改前先问）', /（用户定的，改前先问）/g, '（已定，改前先问）'],
  ['（用户选的：', /（用户选的：/g, '（'],
  ['（用户提的）：', /（用户提的）：/g, '：'],
  ['（用户已经提过）', /（用户已经提过）/g, '（已经提过）'],
  ['这正是用户要的', /这正是用户要的/g, '这正是要的效果'],
  // —— "用户"改成无主语/被动，句子照样通顺 ——
  ['不丢用户改过的东西', /不丢用户改过的东西/g, '不丢已经改过的内容'],
  ['用户改的就是原文', /用户改的就是原文/g, '这里改的就是原文'],
  ['用户可能改过', /用户可能改过/g, '可能被改过'],
  ['用户拉过（高度）', /用户拉过/g, '手动拉过'],
  ['（用户会以为缩放坏了）', /（用户会以为缩放坏了）/g, '（会以为缩放坏了）'],
  ['（这才是用户要的布局）', /（这才是用户要的布局）/g, '（这才是要保留的布局）'],
  ['否则用户以为', /否则用户以为/g, '否则会以为'],
  ['用户可以在工作台点', /用户可以在工作台点/g, '可以在工作台点'],
  ['用户也可以复制一份', /用户也可以复制一份/g, '也可以复制一份'],
  ['但只在用户操作时调用', /但只在用户操作时调用/g, '但只在交互时调用'],
  ['用户那份的 text 为空', /用户那份的 text 为空/g, '自己那份的 text 为空'],
  ['用户只看到', /用户只看到/g, '看到的只有'],
  ['看着像"用户跑去云盘页了"', /看着像"用户跑去云盘页了"/g, '看着像"跑去云盘页了"'],
  ['（用户明明在对话页）', /（用户明明在对话页）/g, '（人明明在对话页）'],
  ['用户实机不受影响', /用户实机不受影响/g, '实机不受影响'],
  ['用户还得手动删', /用户还得手动删/g, '还得手动删'],
  // —— 开发者自指 ——
  ['方便我按实际 DOM 适配', /方便我按实际 DOM 适配/g, '方便按实际 DOM 适配'],
  // —— 兜底：上面没覆盖到的"用户要求 X"一律改成"要求 X"（句子照样通顺）——
  ['用户要求（兜底）', /用户要求/g, '要求'],
  // —— 示例里的作品名换成占位符 ——
  ['作品名 域外恶魔', /域外恶魔/g, '示例角色'],
];

// 「改完必须为 0」的高危模式：跑完自检用
const MUST_BE_ZERO = [
  ['用户原话', /用户原话/],
  ['用户回"', /用户回"/],
  ['用户实测', /用户实测/],
  ['用户要求', /用户要求/],
  ['用户明确', /用户明确/],
  ['用户定的', /用户定的/],
  ['用户选的', /用户选的/],
  ['用户提的', /用户提的/],
  ['用户改过', /用户改过/],
  ['用户已经提过', /用户已经提过/],
  ['用户从 DevTools', /用户从 DevTools/],
  ['用户操作时', /用户操作时/],
  ['用户拉过', /用户拉过/],
  ['用户会以为', /用户会以为/],
  ['用户以为', /用户以为/],
  ['用户要的', /用户要的/],
  ['用户还得', /用户还得/],
  ['用户只看到', /用户只看到/],
  ['用户明明在', /用户明明在/],
  ['用户跑去', /用户跑去/],
  ['方便我按', /方便我按/],
  ['作品名', /域外恶魔/],
  ['本机用户名', /C:\\Users\\[^\\\s]+/],
  // ⚠️ 检测规则里**不许写具体值**（这个文件是公开的）—— 只描述"长什么样"
  ['邮箱样式（应统一为 xxx@localhost）', /[\w.+-]+@(?!localhost)[\w-]+\.(?:com|cn|net|org|io|me)\b/i],
  // 公开文件里别谈论"仓库自身的整理/清理" —— 那等于告诉读者"这儿有过要清理的东西"
  // （scrub.js 自己不在 FILES 里，所以规则本身含这些词不会误报）
  ['仓库自身整理话题', /个人痕迹|去痕迹|清理痕迹|隐私数据|个人信息/],
];

const FIX = process.argv.includes('--fix');
let totalHits = 0;
const perFile = [];

for (const f of FILES) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, 'utf8');
  const hits = [];
  for (const [name, re, to] of RULES) {
    const n = (s.match(re) || []).length;
    if (!n) continue;
    hits.push(`${name}×${n}`);
    totalHits += n;
    if (FIX) s = s.replace(re, to);
  }
  if (!hits.length) continue;
  perFile.push({ f, hits });
  if (FIX) fs.writeFileSync(f, s);
  else console.log(`${f}\n    ${hits.join('  ')}`);
}

console.log('\n════════ 清理结果 ════════');
if (!totalHits) console.log('没有需要清理的内容。');
else if (FIX) {
  console.log(`已清理 ${totalHits} 处：`);
  for (const { f, hits } of perFile) console.log(`  ${f}  ${hits.join('  ')}`);
  console.log('\n⚠️ 还差两步：① 重新生成脚本副本（node sync-copies 或手工同步三份）② node map.js');
} else {
  console.log(`发现 ${totalHits} 处待清理（上面按文件列了）。执行：node scrub.js --fix`);
}

// —— 自检：高危模式必须清零 ——
console.log('\n════════ 高危模式自检 ════════');
let left = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) continue;
  const s = fs.readFileSync(f, 'utf8');
  for (const [name, re] of MUST_BE_ZERO) {
    const all = new RegExp(re.source, 'g');
    const m = s.match(all);
    if (!m) continue;
    left += m.length;
    console.log(`  ❌ ${f}: ${name}（${m.length} 处）${FIX ? '' : '：' + JSON.stringify(m[0].slice(0, 40))}`);
  }
}
console.log(left ? `\n仍剩 ${left} 处 —— 上面这些是"必须为 0"的。` : '\n✅ 高危模式全部为 0。');

// —— 提交信息检查（⚠️ 真栽过：message 会永久留在历史里，还直接显示在 GitHub 文件列表上）——
console.log('\n════════ 提交信息检查 ════════');
try {
  const { spawnSync } = require('child_process');
  const r = spawnSync('git', ['log', '-n', '30', '--format=%h|%s'], { encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout) throw new Error('git log 读不到');
  const bad = [];
  for (const line of r.stdout.split('\n')) {
    if (!line.includes('|')) continue;
    for (const [name, re] of MUST_BE_ZERO) {
      if (re.test(line)) { bad.push(`${line.split('|')[0]}  「${name}」  ${line.split('|')[1].slice(0, 46)}`); break; }
    }
    if (/痕迹|隐私|个人信息/.test(line)) bad.push(`${line.split('|')[0]}  「涉及仓库自身整理话题」  ${line.split('|')[1].slice(0, 46)}`);
  }
  if (bad.length) {
    console.log('  ⚠️ 最近 30 条提交信息里有可疑内容（这些会显示在 GitHub 上）：');
    for (const b of bad) console.log('    ' + b);
    console.log('  → 改写：git filter-branch -f --msg-filter "node <过滤器>" <起点>..HEAD （然后 force push）');
  } else console.log('  ✅ 最近 30 条提交信息干净。');
} catch (e) {
  console.log(`  （读不到 git 日志，跳过：${e.message}）`);
  console.log('  推送前请自己看一眼：git log -n 10 --format=%h%n%s%n%b');
}

// —— push 前体检（读文件 + 尽量读 git；读不到就跳过）——
console.log('\n════════ push 前体检 ════════');
let sideWarn = 0;          // 体检发现的问题：也要算进退出码，让「一键上传」停下来问
try {
  const cfg = fs.readFileSync(path.join('.git', 'config'), 'utf8');
  const pick = (k) => (cfg.match(new RegExp(`${k} = (.*)`)) || [])[1];
  const nm = pick('name'), em = pick('email'), url = (cfg.match(/url = (.*)/) || [])[1];
  console.log(`提交身份：${nm} <${em}>`);
  if (em && !/@localhost$/.test(em)) {
    console.log('  ⚠️ 这个邮箱会写进**新提交**（想去掉就设仓库级身份）：');
    console.log('     git config user.name "你的名字" && git config user.email "you@localhost"');
    sideWarn++;
  }
  console.log(`远程仓库：${url || '(没配)'}`);
} catch { console.log('读不到 .git/config（跳过）'); }

const ignore = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf8') : '';
for (const f of ['data.db', 'debug.log', 'launcher.json', 'clipboard.log']) {
  const has = fs.existsSync(f);
  const ignored = ignore.split('\n').some((l) => l.trim() === f);
  if (has && !ignored) {
    console.log(`  ⚠️ ${f} 存在且**没被 .gitignore 忽略** —— git add . 会把它推上去`);
    sideWarn++;
  }
}

// 待提交文件体检：大文件 + 临时脚本（下划线开头的最容易忘删）
try {
  const { spawnSync } = require('child_process');
  const r = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
  if (r.status !== 0 || r.stdout == null) throw new Error('读不到 git 状态');
  const files = r.stdout.split('\n')
    .map((l) => l.slice(3).trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
  const big = [], tempish = [];
  for (const p of files) {
    if (/(^|\/)_[^/]*\.(js|bat|cmd|txt|json|log)$/i.test(p) || /(^|\/)_e2e\//.test(p)) tempish.push(p);
    if (!fs.existsSync(p)) continue;
    let st = null;
    try { st = fs.statSync(p); } catch { continue; }
    if (st.isFile() && st.size / 1048576 > 5) big.push(`${p}  ${(st.size / 1048576).toFixed(1)} MB`);
  }
  if (tempish.length) {
    console.log('  ⚠️ 待提交里有临时文件（下划线开头 —— 验证脚本、试跑产物之类）：');
    for (const t of tempish) console.log('    ' + t);
    console.log('    不要的话删掉它；验证脚本本来就该写到 .git/_xxx.js（git 内部，永远不会被提交）。');
    sideWarn++;
  }
  if (big.length) {
    console.log('  ⚠️ 待提交的大文件（GitHub 单文件上限 100MB，超了会被拒收）：');
    for (const b of big) console.log('    ' + b);
    sideWarn++;
  }
  if (!tempish.length && !big.length) console.log('  ✅ 待提交文件里没有临时脚本，也没有超过 5MB 的大文件。');
} catch (e) {
  console.log(`  （待提交文件检查跳过：${e.message}）`);
}
console.log('（data.db / debug.log / launcher.json 都在 .gitignore 里就安全）');

// .bat 的编码陷阱：含非 ASCII 又切到 65001 → cmd 解析必然乱码、把命令拆碎
try {
  for (const f of fs.readdirSync('.').filter((x) => /\.bat$/i.test(x))) {
    const txt = fs.readFileSync(f).toString('latin1');
    if (/[\x80-\xFF]/.test(txt) && /chcp\s+65001/i.test(txt)) {
      console.log('  ⚠️ ' + f + '：含非 ASCII 又切到 65001 —— cmd 解析 .bat 会乱码、把命令拆碎');
      console.log('     正确做法：.bat 只当纯 ASCII 启动器，逻辑放 .ps1（UTF-8 带 BOM）里');
      sideWarn++;
    }
  }
} catch (e) {
  console.log('  （.bat 编码检查跳过：' + e.message + '）');
}
// 退出码：给 bat / CI 判断用 —— 发现问题 → 1，干净 → 0
// （「一键上传.bat」就是靠它决定要不要停下来问你）
process.exit((left || sideWarn || (!FIX && totalHits)) ? 1 : 0);
