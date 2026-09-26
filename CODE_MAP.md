# 代码地图 CODE_MAP

> **定位手册：出问题先查这里，别从三千行里翻。**
>
> 这份文件**故意不含行号** —— 行号每次改代码就整体漂移，手工维护它纯属自虐。
> 职责、规则、踩坑、排查写在这里；**精确行号全部自动生成**：
>
> ```powershell
> node map.js            # 改完代码跑一下，刷新 CODE_MAP.index.md
> node map.js 收件箱      # 最常用：按关键词直接查行号
> node map.js --print    # 只看不落盘
> ```
>
> 生成物是 [`CODE_MAP.index.md`](CODE_MAP.index.md)（别手改）。
> ⚠️ 别用 `Get-Content` 数行数（PS 5.1 会少数几十行），`map.js` 用的是 Node。

---

## 一、文件职责与依赖

| 文件 | 唯一职责 | **不该出现** |
|---|---|---|
| `server.js` | HTTP 服务、路由分发、文件系统 IO、外部命令、收件箱监听 | 业务规则、界面文案 |
| `db.js` | SQLite 存取（Node 内置 `node:sqlite`，零依赖） | HTTP 概念、路径安全 |
| `public/app.js` | 界面逻辑 | 直接拼 API URL（**待改，41 处**） |
| `public/index.html` | DOM 骨架 | 逻辑 |
| `public/style.css` | 样式 | — |
| `public/tools/` | 投放素材助手：油猴脚本 + 安装页 + 探针页 | — |
| `extension/` | 同一功能的 Edge 扩展版 | — |
| `map.js` | 生成行号索引（见头部说明） | — |

**依赖方向**：`界面 → HTTP API → db.js → data.db`，**单向**。

---

## 二、后端（`server.js`）

### 2.1 路由

**37 个分支全在 `http.createServer` 那一个函数里**（行号见索引）。按功能分四块：

| 块 | 路由 |
|---|---|
| 配置 / 根目录 | `GET·POST /api/config`、`POST /api/roots`、`DELETE /api/roots/:id` |
| **技能目录** | `GET·POST /api/skills`、`DELETE /api/skills/:id`、`GET /api/skills/file` |
| **提示词工作台** | `GET·POST /api/board` |
| **投放通道** | `GET /api/deliver/next`（脚本轮询领取）、`POST /api/deliver/done`（脚本回执）、`POST /api/deliver/queue`、`POST /api/deliver/send`、`GET /api/deliver/state` |
| **收件箱** | `GET /api/edge`、`GET /api/events`(SSE)、`GET /api/inbox`、`GET /api/inbox/targets`、`POST /api/inbox/ingest` |
| 磁盘浏览 / 目录 | `GET /api/fs/drives`、`GET /api/fs/dirs`、`GET /api/list`、`GET /api/tree` |
| 文件读写 | `GET /api/file`、`GET·POST /api/text`、`PUT /api/upload`、`POST /api/mkdir`、`/api/mkdir-template`、`/api/rename`、`/api/rename-batch`、`/api/move`、`/api/copy`、`POST /api/delete` |
| 回收站 | `GET /api/trash`、`POST /api/trash/restore`、`POST /api/trash/purge` |
| 搜索 / 杂项 | `GET /api/search`、`GET /api/duplicates`、`POST /api/clipboard`、`POST /api/reveal`、`GET /api/sysinfo` |
| 虚拟分类 | `GET·POST /api/vgroups`、`/api/vgroups/update`、`/assign`、`/delete`、`/materialize` |

### 2.2 核心内部函数（改一个影响一片，必须全量回归）

| 函数 | 干什么 / 注意 |
|---|---|
| `LOG()` / `flushLog()` | **内存攒批 + 每秒落盘**（不要改回 `appendFileSync`） |
| `psArgs()` | **PowerShell 必须走 `-EncodedCommand`**（踩坑 ②） |
| `withClipboardLock()` | 系统剪贴板写入串行化（踩坑 ①） |
| `cleanPsOutput()` | 剥掉 CLIXML，露出真实错误 |
| `runCommand()` | **异步**执行外部命令，替代 `spawnSync` |
| **`resolveSafe(root, rel)`** | **安全命脉：所有路径入口都必须过它** |
| `getRoot()` | 所有带 `root` 参数的接口 |
| `uniqueName()` | 上传 / 改名 / 移动 / 转实体 / 入库（防重名，自动加 `(1)`） |
| `readGroupsClean()` | `/api/list`、`/api/vgroups`、`resolveScope` 共用 |
| `listDir()` / `statEntry()` / `hasSubDir()` | 列目录相关 |
| `sortEntries()` | 服务端排序 |
| **`resolveScope(scope)`** | **`/api/list` + 全部批量接口**（分页与全选的交汇点） |
| `expandItems(b)` | 批量删除 / 移动 / 重命名 / 剪贴板 |

### 2.3 收件箱模块（新文件到达 → 入库卡片）

**它解决什么**：Edge 下载完（或拖进网页上传）的文件，自动弹卡片问「进哪个库 + 要不要改名」。

**三条硬规矩：**

1. **收件箱目录不在网页里配** —— 直接同步 Edge 的 `download.default_directory`（`readEdgePrefs()`），
   用户改 Edge 一处就够。网页设置里只做只读展示 + 「重新读取 Edge 设置」。
2. **只认「根目录顶层的新增文件」**，且必须等大小稳定 + 同名 `.crdownload` 消失才算下载完成。
3. **网页自己产生的文件必须登记忽略**（`markSelfWrite()`），否则监听器把自己的操作当"新下载"。

**两个入口，一个出口**：

| 入口 | 触发 | origin |
|---|---|---|
| 后台监听 | 根目录顶层冒出新文件（Edge 下载 / 手动拷入） | `'watch'` |
| **拖进网页上传** | `PUT /api/upload` 成功（从资源管理器拖进窗口） | `'upload'` |

两者都调 **`dispatchNewFile()`**（策略只有一份）。上传分支额外两件事：先 `markSelfWrite(target)`
（避免 watcher 再弹一次），再把**上传到的那个文件夹**作为卡片默认落点。

**三档策略（`autoPolicy`）**：

| 策略 | 后台发现的新文件 | 拖进网页上传的 |
|---|---|---|
| `smart`（默认） | 文件名命中 `smartRules`（无意义）才弹，否则静默入库到上次落点 | 同理：无意义才弹，有意义就留在上传位置 |
| `always` | 每个都弹卡片 | 每个都弹卡片 |
| `never` | 静默入库到上次落点 | 不打扰，留在上传位置 |

**入库卡片（`openIngestCard`）**：

- 缩略图预览 + **主名可改 / 后缀固定显示且不参与输入**（改名绝不丢后缀），不改名就按原名入库
- 目标下拉：**按根目录 `optgroup` 分组 + 按 `depth` 全角空格缩进**（层级树），组内含
  根目录（散-未归类）、各文件夹（DFS，限深 3 / 最多 400 个）、虚拟分类
- **⭐ 最近常用**置顶；重名不覆盖；「跳过 / 全部跳过」留在原处
- 一批上传不会传到一半就弹（前端 `inboxHeld` + `flushHeldInbox`）

**「最近常用」规则（用户定的，改前先问）**：入库 **≥2 次**的位置置顶（标「用过 N 次」）；
记忆窗口 `INGEST_HISTORY_MAX = 10`，**连续 10 次非它入库**就挤出去、标记消失；
**"直接进未归类"不计入这 10 次**（`ingestFile` 里的 `wentLoose` 判断）。

**关键函数**：`readEdgePrefs` `markSelfWrite` `snapshotTop` `waitFileReady` `matchSmartRule`
`queueInboxItem` `ingestFile`（入库唯一实现）`autoIngestQuiet` `dispatchNewFile` `scanRoot`
`stopInbox` / `startInbox` `ingestKey` `collectDirs` `listIngestTargets`。

### 2.4 启动器与浏览器发现（**加启动选项看这里**）

**两个新文件，职责分得很清：**

| 文件 | 职责 |
|---|---|
| `launcher.js` | 启动器：菜单 UI + 记住选择（`launcher.json`）+ 拼参数拉起 `server.js` |
| `browsers.js` | 发现本机浏览器（`discover()` / `resolve()`），**不写死任何安装路径** |

**★ 加一个新的启动选项 = 只改 `launcher.js` 顶部的 `OPTIONS` 表一条**（菜单、记忆、参数拼装、
"手动输入"入口、`r` 恢复默认**全自动适配**，别处都不用动）：

| 字段 | 作用 |
|---|---|
| `key` | 存进 `launcher.json` 的字段名，也是命令行直通用的名字 |
| `title` | 菜单上显示的名字 |
| `def` | 没选过时的默认值 |
| `type` | `'list'`（给几个选项）\| `'text'`（自由文本） |
| `choices` | `() => [{ value, label, note }]`，**可以动态生成**（浏览器那项就是扫注册表） |
| `args` | 值 → 传给 `server.js` 的参数数组，例 `(v) => ['--port=' + v]` |
| `custom` | 有这行就多一个「手动输入」入口，字符串是提示语 |

后端要支持新参数：在 `server.js` 的 `applyArgv()` 里加一行认它。现在已经认
`--port[=]` `--host[=]` `--browser[=]` `--browser-exe[=]` `--root`。

**浏览器发现（browsers.js）** —— 四个来源，逐个失败都不影响其它（全部 try 住）：

1. 注册表 `Clients\StartMenuInternet`（HKLM + HKCU）：Windows 官方登记浏览器的地方，**装哪个盘都在**
2. 注册表 `App Paths\<exe>`：安装程序登记的完整路径
3. 常见安装路径（兜底绿色版 / 注册表被清理过）
4. `PATH` 查找

> ⚠️ ①② 要走 `reg.exe`（Node 没有内置注册表 API）。**若运行环境禁止起子进程，它们会静默失败**，
> 自动退到 ③④ —— 功能不中断，只是列表短一些（本项目的 AI 沙箱就是这样，用户实机不受影响；
> 实测沙箱里是 `EPERM spawnSync reg`）。
> 中文 Windows 的 `reg` 输出是 **GBK**，要用 Buffer + `TextDecoder('gbk')` 解码，按 utf8 直接读会乱码。

**打开浏览器（`openBrowser()`）**：`config.browser` 存 **exe 绝对路径**或 `'default'`；
配置的那个找不到就**回退系统默认**并打印提示 —— 绝不会因为浏览器路径变了就打不开页面。

**四个入口**：`启动.bat` → `launcher.js`（菜单）/ `node launcher.js key=value ...`（直通，给快捷方式用）/
网页设置（写 `config.browser`，**下次启动生效**）/ `node server.js`（完全跳过启动器）。

### 2.5 技能目录（提示词模板）

**为什么单独存、不和 `config.roots` 混** —— 混进去会连带三个问题：
① 左侧素材树里冒出 skills 目录；② 收件箱会去 `fs.watch` 它，改个模板就算"新文件"；
③ 回收站/虚拟分类按根目录工作，会在里面建 `.recycle`（往放提示词的地方塞程序文件）。

所以：**独立表 `skill_dirs`**（db.js）+ **独立接口 `/api/skills*`**，只在读文件时借用
`resolveSafe(dirPath, rel)` 做越界防护。

| 接口 | 说明 |
|---|---|
| `GET /api/skills` | 挂载的目录 + 每个目录里可投放的模板文件（带 `exists` 标记） |
| `POST /api/skills` | 挂载一个目录（同一路径幂等，返回 `existed`） |
| `DELETE /api/skills/:id` | 移除挂载 —— **只解除，文件一个都不动** |
| `GET /api/skills/file?id=&rel=` | 读一份模板；非白名单扩展名 → 415，超 `textPreviewBytes` → 413 |

- 白名单 `SKILL_EXT = .md / .txt / .markdown`；递归限深 3 层、最多 300 个文件
- 前端：「技能」分区的 `renderSkills()` / `previewSkill()`；「＋」复用**同一个目录选择器**
  `openAddRootDialog(startPath, mode)`（`mode='skill'`）—— 加素材根目录和挂技能目录是同一个对话框，
  **不要写第二个**

---

## 三、前端（`public/app.js`）

### 3.1 配置与状态

| 名字 | 说明 |
|---|---|
| `TUNING` | 前端阈值兜底（启动后被服务端 `limits` 覆盖） |
| `S` | **全局可变状态** |
| `S.internalClip` | 网页内部剪贴板（**≠ 系统剪贴板**） |
| `S.selectAll` | 全选整个视图（含未加载） |
| `LOOSE` / `VG_PREFIX` | 虚拟路径 `::loose::` / `::vg::`（**不能当真实路径发给后端**，踩坑 ④） |

### 3.2 取数与渲染

`api()` / `apiPost()`（**唯一 HTTP 出口**）、`renderRoots` `reloadConfig` `selectRoot`、
`buildTree` `expandNode` `bindTreeRow`、`navigateTo` `loadDir` `reloadCurrent` `loadMore`、
`sorted` `filtered` `injectedNodes` `renderContent` `renderGrid` `renderList` `fillThumb`、
`visibleEntries()`（带缓存）/ `invalidateVisible()`、`Thumb`（IndexedDB 缩略图缓存）。

### 3.3 归类 / 转实体（业务核心）

`openNewVGroupDialog` `assignToGroup` `unassignFiles` `deleteVGroup`、**`openMaterializeDialog`**（转实体）。

### 3.4 复制到剪贴板（**踩过两次坑**）

三个入口（底部按钮 / 右键菜单 / `Ctrl+C`）→ **唯一实现 `copyToClipboard()`**。
`S.internalClip` 是**另一回事**（只有网页内部粘贴认它）。见踩坑 ③。

### 3.5 收件箱卡片

`connectInbox()`（SSE + 启动兜底拉取）→ `enqueueInbox()` → `showNextIngest()` → **`openIngestCard()`**。
`flushHeldInbox()` 负责"一批上传完再弹"。`openSettings()` 里有 Edge 同步只读展示与监听开关。

### 3.6 事件绑定（已拆分，**不要再加链式调用**）

`bindEvents()` **只负责调用 7 个子函数**：`bindToolbarEvents` `bindLogEvents` `bindNavEvents`
`bindContentEvents` `bindOverlayEvents` `bindDragDropEvents` `bindKeyboardEvents`。
详见踩坑 ①。

### 3.7 拖拽：三种拖拽，判据只有 `dragKind()`

| 类型 | 判据 | 处理 |
|---|---|---|
| `internal` 网页内部拖拽（素材 → 目录树）= 移动 | `S.dragPaths` 非空，**永远优先** | `moveItems` / `assignToGroup` / `unassignFiles` |
| `external` 从资源管理器拖进来的真实文件 = 上传 | `dataTransfer.types` 含 `'Files'` | `uploadFiles()` |
| `other` 从别的网页拖来的元素/链接/文字 | 两个都不满足 | **有意什么都不做** |

判据**只有一处** `dragKind(ev)`，三个 handler 都调它。详见踩坑 ⑦。

### 3.8 投放素材助手（把素材丢进豆包 / Pavo）

- 平台表：app.js 顶部的 `DELIVER_TARGETS` —— **加平台就往这张表加一行**
- 面板 `openDeliverPanel(t)` 的文案全部走 `t.name`；安装 4 步与平台无关
- 安装检测：`checkMjaInstalled()` 用隐藏 iframe 加载 `/tools/probe.html`，读它的
  `documentElement.dataset.mjaReady`（脚本在**本地页面**会挂这个标记）—— 与目标平台无关
- 网页「📋 复制脚本代码」取的是 `/tools/doubao-helper.js`（**不是** `.user.js`）
- **脚本有三份，改一份必须同步另外两份**（见踩坑 ⑨）：

| 文件 | 谁用 | 关系 |
|---|---|---|
| `public/tools/doubao-helper.user.js` | **主脚本**（篡改猴安装用） | 带 UserScript 头 |
| `public/tools/doubao-helper.js` | 网页「复制脚本代码」 | 与主脚本**逐字节相同** |
| `extension/content.js` | Edge 扩展内容脚本 | 主脚本**去掉 UserScript 头** |

- 脚本里的平台表是 `SITES`（`{ id, name, re }`）。发送逻辑**平台无关**：运行时扫 `input[type=file]`
  → 按 `accept` 匹配 → `DataTransfer` 注入 → 失败退回模拟拖放。所以适配新站通常**不用改发送代码**。
- **加一个新平台 = 四处改动**：`SITES`、UserScript `@match`、`extension/manifest.json` 的 `matches`、
  app.js 的 `DELIVER_TARGETS`。面板标题会显示当前站点（`📁 漫剧素材 · Pavo`），方便确认脚本在哪个站生效。

### 3.9 技能（提示词模板）分区

- `renderSkills()`：拉 `/api/skills` 渲染挂载的目录；目录不存在标 ⚠️，`×` 解除挂载（带确认）
- **文件列表必须显示成树**：`buildSkillTree()` 按 `rel` 里的 `/` 在前端构造层级
  （服务端给的是扁平的 `分镜/人物/立绘.md`），`renderSkillNode()` 递归渲染 ——
  **目录可折叠（▾/▸）+ 按层缩进 + 只显示自己的文件名**。
  ⚠️ **不要退回平铺**（把 `子目录/文件.md` 一行一条列出来）—— 用户明确要求层级感，已被提过两次
- `previewSkill(dir, file)`：点文件名弹出内容预览
- 「＋」→ `openAddRootDialog(null, 'skill')`（**和加素材根目录共用同一个对话框**）
- `init()` 末尾会调一次 `renderSkills()`

### 3.10 提示词工作台（`pboard`）

- **一块板子**，存 `settings.promptBoard`（JSON）。第一期单板；以后要多剧本再建表
  （`GET·POST /api/board`，POST 里对 items/skills 做了字段白名单，脏数据不会写进去）
- 形态：`.pboard.big`（居中大窗，`min(1180px,94vw) × min(780px,88vh)`）↔ `.pboard.small`（右下小框 340px），
  `toggleBoardSize()` 切换；**Esc 在 `bindKeyboardEvents` 里优先处理**（放大态 → 缩小），
  缩小态**不拦**（让灯箱/弹窗的 Esc 照旧）。缩小态 `.pb-left` 隐藏，只留条目列表
- **拖图**：面板自己的 `dragover`/`drop` 处理 `S.dragPaths`（内部拖拽），
  命中后 `ev.stopPropagation()` —— 否则 window 那层会把它当成"拖到空白处=取消"。
  **外部文件拖入不在这里处理**（`isFileDrag` 直接 return，留给上传逻辑）
- **配图是数组**（`item.images`，**一条提示词可以配多张图**）：`assignBoardImages()` 往目标条目
  **追加**（不是覆盖），同 `root+path` 去重，每条上限 `BOARD_IMAGES_MAX = 12`
  —— ⚠️ 这个常量**前端和 server.js 各有一份，改要一起改**。
  后端 `normBoardImages()` 统一负责"数组化 + 去重 + 限数 + **老的单图字段 `image` 自动升级成数组**"，
  所以任何入口写进去的配图都会被规整
- 拖到空白处 → 加到**第一条还没配图的**条目；都没有就新建一条
- ⚠️ 条目 textarea 的 `oninput` **只 `saveBoard()`，绝不 `renderBoard()`** —— 重渲染会重建 textarea，
  用户的输入和光标都会丢
- skill 勾选树复用 `buildSkillTree()` / `skillByName`（和左侧「技能」分区同一套层级规则，
  仍然**不许平铺**）
- 存盘：`saveBoard()` 防抖 600ms；结构变化（增删/移动/配图）用 `saveBoard(true)` 立刻存

### 3.11 投放通道（工作台 → 助手脚本 → 豆包）

- 后端：`queueDeliver()` 入队（内存 `deliverTasks`，**不持久化** —— 投放是即时动作），
  两种命令 `deliver` / `send`；状态 `pending → running → done/failed`，每步都 `sseSend('deliver', …)`
- 脚本侧（`doubao-helper.user.js`）：`startDeliverLoop()` 每 1.2 秒 `GET /api/deliver/next?site=<id>`，
  取到就 `runTask()` 执行，完事 `POST /api/deliver/done` 回执（`boot()` 里启动，只在 `IS_TARGET` 时）
- 前端：`deliverItem()` / `sendItem()` 入队；`onDeliverEvent()`（SSE `deliver` 事件）更新条目状态。
  ⚠️ 收到回执要重渲染时**先看焦点在不在条目里**（`document.activeElement.closest('.pb-item')`）——
  用户正在打字就别重建 DOM，否则输入被打断
- 「发送」按钮只在状态含「待发送 / 已投放」时出现（`/待发送|已投放/.test(item.state)`）

---

## 四、⚠️ 踩坑记录（真实发生过的，别再犯）

### ① 拆分函数后，**必须数每个函数被调用几次**

用"插入边界"拆 `bindEvents` 时形成了链式调用（`bindLogEvents` 末尾又调 `bindNavEvents`…），
叠加结果 **`bindKeyboardEvents` 被调 6 次** → `keydown` 注册 6 个 → 按一次 `Ctrl+C` 发 6 个请求
→ 6 个 PowerShell 抢剪贴板 → `CLIPBRD_E_CANT_OPEN`。

**改完跑这条检查**（应该只有 `bindEvents` 里的 7 个 + `init` 里的 1 个）：

```powershell
Select-String -Path public\app.js -Pattern "^  bind[A-Z]\w+\(\);$"
```

### ② PowerShell 传参必须用 `-EncodedCommand`

`-Command` 拼字符串时，路径含空格/括号（如 `9月9日 (1)(1).png`）会被命令行拆开。
`-EncodedCommand` 传 UTF-16LE Base64，**任何字符都不会被解析**；
同时 `[Console]::OutputEncoding=[Text.Encoding]::UTF8` 必加，否则中文乱码。

### ③ "复制"有两个完全不同的东西

- `copyToClipboard()` → **Windows 系统剪贴板**（能粘到豆包）
- `S.internalClip` → **网页内部剪贴板**（只能粘贴到别的文件夹）

**曾经 `Ctrl+C` 绑的是后者，还弹"已复制 N 项"的假提示**，排查了十几轮。
**规矩：凡"复制"字样，必须写清是哪一个。**

### ④ 虚拟路径不能当真实路径发给后端

`LOOSE`（`::loose::`）和 `VG_PREFIX`（`::vg::`）是虚拟路径，
所有发给后端的 path 都要先过 `realPath()`；所有批量操作都要先过滤 `isVirtualPath()`。

### ⑤ 改前端必须 Ctrl+F5；改后端必须重启 node

浏览器里的 JS 是页面加载那一刻装进去的 —— 重启服务、重启电脑都不影响它。
后端则相反：`node` 没有热更新，改一行也要重启。
**"界面/行为没变化"的排查顺序：先确认页面刷新过、服务重启过。**

### ⑥ 收件箱：网页自己的写操作**必须**调 `markSelfWrite()`

监听器靠"顶层文件名差集"判断新文件。上传 / 改名 / 移动 / 从回收站恢复，
在它眼里**全是"凭空冒出来的新文件"** —— 不登记就会把自己的操作弹成"新下载"。

已登记：`/api/upload`、`/api/text`、`/api/rename`、`/api/rename-batch`、`/api/move`、`/api/copy`、
`/api/trash/restore`、`ingestFile`。
**以后新增任何"往根目录顶层写文件"的接口，都要加一行 `markSelfWrite(目标绝对路径)`。**

`markSelfWrite` 做两件事（双保险）：写忽略表（60 秒）+ 直接塞进该根的快照集合。

### ⑦ 三种拖拽：判据必须收敛到 `dragKind()`；`dragover`/`drop` 必须 `preventDefault()`

判据散在各 handler 里就会串（上传污染移动、移动污染上传）。判据只有 `dragKind(ev)` 一处。

**三个必须记住的坑：**

1. **`dragover` 不 `preventDefault()` 就没有 `drop`**：外部文件拖入时浏览器判定"页面不是放置目标"，
   松手时直接开新标签页打开文件（页面被截胡，上传永远收不到）。`drop` 里也要**开头无条件** `preventDefault()`。
   （拖到浏览器标签栏/书签栏仍会打开文件 —— 那是浏览器自己的区域，网页无权拦。）
2. **`dragleave` 不能用 `dragKind(ev)` 判**：Chrome 在 `dragleave` 时 `dataTransfer.types` **是空数组**，
   会判成 `'other'` —— 据此 `return` 的话遮罩永远收不掉。要用 `dragActive` 标志，
   并在 `document` 的 `dragend` 里兜底重置（拖拽被 Esc 取消时不触发 `dragleave`）。
3. **`dragstart` 不是所有元素都触发**：HTML5 拖拽默认只让 `<img>` / `<a>` 可拖，
   `div` 必须**显式** `draggable="true"`。漏了它的表现就是"**只有图片拖得动**" ——
   视频卡片、文件夹卡片、没有缩略图的文件、列表行全都拖不动。
   修法：`renderGrid`/`renderList` 里给卡片和行设 `draggable = true`；
   缩略图里的 `<img>`/`<video>` 反过来设 `draggable = false`（让拖拽源统一是卡片）。
   回收站卡片**故意不设**（那里的东西不该能拖），`dragstart` 里另加了 `S.mode === 'trash'` 的兜底。

### ⑧ 两个入口必须共用一份策略

`dispatchNewFile()` 是新文件的唯一分派出口。
**踩过的坑**：上传分支一开始只写了 `markSelfWrite()`（防 watcher 重复弹），
结果"从资源管理器拖进网页"这条入口被彻底屏蔽，永远不弹卡片。
正确顺序：`markSelfWrite(target)` **之后**仍然要调 `dispatchNewFile(..., origin:'upload')`。

### ⑨ 投放助手脚本有**三份**，改一份必须同步另外两份

主脚本 `doubao-helper.user.js` 改完，**另外两份必须一起更新**：

- `public/tools/doubao-helper.js` —— 网页「📋 复制脚本代码」取的就是这份，要与主脚本**逐字节相同**
- `extension/content.js` —— 主脚本**去掉 UserScript 头**（`==/UserScript==` 之后的部分）

只改一份的后果：篡改猴用户拿到新功能、扩展用户还是旧的（或反过来），而且两边行为不一致，排查时会怀疑人生。

同步就用一个几行的临时脚本（读主脚本 → 原样写第一份 → 去头写第二份 → `node --check` 三个），
**不要用 `node -e` 拼长命令**：PowerShell 会把单引号里的双引号吃掉（见踩坑 ②）。

改完还要提醒用户（否则他会以为没生效，见踩坑 ⑤）：

- 篡改猴：重新走一遍「复制脚本代码 → 编辑 → `Ctrl+A` 覆盖粘贴 → `Ctrl+S`」
- Edge 扩展：`edge://extensions/` → **重新加载**
- 然后**刷新目标站点页面**（脚本只在页面加载时注入一次）

### ⑩ 投放通道：网页 ↔ AI 站点之间只能"命令队列 + 脚本轮询"

第三方站点没有我们的长连接，篡改猴的 `GM_xmlhttpRequest` 也不支持流式，所以只能：
**网页入队 → 脚本每 1.2 秒 `GET /api/deliver/next` 领一条 → 执行 → `POST /api/deliver/done` 回执
→ 后端 `sseSend('deliver', …)` 推回网页**。四条规矩：

1. **领到即锁定**（`/api/deliver/next` 取到就把状态改成 `running`），否则两个标签页会重复投同一条
2. **超时回收**（`DELIVER_TIMEOUT_MS = 90s`）：脚本崩了 / 页面关了，任务自动退回 `pending`，
   不会永远卡在"正在投图…"
3. **找不到发送按钮就报失败**，绝不按坐标瞎点 —— 点到"清空 / 上传"是灾难
   （`findSendButton()` 打分低于 5 分直接返回 null）
4. **多图必须一张一张投**（`await sleep(500)`）：目标页面是异步渲染，一口气塞进去顺序会乱 ——
   这正是用户要的"0.5 秒一张，确保人和图不串"

---

## 五、常见故障定位表

| 症状 | 先查这里 |
|---|---|
| 复制到剪贴板失败 | `debug.log` → `copyToClipboard()` → `withClipboardLock` → `psArgs` |
| 一次操作触发多次 | **踩坑 ①**，跑那条检查命令 |
| 归类后计数不对 | `resolveScope()`（同时服务 `/api/list` 和批量接口） |
| 列表卡 / 白屏 | `/api/list` 的分页参数；`renderContent` 是否被当全量渲染调用 |
| 路径越权 | `resolveSafe()` —— **所有**路径必须过它 |
| 树上三角不显示 | `/api/tree` 返回的 `hasChildren` |
| 豆包侧边栏没反应 | `public/tools/doubao-helper.user.js`，先看豆包页 Console 的 `[素材助手]` |
| 界面改了没反应 | **踩坑 ⑤**：页面刷新过吗；改的是后端吗（要重启 node） |
| 下载完了却不弹入库卡片 | ①策略是 `smart` 且文件名"有意义"、或 `never`（本来就静默）②设置里「监听根目录里的新文件」勾上没 ③`debug.log` 搜 `[收件箱]` |
| **拖进网页上传也不弹** | `/api/upload` 里是否调了 `dispatchNewFile`（只剩 `markSelfWrite` 就等于屏蔽入口，踩坑 ⑧）；改完必须重启 node |
| 上传一次弹了两张卡 | `dispatchNewFile` 只该被调一次；`markSelfWrite` 必须在上传分支里 |
| 网页自己的操作也弹卡片 | 那个写接口漏了 `markSelfWrite()`，见踩坑 ⑥ |
| 卡片弹了但入库没反应 | `/api/inbox/ingest`；目标根目录是否还在（`getRoot`） |
| 目标列表没层级 / 不像树 | `collectDirs()` 的 `depth` / `shortLabel`；前端按 `optgroup` + 全角空格渲染 |
| 「最近常用」该出现没出现 / 该消失没消失 | `config.ingestHistory`；`uses>=2` 才置顶；**"进未归类"不计入**，见 `ingestFile` 的 `wentLoose` |
| 拖文件进来变成打开新标签页 | **踩坑 ⑦-1**，看 `bindDragDropEvents` 的 `dragover` |
| 内部拖素材却触发了上传（或反之） | `dragKind()` —— 判据只该有这一处 |
| 拖拽遮罩（dropMask）卡住不收 | **踩坑 ⑦-2**：`dragleave` 不能用 `dragKind` 判 |
| 改完 Edge 下载目录但网页没变 | 每次打开设置都会重读 `readEdgePrefs()`，点「重新读取 Edge 设置」；Edge 开着"下载前询问"时手选的位置不可知 |

---

## 六、配置与阈值（已收敛，不要再撒字面量）

**后端** `DEFAULT_CONFIG.limits` —— 单一数据源，通过 `/api/config` 下发：

| 键 | 值 | 用途 |
|---|---|---|
| `pageDefault` | 200 | `/api/list` 每页 |
| `pageMax` | 1000 | 每页上限 |
| `searchDefault` | 100 | 搜索每页 |
| `searchMax` | 500 | 搜索结果上限 |
| `searchDepth` | 8 | 搜索递归层数 |
| `textPreviewBytes` | 2MB | 文本预览上限 |

**前端** `TUNING` —— 只是兜底，启动时被服务端 `limits` 覆盖。

**其它配置**（同样在 `DEFAULT_CONFIG` 里）：`port` / `host` / `title` / `showHidden` /
`projectTemplate` / **`browser`**（启动时用哪个浏览器打开，见 2.4）。

**收件箱相关配置**（都在 `DEFAULT_CONFIG`，存进 `data.db` 的 `settings` 表）：

| 键 | 值 | 用途 |
|---|---|---|
| `autoPolicy` | `smart` \| `always` \| `never` | 新文件到达时的策略 |
| `inboxEnabled` | `true` | 是否监听根目录的新文件 |
| `lastIngestTarget` | `{root, path, gid}` | **全自动的落点**，每次入库后更新 |
| `ingestHistory` | 最多 10 条 | **「最近常用」记忆**（不含"进未归类"） |
| `smartRules` | 5 条正则 | 判"文件名有没有意义"（纯数字 / 16 进制串 / `img_1234` …） |

> ⚠️ **收件箱目录不在配置里**，永远实时读 Edge 的 `download.default_directory`。

**仍未收敛的**：油猴脚本/扩展里的 `http://127.0.0.1:8899`、`MAX_BYTES=200MB`。

---

## 七、已完成 / 未完成的优化

### ✅ 已完成

| 项 | 成果 |
|---|---|
| 职责拆分 | `bindEvents` **313 → 10 行**，拆成 7 个子函数 |
| 配置与代码分离 | 硬编码 → `config.limits` + `TUNING`，服务端单一数据源 |
| 性能（后端） | `LOG()` 每请求同步写盘 → 内存攒批 + 每秒落盘 |
| 性能（后端） | `spawnSync` → 异步 `runCommand`，不再阻塞事件循环 |
| 性能（前端） | `visibleEntries()` 8 处重复排序 → 1 次计算 + 缓存 |
| 错误处理诚实 | CLIXML 清洗，露出真实错误原因 |
| 死代码 | 删除未使用的 `MIGRATED` |
| **收件箱**（2026-09-22） | Edge 下载设置同步 + `fs.watch` 三档策略 + 入库卡片（层级目标 + 改名后缀保护 + 最近常用 + 自产不弹） |
| **拖拽隔离**（2026-09-22） | 三种拖拽判据收敛到 `dragKind()`；外部文件拖入不再被浏览器截胡 |
| **文档自动化**（2026-09-22） | 行号索引改由 `map.js` 生成，手写文档不再含行号 |
| **多平台投放**（2026-09-22） | 投放素材助手支持**豆包 + Pavo**；加平台 = `SITES` + `@match` + `matches` + `DELIVER_TARGETS` 各一行 |

### ⏳ 未完成（风险较高，需单独一轮）

| 项 | 为什么先停 |
|---|---|
| 拆 37 个路由 handler | 每个 handler 要整段搬迁（`if` 链不能用插入边界切开），路由是全局唯一入口 |
| `listDir` 逐文件 `stat` 加缓存 | 涉及正确性，缓存失效判错会显示过期数据 |
| 前端 41 处裸拼 `/api/` URL | 需要一层 API 封装，改动面广 |

---

## 八、Git

```
D:\文件管理\.git
```

```powershell
git log --oneline            # 看历史
git checkout -- server.js    # 撤销单个文件
git show HEAD --stat         # 看这次改了什么
```

`.gitignore` 已排除运行时数据（`data.db*`、`debug.log`、`*.bak`、`_dist/`）。
