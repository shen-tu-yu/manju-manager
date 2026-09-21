# 代码地图 CODE_MAP

> **给未来的自己看的定位手册。** 出问题时先查这里，别再从三千行里翻。
> 行号 = 2026-09-21 实测快照（`Select-String` 核对过），代码改动后**必须刷新行号**。

---

## 一、文件职责

| 文件 | 行数 | 唯一职责 | **不该出现** |
|---|---|---|---|
| `server.js` | 1288 | HTTP 服务、路由分发、文件系统 IO、外部命令 | 业务规则、界面文案 |
| `db.js` | ~160 | SQLite 存取（Node 内置 `node:sqlite`） | HTTP 概念、路径安全 |
| `public/app.js` | 2719 | 界面逻辑 | 直接拼 API URL（**待改，41 处**） |
| `public/index.html` | 145 | DOM 骨架 | 逻辑 |
| `public/style.css` | ~720 | 样式 | — |
| `public/tools/` | — | 投放素材助手：油猴脚本 + 安装页 + 探针页 | — |
| `extension/` | — | 同一功能的 Edge 扩展版 | — |

**依赖方向**：`界面 → HTTP API → db.js → data.db`，**单向**。

---

## 二、后端 API（33 个分支，全在 `server.js:604` 那个函数里）

| 路由 | 行 | 路由 | 行 |
|---|---|---|---|
| `GET /api/config` | 637 | `POST /api/delete` | 921 |
| `POST /api/config` | 650 | `GET /api/trash` | 941 |
| `POST /api/roots` | 660 | `POST /api/trash/restore` | 960 |
| `DELETE /api/roots/:id` | 675 | `POST /api/trash/purge` | 985 |
| `GET /api/fs/drives` | 685 | `GET /api/search` | 1000 |
| `GET /api/fs/dirs` | 689 | `GET /api/vgroups` | 1043 |
| **`GET /api/list`** | **708** | `POST /api/vgroups` | 1048 |
| `GET /api/tree` | 740 | `POST /api/vgroups/update` | 1067 |
| `GET /api/file` | 762 | `POST /api/vgroups/assign` | 1079 |
| `GET /api/text` | 768 | `POST /api/vgroups/delete` | 1097 |
| `POST /api/text` | 782 | **`POST /api/vgroups/materialize`** | **1111** |
| `PUT /api/upload` | 791 | `GET /api/duplicates` | 1168 |
| `POST /api/mkdir` | 812 | **`POST /api/clipboard`** | **1187** |
| `POST /api/mkdir-template` | 824 | `POST /api/reveal` | 1232 |
| `POST /api/rename` | 841 | `GET /api/sysinfo` | 1250 |
| `POST /api/rename-batch` | 855 | | |
| `POST /api/move` `/api/copy` | 887 | | |

### 后端内部函数（改一个影响一片，必须全量回归）

| 函数 | 行 | 被谁用 / 说明 |
|---|---|---|
| `LOG(msg)` | 155 | **内存攒批 + 每秒落盘**（不要再改回 `appendFileSync`） |
| `flushLog()` | 161 | 批量写盘，超 1MB 自动清空 |
| `psArgs(script)` | 188 | **PowerShell 必须走 `-EncodedCommand`**（见踩坑 ②） |
| `withClipboardLock(fn)` | 197 | 剪贴板写入串行化（见踩坑 ①） |
| `cleanPsOutput()` | 204 | 剥掉 CLIXML，露出真实错误 |
| `runCommand()` | 216 | **异步**执行外部命令，替代 `spawnSync` |
| **`resolveSafe(root, rel)`** | **259** | **所有**路径入口（安全命脉） |
| `getRoot(id)` | 277 | 所有带 `root` 参数的接口 |
| `uniqueName(dir, name)` | 283 | 上传 / 改名 / 移动 / 转实体（防重名） |
| `readGroupsClean(root, names)` | 347 | `/api/list`、`/api/vgroups`、`resolveScope` |
| `statEntry` / `hasSubDir` / `listDir` | 486 / 508 / 521 | 列目录相关 |
| `sortEntries(list, sort)` | 539 | 服务端排序 |
| **`resolveScope(scope)`** | **556** | **`/api/list` + 全部批量接口**（分页与全选的交汇点） |
| `expandItems(b)` | 590 | 批量删除 / 移动 / 重命名 / 剪贴板 |

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
| 底部按钮 | 1141 附近 |
| 右键菜单 | 2210 附近 |
| `Ctrl+C` | 2690 附近 |
| **唯一实现** `copyToClipboard()` | **2343** |
| 网页内部复制 `S.internalClip` | **和上面毫无关系** |

### 事件绑定（已拆分，**不要再加链式调用**）
| 函数 | 行 | 行数 |
|---|---|---|
| `bindEvents()` | 2403 | **只负责调用 7 个子函数** |
| `bindToolbarEvents()` | 2414 | 27 |
| `bindLogEvents()` | 2442 | 25 |
| `bindNavEvents()` | 2467 | 25 |
| `bindContentEvents()` | 2492 | 51 |
| `bindOverlayEvents()` | 2543 | 28 |
| `bindDragDropEvents()` | 2571 | 104 |
| `bindKeyboardEvents()` | 2675 | 75 |

### 其它
| 功能 | 行 |
|---|---|
| 文件操作 `renameEntry` / `moveItems` / `openNewFolderDialog` | 1409 / 1696 / 1730 |
| 文本编辑 / 上传 | 1767 / 1794 |
| 投放素材助手 `openDeliverMenu` / `openDeliverPanel` | 2009 / 2053 |
| `openHelp()` | 2128 |
| 搜索 `onSearchInput()` / `doSearch()` | 2156 / 2168 |
| 右键菜单 `showCtxMenu()` | 2189 |
| `revealInExplorer()` | 2336 |
| 添加根目录 `openAddRootDialog()` | 1840 |
| 回收站 `openTrash()` / `renderTrash()` | 1033 / 1045 |
| 灯箱 `openEntry` / `openLightbox` | 1219 / 1228 |
| 启动 `init()` | 2752 |

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

---

## 五、常见故障定位表

| 症状 | 先查这里 |
|---|---|
| 复制到剪贴板失败 | `debug.log` → `copyToClipboard()` 2343 → `withClipboardLock` 197 → `psArgs` 188 |
| 一次操作触发多次 | **踩坑 ①**，跑那条检查命令 |
| 归类后计数不对 | `resolveScope()` 556（同时服务 `/api/list` 和批量接口） |
| 列表卡 / 白屏 | `/api/list` 708 的分页参数；`renderContent` 是否被当全量渲染调用 |
| 路径越权 | `resolveSafe()` 259 —— **所有**路径必须过它 |
| 树上三角不显示 | `/api/tree` 740 返回的 `hasChildren` |
| 豆包侧边栏没反应 | `public/tools/doubao-helper.user.js`，先看豆包页 Console 的 `[素材助手]` |
| 界面改了没反应 | **踩坑 ⑤**：页面刷新过吗 |

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
