# 代码地图 CODE_MAP

> **给未来的自己看的定位手册。** 出问题时先查这里，别再从三千行里翻。
> 行号 = 2026-09-21 实测快照（`Select-String` 核对过），代码改动后请顺手更新。

---

## 一、文件职责

| 文件 | 行数 | 唯一职责 | **不该出现** |
|---|---|---|---|
| `server.js` | 1207 | HTTP 服务、路由分发、文件系统 IO | 业务规则、界面文案 |
| `db.js` | ~160 | SQLite 存取（Node 内置 `node:sqlite`） | HTTP 概念、路径安全 |
| `public/app.js` | 2663 | 界面逻辑 | 直接拼 API URL（**待改，41 处**） |
| `public/index.html` | 145 | DOM 骨架 | 逻辑 |
| `public/style.css` | ~720 | 样式 | — |
| `public/tools/` | — | 投放素材助手：油猴脚本 + 安装页 + 探针页 | — |
| `extension/` | — | 同一功能的 Edge 扩展版 | — |

**依赖方向**：`界面 → HTTP API → db.js → data.db`，**单向**。

---

## 二、后端 API（33 个分支，全部挤在 `server.js:493` 那一个函数里）

| 路由 | 行号 | 干什么 |
|---|---|---|
| `GET /api/config` | 547 | 读设置 + 根目录 |
| `POST /api/config` | 559 | 改设置 |
| `POST /api/roots` | 569 | 添加根目录 |
| `DELETE /api/roots/:id` | 584 | 移除根目录（不删文件） |
| `GET /api/fs/drives` | 594 | 列盘符 |
| `GET /api/fs/dirs` | 598 | 目录选择器 |
| **`GET /api/list`** | **617** | **分页列目录（核心）** |
| `GET /api/tree` | 648 | 左树懒加载一层 |
| `GET /api/file` | 670 | 文件流（支持 Range） |
| `GET /api/text` | 676 | 读文本 |
| `POST /api/text` | 687 | 写文本 |
| `PUT /api/upload` | 696 | 上传 |
| `POST /api/mkdir` | 717 | 新建文件夹 |
| `POST /api/mkdir-template` | 729 | 按模板建项目 |
| `POST /api/rename` | 746 | 重命名 |
| `POST /api/rename-batch` | 760 | 批量重命名 |
| `POST /api/move` `/api/copy` | 792 | 移动 / 复制 |
| `POST /api/delete` | 826 | 删除到回收站 |
| `GET /api/trash` | 846 | 回收站列表 |
| `POST /api/trash/restore` | 865 | 恢复 |
| `POST /api/trash/purge` | 890 | 彻底删除 |
| `GET /api/search` | 905 | 全盘搜文件名（分页） |
| `GET /api/vgroups` | 947 | 读虚拟分类 |
| `POST /api/vgroups` | 952 | 新建虚拟分类 |
| `POST /api/vgroups/update` | 971 | 改名 |
| `POST /api/vgroups/assign` | 983 | 归类 / 取消归类 |
| `POST /api/vgroups/delete` | 1001 | 解散分组 |
| **`POST /api/vgroups/materialize`** | **1015** | **转实体**（平移 / 复制） |
| `GET /api/duplicates` | 1072 | 重复文件检测 |
| **`POST /api/clipboard`** | **1091** | **复制到系统剪贴板** |
| `POST /api/reveal` | 1137 | 在资源管理器中定位 |
| `GET /api/sysinfo` | 1155 | 系统信息 |

### 复用型内部函数（改一个，影响一片 —— 必做全量回归）

| 函数 | 行号 | 被谁用 |
|---|---|---|
| `LOG(msg)` | 136 | 排查日志（**每个 API 请求同步写盘，隐患**） |
| **`resolveSafe(root, rel)`** | **169** | **所有**路径入口（安全命脉，任何路径必须过它） |
| `getRoot(id)` | 187 | 所有带 `root` 参数的接口 |
| `uniqueName(dir, name)` | 193 | 上传 / 改名 / 移动 / 转实体（防重名） |
| `readGroupsClean(root, names)` | 257 | `/api/list`、`/api/vgroups`、`resolveScope` |
| `listDir(root, rel)` | 431 | 几乎所有读操作 |
| `sortEntries(list, sort)` | 449 | `/api/list`、`/api/search` |
| **`resolveScope(scope)`** | **466** | **`/api/list` + 全部批量接口**（分页与全选的交汇点） |
| `expandItems(b)` | 500 | 批量删除 / 移动 / 重命名 / 剪贴板 |

---

## 三、前端功能 → 函数 → 行号（`public/app.js`）

### 状态
| 名字 | 行号 | 说明 |
|---|---|---|
| `S` | 12 | **全局可变状态**，111 个函数都读写 |
| `S.internalClip` | 29 | 网页内部剪贴板（**≠ 系统剪贴板**） |
| `S.selectAll` | 40 | 全选整个视图 |

### 取数 / 渲染
| 功能 | 函数 | 行号 |
|---|---|---|
| **唯一 HTTP 出口** | `api()` / `apiPost()` | 111 / 116 |
| 列目录（分页） | `loadDir(p, append)` | 643 |
| 排序筛选变更后重拉 | `reloadCurrent()` | 693 |
| 滚动加载下一页 | `loadMore()` | 705 |
| 当前可见条目 | `visibleEntries()` | 1108 |
| 渲染入口 | `renderContent(append)` | 826 |
| 网格渲染 / 列表渲染 | `renderGrid` / `renderList` | 859 / 892 |
| 缩略图 + 视频首帧 | `fillThumb()` | 914 |
| 缩略图缓存 | `Thumb`（IndexedDB） | 213 |

### 归类 / 转实体（**业务核心，别碰**）
| 功能 | 行号 |
|---|---|
| 虚拟新建 | `openNewVGroupDialog()` 1492 |
| 拖拽归类 / 取消归类 | `assignToGroup()` 1465 / `unassignFiles()` 1478 |
| **转实体弹窗** | `openMaterializeDialog()` **1566** |
| 删除虚拟分类 | `deleteVGroup()` 1449 |
| 散-未归类常量 | `LOOSE` / `LOOSE_NAME` / `VG_PREFIX` 56 起 |

### 复制到剪贴板（**踩过坑**）
| 入口 | 行号 |
|---|---|
| 底部按钮 | 1131 |
| 右键菜单 | 2203 |
| `Ctrl+C` | 2656 |
| **唯一实现** | **`copyToClipboard()` 2316** → `POST /api/clipboard` |
| 网页内部复制 | `S.internalClip` —— **和上面毫无关系** |

> ⚠️ **历史教训**：`Ctrl+C` 曾走"网页内部剪贴板"（另一套代码），还弹"已复制 N 项"的假提示，
> 导致"粘不到豆包"排查了十几轮。
> **规矩：凡"复制"字样，必须写清是「系统剪贴板」还是「网页剪贴板」。**

### 其它
| 功能 | 行号 |
|---|---|
| 事件绑定（**312 行，待拆**） | 2372 |
| 快捷键总表 | 2619 起 |
| 右键菜单构造 | `showCtxMenu()` 2133 |
| 投放素材助手面板 | `openDeliverPanel()` 1999 |
| 设置面板 | `openSettings()` 1894 |

---

## 四、常见故障定位表

| 症状 | 先查这里 |
|---|---|
| 复制到剪贴板不生效 | ① `debug.log`（全流程有记录）② `copyToClipboard()` 2316 ③ 三个入口是否都指向它 |
| 归类后计数不对 | `resolveScope()` 466 —— 同时服务 `/api/list` 和批量接口 |
| 列表卡 / 白屏 | `/api/list` 分页参数 617；`renderContent` 是否被当全量渲染调用 |
| 路径越权 | `resolveSafe()` 169 —— **所有**路径必须过它 |
| 树上三角不显示 | `/api/tree` 648 返回的 `hasChildren` |
| 豆包侧边栏没反应 | `public/tools/doubao-helper.user.js`，先看豆包页 Console 的 `[素材助手]` |
| 虚拟分类"不存在" | 传的 `id` 是否为空（左树节点曾漏带 `id`） |
| 服务起不来 | `data.db` 是否被占用；端口 8899 是否被别的进程占 |

---

## 五、硬编码清单（**待收敛到配置**）

| 值 | 位置 |
|---|---|
| `pageLimit: 200` | app.js:35 |
| 搜索 `limit=100` | app.js:2149 |
| 缩略图 `480` / `120` | app.js:305 / 888 / 923 |
| `maxResults=500` | server.js:910 |
| `maxDepth=8` | server.js:911 |
| `MAX_BYTES=200MB` | 油猴脚本 & 扩展 |
| `http://127.0.0.1:8899` | 油猴脚本 & 扩展 |

---

## 六、已知隐患（详见体检报告）

1. `server.js:1115` `spawnSync` —— **HTTP 请求里同步阻塞事件循环**
2. `server.js:136` `LOG()` —— 每个 API 请求同步 `appendFileSync`
3. `server.js:440` —— 逐文件 `stat`，2000 文件约 250ms
4. `server.js:905` —— 搜索全盘递归，扫完才返回
5. `app.js:1108` `visibleEntries()` —— 8 处调用，每次重排全表
6. `server.js:449` vs `app.js:785` —— **排序逻辑前后端各写一遍**
