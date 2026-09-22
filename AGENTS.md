# 项目须知：漫剧素材管理器

> 这个文件是给 AI 助手看的（`AGENTS.md` 约定）。人看的说明在 `README.md`。

## 改代码前

1. 先读 **`CODE_MAP.md`** —— 文件职责、模块规则、8 条踩坑、故障排查表、配置单一数据源。
2. 改动面大就先 `git commit`（`git log --oneline` 看历史），别在无版本控制下做渐进优化。

## 改代码后（**别忘**）

```powershell
node map.js          # 刷新 CODE_MAP.index.md（行号索引，自动生成）
node map.js 收件箱    # 查行号：按关键词直接定位
node map.js --print  # 只看不落盘
```

- **禁止手工维护行号。** `CODE_MAP.md` 里一个行号都没有 —— 这是故意的：
  行号每改一次代码就整体漂移，手工重刷几十处纯属搬砖。行号一律由 `map.js` 生成到
  `CODE_MAP.index.md`（那份别手改）。

## 交付给用户时

- 改了 **前端**（`public/`）→ 提醒 **Ctrl+F5**（浏览器 JS 是页面加载那一刻装进去的）。
- 改了 **后端**（`server.js` / `db.js`）→ 提醒 **重启 node**（没有热更新）。
- 两件都改了都要提醒；但**同一件事不要反复要求用户做**。

## 硬规矩（细节见 `CODE_MAP.md` 踩坑记录）

- 所有路径必须过 `resolveSafe()`（安全命脉）。
- "复制"有两个东西：系统剪贴板 `copyToClipboard()` vs 网页内部 `S.internalClip`，
  文案必须写清是哪一个。
- 新文件的**两个入口**（后台监听 / 拖进网页上传）都必须走 `dispatchNewFile()`。
- 任何"往根目录顶层写文件"的接口都必须调 `markSelfWrite()`。
- 拖拽判据只有 `dragKind()` 一处；`dragover`/`drop` **必须** `preventDefault()`。
- 拆 `bind*` 函数后必须数调用点（跑 CODE_MAP 踩坑① 里那条 `Select-String`）。

## 启动 / 自测

- 启动：`node server.js`（默认 `http://127.0.0.1:8899`），或双击 `启动.bat`。
- **自测不要碰用户的 `data.db`**：把 `server.js` / `db.js` / `public` 复制到临时目录（如 `_e2e/`），
  换端口跑（`node server.js --port 8897`），测完删掉那个目录。
