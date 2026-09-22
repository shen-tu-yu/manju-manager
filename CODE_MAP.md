# 代码地图 CODE_MAP

> **给未来的自己看的定位手册。** 出问题时先查这里，别再从三千行里翻。
> 行号 = 2026-09-22 实测快照（`grep -n` 核对过），代码改动后**必须刷新行号**。
> 2026-09-22 新增**收件箱模块**（`server.js` 从 1337 → 1738 行），
> `server.js` 大约 `600` 行之后的行号整体位移，旧行号作废。
> ⚠️ **别用 `Get-Content` 数行数**（PS 5.1 会少数几十行），用 `node -e "...split('\n').length"`。

---

## 一、文件职责

| 文件 | 行数 | 唯一职责 | **不该出现** |
|---|---|---|---|
| `server.js` | 1738 | HTTP 服务、路由分发、文件系统 IO、外部命令、收件箱监听 | 业务规则、界面文案 |
| `db.js` | 152 | SQLite 存取（Node 内置 `node:sqlite`） | HTTP 概念、路径安全 |
| `public/app.js` | 2940 | 界面逻辑 | 直接拼 API URL（**待改，41 处**） |
| `public/index.html` | 147 | DOM 骨架 | 逻辑 |
| `public/style.css` | 716 | 样式 | — |
| `public/tools/` | — | 投放素材助手：油猴脚本 + 安装页 + 探针页 | — |
| `extension/` | — | 同一功能的 Edge 扩展版 | — |

**依赖方向**：`界面 → HTTP API → db.js → data.db`，**单向**。

---

## 二、后端 API（38 个分支，全在 `server.js:916` 那个函数里）

| 路由 | 行 | 路由 | 行 |
|---|---|---|---|
| `GET /api/config` | 951 | `POST /api/delete` | 1318 |
| `POST /api/config` | 966 | `GET /api/trash` | 1338 |
| **`GET /api/edge`** | **982** | `POST /api/trash/restore` | 1357 |
| **`GET /api/events`**（SSE） | **999** | `POST /api/trash/purge` | 1383 |
| **`GET /api/inbox`** | **1013** | `GET /api/search` | 1398 |
| **`GET /api/inbox/targets`** | **1022** | `GET /api/vgroups` | 1441 |
| **`POST /api/inbox/ingest`** | **1027** | `POST /api/vgroups` | 1446 |
| `POST /api/roots` | 1050 | `POST /api/vgroups/update` | 1465 |
| `DELETE /api/roots/:id` | 1066 | `POST /api/vgroups/assign` | 1477 |
| `GET /api/fs/drives` | 1077 | `POST /api/vgroups/delete` | 1495 |
| `GET /api/fs/dirs` | 1081 | **`POST /api/vgroups/materialize`** | **1509** |
| **`GET /api/list`** | **1100** | `GET /api/duplicates` | 1566 |
| `GET /api/tree` | 1132 | **`POST /api/clipboard`** | **1585** |
| `GET /api/file` | 1154 | `POST /api/reveal` | 1630 |
| `GET /api/text` | 1160 | `GET /api/sysinfo` | 1648 |
| `POST /api/text` | 1174 | | |
| `PUT /api/upload` | 1184 | | |
| `POST /api/mkdir` | 1206 | | |
| `POST /api/mkdir-template` | 1218 | | |
| `POST /api/rename` | 1235 | | |
| `POST /api/rename-batch` | 1250 | | |
| `POST /api/move` `/api/copy` | 1283 | | |

### 后端内部函数（改一个影响一片，必须全量回归）

| 函数 | 行 | 被谁用 / 说明 |
|---|---|---|
| `LOG(msg)` | 158 | **内存攒批 + 每秒落盘**（不要再改回 `appendFileSync`） |
| `flushLog()` | 164 | 批量写盘，超 1MB 自动清空 |
| `psArgs(script)` | 191 | **PowerShell 必须走 `-EncodedCommand`**（见踩坑 ②） |
| `withClipboardLock(fn)` | 200 | 剪贴板写入串行化（见踩坑 ①） |
| `cleanPsOutput()` | 207 | 剥掉 CLIXML，露出真实错误 |
| `runCommand()` | 219 | **异步**执行外部命令，替代 `spawnSync` |
| **`resolveSafe(root, rel)`** | **262** | **所有**路径入口（安全命脉） |
| `getRoot(id)` | 280 | 所有带 `root` 参数的接口 |
| `uniqueName(dir, name)` | 286 | 上传 / 改名 / 移动 / 转实体 / **入库**（防重名） |
| `readGroupsClean(root, names)` | 350 | `/api/list`、`/api/vgroups`、`resolveScope` |
| `statEntry` / `hasSubDir` / `listDir` | 489 / 511 / 524 | 列目录相关 |
| `sortEntries(list, sort)` | 542 | 服务端排序 |
| **`resolveScope(scope)`** | **559** | **`/api/list` + 全部批量接口**（分页与全选的交汇点） |
| `expandItems(b)` | 593 | 批量删除 / 移动 / 重命名 / 剪贴板 |

### 收件箱模块（2026-09-22 新增，`server.js:600` 起）

| 函数 | 行 | 干什么 |
|---|---|---|
| `readEdgePrefs()` | 635 | **同步 Edge 下载设置**（读 `Preferences` 的 `download.default_directory`），网页里只读展示，不另存一份 |
| `markSelfWrite(abs)` | 672 | 网页自己写的文件登记忽略 —— **新增写操作必须调它**，见踩坑 ⑥ |
| `snapshotTop(root)` | 692 | 根目录顶层文件名快照（用来判"谁是新的"） |
| `waitFileReady(abs)` | 709 | 等下载写完：大小稳定 + 同名 `.crdownload` 消失 |
| `matchSmartRule(name)` | 723 | 用 `config.smartRules` 判"文件名有没有意义" |
| `queueInboxItem(...)` | 731 | 入队 + SSE 推给页面 |
| **`ingestFile(...)`** | **750** | **入库唯一实现**：移动 + 改名（**后缀强制沿用原后缀**）+ 可选进虚拟分类 + 记住落点 |
| `autoIngestQuiet(...)` | 804 | 全自动 / smart 判为"名字有意义"时的静默入库 |
| `scanRoot(root)` | 816 | 扫顶层差集 → 按 `autoPolicy` 分派（`always` 弹 / `smart` 有条件弹 / `never` 静默） |
| `stopInbox` / `startInbox` | 850 / 859 | 挂/摘 `fs.watch`（roots 变化、开关变化都要重来） |
| `listIngestTargets()` | 885 | 入库可选位置：各根的文件夹（限深 3 / 上限 400 个）+ 虚拟分类 + 根目录 |

---

## 三、前端功能 → 行号（`public/app.js`）

### 配置与状态
| 名字 | 行 | 说明 |
|---|---|---|
| `TUNING` | 14 | 前端阈值兜底（启动后会被服务端 `limits` 覆盖） |
| `S` | 23 | **全局可变状态** |
| `S.internalClip` | 29 | 网页内部剪贴板（**≠ 系统剪贴板**） |
| `S.selectAll` | 40 | 全选整个视图 |

### 取数 / 渲染
| 功能 | 行 |
|---|---|
| **唯一 HTTP 出口** `api()` / `apiPost()` | 124 / 133 |
| `renderRoots` / `reloadConfig` / `selectRoot` | 367 / 402 / 417 |
| `buildTree` / `expandNode` / `bindTreeRow` | 431 / 550 / 453 |
| `navigateTo()` | 650 |
| `loadDir(p, append)` | 671 |
| `reloadCurrent()` / `loadMore()` | 717 / 730 |
| `sorted()` / `filtered()` / `injectedNodes()` | 799 / 814 / 820 |
| `renderContent(append)` | 835 |
| `renderGrid` / `renderList` | 876 / 910 |
| `fillThumb()` | 944 |
| **`visibleEntries()`（带缓存）** / `invalidateVisible()` | 1129 / 1138 |
| `Thumb`（IndexedDB 缩略图缓存） | 229 |

### 归类 / 转实体（**业务核心**）
| 功能 | 行 |
|---|---|
| `openNewVGroupDialog()` | 1537 |
| `assignToGroup()` / `unassignFiles()` | 1503 / 1517 |
| **`openMaterializeDialog()`** | **1613** |
| `deleteVGroup()` | 1598 |
| 散-未归类常量 `LOOSE` / `VG_PREFIX` | 56 起 |

### 复制到剪贴板（**踩过两次坑**）
| 入口 | 行 |
|---|---|
| 底部按钮 | 1158 |
| 右键菜单 | 2377 |
| `Ctrl+C` | 2895 |
| **唯一实现** `copyToClipboard()` | **2490** |
| 网页内部复制 `S.internalClip` | **和上面毫无关系** |

### 收件箱 / 新文件入库卡片（2026-09-22 新增）
| 功能 | 行 |
|---|---|
| `connectInbox()` —— SSE 接入 + 启动时兜底拉 `/api/inbox` | 1848 |
| `enqueueInbox(item)` —— 去重入队 + 记操作日志 | 1859 |
| `showNextIngest()` —— 一次只弹一张 | 1869 |
| **`openIngestCard(item)`** —— 卡片本体：预览 + **主名/后缀分离** + 目标选择 | **1876** |
| `openSettings()` —— Edge 同步**只读展示** + 策略 + 监听开关 | 2067 |
| `isFileDrag(ev)` —— 判"是不是从系统拖进来的文件" | 2549 |
| `bindDragDropEvents()` —— **dragover/drop 必须 preventDefault**，见踩坑 ⑦ | 2729 |

### 事件绑定（已拆分，**不要再加链式调用**）
| 函数 | 行 | 行数 |
|---|---|---|
| `bindEvents()` | 2561 | **只负责调用 7 个子函数** |
| `bindToolbarEvents()` | 2572 | 28 |
| `bindLogEvents()` | 2600 | 25 |
| `bindNavEvents()` | 2625 | 25 |
| `bindContentEvents()` | 2650 | 51 |
| `bindOverlayEvents()` | 2701 | 28 |
| `bindDragDropEvents()` | 2729 | 112 |
| `bindKeyboardEvents()` | 2841 | 77 |

### 其它
| 功能 | 行 |
|---|---|
| 文件操作 `renameEntry` / `moveItems` / `openNewFolderDialog` | 1409 / 1696 / 1730 |
| 文本编辑 / 上传 | 1767 / 1794 |
| 投放素材助手 `openDeliverMenu` / `openDeliverPanel` | 2156 / 2200 |
| `openHelp()` | 2275 |
| 搜索 `onSearchInput()` / `doSearch()` | 2303 / 2315 |
| 右键菜单 `showCtxMenu()` | 2336 |
| `revealInExplorer()` | 2483 |
| 添加根目录 `openAddRootDialog()` | 1963 |
| 回收站 `openTrash()` / `renderTrash()` | 1033 / 1045 |
| 灯箱 `openEntry` / `openLightbox` | 1219 / 1228 |
| 启动 `init()`（末尾调 `connectInbox()`） | 2918 |

---

## 四、⚠️ 踩坑记录（真实发生过的，别再犯）

### ① 拆分函数后，**必须验证每个函数被调用几次**

用"插入边界"技巧拆 `bindEvents` 时形成了链式调用：

```js
function bindEvents() {
  bindLogEvents();     // ← 它末尾又调 bindNavEvents()
  bindNavEvents();     // ← 它末尾又调 bindContentEvents()
  ...
}
```

叠加结果：**`bindKeyboardEvents` 被调用 6 次** → `keydown` 监听器注册 6 个 →
按一次 `Ctrl+C` 发 6 个请求 → 6 个 PowerShell 抢剪贴板 → `CLIPBRD_E_CANT_OPEN`。

**改完必须跑这条检查**：
```powershell
Select-String -Path public\app.js -Pattern "^  bind[A-Z]\w+\(\);$"
# 应该只有 bindEvents 里的 7 个 + init 里的 1 个
```

### ② PowerShell 传参必须用 `-EncodedCommand`

用 `-Command` 拼字符串时，路径含空格/括号（例如 `9月9日 (1)(1).png`）会被命令行拆开。
`-EncodedCommand` 传 UTF-16LE Base64，**任何字符都不会被解析**。

同样地，`[Console]::OutputEncoding=[Text.Encoding]::UTF8` 必加，否则中文输出乱码。

### ③ "复制"有两个完全不同的东西

- `copyToClipboard()` → **Windows 系统剪贴板**（能粘到豆包）
- `S.internalClip` → **网页内部剪贴板**（只能粘贴到别的文件夹）

**曾经 `Ctrl+C` 绑的是后者，还弹"已复制 N 项"的假提示**，导致排查了十几轮。
**规矩：凡"复制"字样，必须写清是哪一个。**

### ④ 虚拟路径不能当真实路径发给后端

`LOOSE`（`::loose::`）和 `VG_PREFIX`（`::vg::`）是**虚拟路径**，
所有发给后端的 path 都要先过 `realPath()`；所有批量操作都要先过滤 `isVirtualPath()`。

### ⑤ 改前端代码后，**必须 Ctrl+F5 才能生效**

浏览器里的 JS 是页面加载那一刻装进去的 —— 重启服务、重启电脑都不影响它。
**排查"界面没变化"之前，先确认页面刷新过。**
（改后端则相反：**必须重启 `node`**，热更新不存在。）

### ⑥ 收件箱：网页自己的写操作**必须**调 `markSelfWrite()`

监听器靠"顶层文件名差集"判断新文件。上传 / 改名 / 移动 / 从回收站恢复，
在监听器眼里**全都是"凭空冒出来的新文件"** —— 不登记就会把自己的操作弹成"新下载"。

已登记的：`/api/upload`、`/api/text`、`/api/rename`、`/api/rename-batch`、
`/api/move`、`/api/copy`、`/api/trash/restore`。
**以后新增任何"往根目录顶层写文件"的接口，都要加一行 `markSelfWrite(目标绝对路径)`。**

`markSelfWrite` 做两件事（双保险）：写忽略表（60 秒）+ 直接塞进该根的快照集合。

### ⑦ 从资源管理器拖文件进页面，`dragover`/`drop` **必须** `preventDefault()`

只在 `drop` 里处理是不够的：外部文件拖入时 `S.dragPaths` 为空，
`dragover` 若不 `preventDefault()`，浏览器判定"页面不是放置目标" →
**drop 事件根本不派发**，浏览器直接开新标签页打开那个文件（页面被截胡，上传永远收不到）。

正确写法（`bindDragDropEvents` 2729）：`dragover` 里用 `isFileDrag(ev)` 判断是否含 `Files`
类型并 `preventDefault()`；`drop` 里**开头无条件** `preventDefault()`。
（拖到浏览器标签栏/书签栏上仍会打开文件 —— 那是浏览器自己的区域，网页无权拦。）

---

## 五、常见故障定位表

| 症状 | 先查这里 |
|---|---|
| 复制到剪贴板失败 | `debug.log` → `copyToClipboard()` 2490 → `withClipboardLock` 200 → `psArgs` 191 |
| 一次操作触发多次 | **踩坑 ①**，跑那条检查命令 |
| 归类后计数不对 | `resolveScope()` 559（同时服务 `/api/list` 和批量接口） |
| 列表卡 / 白屏 | `/api/list` 1100 的分页参数；`renderContent` 是否被当全量渲染调用 |
| 路径越权 | `resolveSafe()` 262 —— **所有**路径必须过它 |
| 树上三角不显示 | `/api/tree` 1132 返回的 `hasChildren` |
| 豆包侧边栏没反应 | `public/tools/doubao-helper.user.js`，先看豆包页 Console 的 `[素材助手]` |
| 界面改了没反应 | **踩坑 ⑤**：页面刷新过吗；改的是后端吗（要重启 node） |
| 下载完了却不弹入库卡片 | 设置里「监听根目录里的新文件」勾上没 → `debug.log` 搜 `[收件箱]` → `startInbox()` 859 / `scanRoot()` 816 |
| 网页自己的操作也弹卡片 | 那个写接口漏了 `markSelfWrite()`，见踩坑 ⑥ |
| 卡片弹了但入库没反应 | `/api/inbox/ingest` 1027；目标根目录是否还在（`getRoot` 280） |
| 拖文件进来变成打开新标签页 | **踩坑 ⑦**，看 `bindDragDropEvents` 2729 的 `dragover` |
| 改完 Edge 下载目录但网页没变 | 网页每次打开设置都重读 `readEdgePrefs()` 635，点「重新读取 Edge 设置」；Edge 开着"下载前询问"时手选的位置不可知 |

---

## 六、配置与阈值（已收敛，不要再撒字面量）

**后端** `server.js:82` 的 `DEFAULT_CONFIG.limits` —— 单一数据源，通过 `/api/config` 下发：

| 键 | 值 | 用途 |
|---|---|---|
| `pageDefault` | 200 | `/api/list` 每页 |
| `pageMax` | 1000 | 每页上限 |
| `searchDefault` | 100 | 搜索每页 |
| `searchMax` | 500 | 搜索结果上限 |
| `searchDepth` | 8 | 搜索递归层数 |
| `textPreviewBytes` | 2MB | 文本预览上限 |

**前端** `app.js:14` 的 `TUNING` —— 只是兜底，启动时被服务端 `limits` 覆盖。

**收件箱相关配置**（都在 `server.js:67` 的 `DEFAULT_CONFIG` 里，经 `/api/config` 存进 `data.db` 的 `settings` 表）：

| 键 | 值 | 用途 |
|---|---|---|
| `autoPolicy` | `smart` \| `always` \| `never` | 新文件到达时：智能判定 / 总是询问 / 全自动入库 |
| `inboxEnabled` | `true` | 是否监听根目录的新文件（关掉就完全不打扰） |
| `lastIngestTarget` | `{root, path, gid}` | **全自动的落点**，每次入库后自动更新 |
| `smartRules` | 5 条正则 | 判"文件名有没有意义"（纯数字 / 16 进制串 / `img_1234` …） |

> ⚠️ **收件箱目录不在配置里**。它永远实时读 Edge 的 `download.default_directory`
> （`readEdgePrefs()` 635）—— 用户只改 Edge 一处，网页自动跟随。

**仍未收敛的**：油猴脚本/扩展里的 `http://127.0.0.1:8899`、`MAX_BYTES=200MB`。

---

## 七、已完成 / 未完成的优化

### ✅ 已完成（对应《代码质量总纲》）

| 项 | 成果 |
|---|---|
| 职责拆分 | `bindEvents` **313 → 10 行**，拆成 7 个子函数 |
| 配置与代码分离 | 硬编码 → `config.limits` + `TUNING`，服务端单一数据源 |
| 性能（后端） | `LOG()` 每请求同步写盘 → 内存攒批 + 每秒落盘 |
| 性能（后端） | `spawnSync` → 异步 `runCommand`，不再阻塞事件循环 |
| 性能（前端） | `visibleEntries()` 8 处重复排序 → 1 次计算 + 缓存 |
| 死代码 | 删除未使用的 `MIGRATED` |
| 错误处理诚实 | CLIXML 清洗，露出真实错误原因 |
| **收件箱监听**（2026-09-22） | Edge 下载设置同步 + `fs.watch` 三档策略 + 入库卡片（可选目标 + 改名后缀保护 + 自产不弹） |
| **拖拽截胡**（2026-09-22） | 外部文件拖入不再被浏览器打开（踩坑 ⑦） |

### ⏳ 未完成（风险较高，需单独一轮）

| 项 | 为什么先停 |
|---|---|
| 拆 33 个路由 handler | 每个 handler 要整段搬迁（`if` 链不能用插入边界切开），路由是全局唯一入口 |
| `listDir` 逐文件 `stat` 加缓存 | 涉及正确性，缓存失效判错会显示过期数据 |
| 前端 41 处裸拼 `/api/` URL | 需要一层 API 封装，改动面广 |

---

## 八、Git

```
D:\文件管理\.git
25b6eb2  baseline: 漫剧素材管理器可用版
617e364  fix: Ctrl+C 触发 6 次复制 & 剪贴板并发抢占
```

`.gitignore` 已排除运行时数据（`data.db*`、`debug.log`、`*.bak`）。

```powershell
git checkout -- server.js     # 撤销单个文件
git reset --hard 617e364      # 回到某次提交
```
