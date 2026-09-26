/**
 * 去痕迹 / push 前体检。
 *
 *   node scrub.js            # 只检查并报告（默认，不动任何文件）
 *   node scrub.js --fix      # 执行清理
 *
 * 清掉的是**要推到公开仓库的文本里**属于"个人痕迹"的东西：
 *   · 把需求方的**原话引用**（"你也不能必须 3~5 给小分镜呀"这类）和"用户实测/用户要求/用户定的"
 *     改成中性描述 —— 这些是私下提的要求，不该出现在公开文档里
 *   · 示例里的**作品名**换成占位符
 * **不动**正常说法："用户目录""等用户决定""用户按 Ctrl+C"这类泛指，以及 README 里面向使用者的"你"。
 *
 * ⚠️ 只改**当前文件**；git 历史里的旧版本改不掉（要彻底去得重写历史，见 README/CODE_MAP 的说明）。
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
const RULES = [
  // —— 原话引用（最该去掉的：这是私下说的话）——
  ['原话：层级要明确', /用户(?:原话|明确要求)"层级要明确不能又被覆盖"/g, '要求"层级要明确、不能被覆盖"'],
  ['原话：弹窗都这样写', /用户要求["“”]\*{0,2}弹窗都这样写\*{0,2}["“”]/g, '要求：**所有弹窗都照这个来**'],
  ['原话：3~5 个小分镜', /用户回"你也不能必须 3~5 给小分镜呀"。现在是/g, '后来改成'],
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
  ['作者真实邮箱', /3312827187@qq\.com|shentu(?!-)/],
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
if (!totalHits) console.log('没有需要清理的痕迹。');
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

// —— push 前体检（不调用 git，纯读文件，任何环境都能跑）——
console.log('\n════════ push 前体检 ════════');
try {
  const cfg = fs.readFileSync(path.join('.git', 'config'), 'utf8');
  const pick = (k) => (cfg.match(new RegExp(`${k} = (.*)`)) || [])[1];
  const nm = pick('name'), em = pick('email'), url = (cfg.match(/url = (.*)/) || [])[1];
  console.log(`提交身份：${nm} <${em}>`);
  if (em && !/@localhost$/.test(em)) {
    console.log('  ⚠️ 这个邮箱会写进**新提交**（想去掉就设仓库级身份）：');
    console.log('     git config user.name "你的名字" && git config user.email "you@localhost"');
  }
  console.log(`远程仓库：${url || '(没配)'}`);
} catch { console.log('读不到 .git/config（跳过）'); }
const ignore = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf8') : '';
for (const f of ['data.db', 'debug.log', 'launcher.json', 'clipboard.log']) {
  const has = fs.existsSync(f);
  const ignored = ignore.split('\n').some((l) => l.trim() === f);
  if (has && !ignored) console.log(`  ⚠️ ${f} 存在且**没被 .gitignore 忽略** —— git add . 会把它推上去`);
}
console.log('（data.db / debug.log / launcher.json 都在 .gitignore 里就安全）');
