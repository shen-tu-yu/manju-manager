# 代码索引 CODE_MAP.index

> **本文件由 `node map.js` 自动生成，不要手改。**
> 职责、规则、踩坑、排查表在 **[`CODE_MAP.md`](CODE_MAP.md)**（那份不含行号，所以不用维护）。
> 生成时间：2026/9/22 16:41:15

查行号最快的办法：`node map.js <关键词>`（例：`node map.js 收件箱`）。

## 一、文件行数

| 文件 | 行数 |
|---|---|
| `server.js` | 1812 |
| `db.js` | 155 |
| `public/app.js` | 3028 |
| `public/index.html` | 147 |
| `public/style.css` | 725 |

## 二、后端路由（37 个分支，全在 `http.createServer` 里）

| 行 | 方法 | 路由 |
|---|---|---|
| 1017 | GET | `/api/config` |
| 1033 | POST | `/api/config` |
| 1049 | GET | `/api/edge` |
| 1066 | GET | `/api/events` |
| 1080 | GET | `/api/inbox` |
| 1089 | GET | `/api/inbox/targets` |
| 1094 | POST | `/api/inbox/ingest` |
| 1117 | POST | `/api/roots` |
| 1133 | DELETE | `/api/roots/` |
| 1144 | GET | `/api/fs/drives` |
| 1148 | GET | `/api/fs/dirs` |
| 1167 | GET | `/api/list` |
| 1199 | GET | `/api/tree` |
| 1221 | GET | `/api/file` |
| 1227 | GET | `/api/text` |
| 1241 | POST | `/api/text` |
| 1251 | PUT | `/api/upload` |
| 1280 | POST | `/api/mkdir` |
| 1292 | POST | `/api/mkdir-template` |
| 1309 | POST | `/api/rename` |
| 1324 | POST | `/api/rename-batch` |
| 1357 | POST | `/api/move` · `/api/copy` |
| 1392 | POST | `/api/delete` |
| 1412 | GET | `/api/trash` |
| 1431 | POST | `/api/trash/restore` |
| 1457 | POST | `/api/trash/purge` |
| 1472 | GET | `/api/search` |
| 1515 | GET | `/api/vgroups` |
| 1520 | POST | `/api/vgroups` |
| 1539 | POST | `/api/vgroups/update` |
| 1551 | POST | `/api/vgroups/assign` |
| 1569 | POST | `/api/vgroups/delete` |
| 1583 | POST | `/api/vgroups/materialize` |
| 1640 | GET | `/api/duplicates` |
| 1659 | POST | `/api/clipboard` |
| 1704 | POST | `/api/reveal` |
| 1722 | GET | `/api/sysinfo` |

## 三、后端函数 / 常量（55 个函数）

| 行 | 名字 | 说明 |
|---|---|---|
| 54 | `extOf()` |  |
| 56 | `kindOf()` |  |
| 97 | `loadConfig()` |  |
| 105 | `saveConfig()` |  |
| 138 | `sendJSON()` |  |
| 159 | `LOG()` |  |
| 165 | `flushLog()` |  |
| 192 | `psArgs()` | / |
| 201 | `withClipboardLock()` |  |
| 208 | `cleanPsOutput()` | PowerShell 走 stderr 时会吐 CLIXML（进度/错误都在里面），这里挑出人话 |
| 220 | `runCommand()` |  |
| 237 | `sendError()` |  |
| 243 | `readJSONBody()` |  |
| 263 | `resolveSafe()` | 把「相对于根的 POSIX 路径」解析成绝对路径，并保证不越界 |
| 276 | `toRel()` | 绝对路径 -> 相对根的 POSIX 路径 |
| 281 | `getRoot()` |  |
| 287 | `uniqueName()` |  |
| 301 | `assertValidName()` |  |
| 310 | `listDrives()` |  |
| 334 | `saveVGroupsFile()` |  |
| 339 | `groupsOf()` |  |
| 351 | `readGroupsClean()` | / |
| 378 | `trashDirOf()` | ---------------------------------------------------------------- 回收站 |
| 379 | `trashIndexPath()` |  |
| 381 | `readTrashIndex()` |  |
| 389 | `writeTrashIndex()` |  |
| 395 | `moveToTrash()` | 删除（移动）到回收站 |
| 418 | `serveStatic()` | ---------------------------------------------------------------- 静态文件 |
| 439 | `streamFile()` | ---------------------------------------------------------------- 文件流（支持… |
| 490 | `statEntry()` | ---------------------------------------------------------------- 目录列举 |
| 512 | `hasSubDir()` | / |
| 525 | `listDir()` |  |
| 543 | `sortEntries()` | 服务端排序 —— 分页之后排序必须在这里做，否则只排当前页 |
| 560 | `resolveScope()` | / |
| 594 | `expandItems()` | 批量接口入参：给明确 items，或给 scope（= 全选当前视图的全部文件） |
| 628 | `edgeUserDataDir()` |  |
| 638 | `readEdgePrefs()` | / |
| 675 | `markSelfWrite()` | 网页自己写入的文件：登记忽略，否则监听器会把自己的操作当成"新下载" |
| 687 | `isSelfWrite()` |  |
| 695 | `snapshotTop()` |  |
| 704 | `sseSend()` |  |
| 712 | `waitFileReady()` | 等文件写完：同级还有 .crdownload、或大小还在变，都不算下载完成 |
| 726 | `matchSmartRule()` | 文件名"有没有意义"：命中设置里的 smartRules 正则就算没意义 |
| 734 | `queueInboxItem()` |  |
| 753 | `ingestFile()` | / |
| 820 | `autoIngestQuiet()` | 「全自动：直接入库不打扰」/ smart 判定为"名字有意义"时走这里 |
| 838 | `dispatchNewFile()` | / |
| 863 | `scanRoot()` | 扫一个根目录的顶层，找出"新增的文件"并按策略分派 |
| 889 | `stopInbox()` |  |
| 898 | `startInbox()` | （重新）挂上所有根目录的监听。roots 变了、开关变了都要重来一遍 |
| 924 | `ingestKey()` | 入库位置的唯一标识（虚拟分类靠 gid 区分，文件夹靠相对路径） |
| 929 | `collectDirs()` | 递归列文件夹（DFS + 带层级 depth），最多 limit 个 |
| 950 | `listIngestTargets()` | / |
| 1768 | `openBrowser()` | 服务就绪后自动打开浏览器（启动.bat 传 --open 时启用） |
| 1799 | `addRoot()` |  |

## 四、前端函数 / 常量（126 个函数）

| 行 | 名字 | 说明 |
|---|---|---|
| 64 | `realPath()` | 虚拟路径（散-未归类 / 虚拟分类）背后真实的目录，永远是根目录 |
| 73 | `fmtSize()` |  |
| 81 | `fmtDur()` |  |
| 88 | `fmtTime()` |  |
| 98 | `kindOfName()` |  |
| 108 | `joinPath()` |  |
| 109 | `parentOf()` |  |
| 110 | `baseName()` |  |
| 112 | `esc()` |  |
| 116 | `fileUrl()` |  |
| 124 | `api()` |  |
| 133 | `apiPost()` |  |
| 180 | `fmtClock()` |  |
| 186 | `renderLogButton()` |  |
| 194 | `renderLogPanel()` |  |
| 214 | `toast()` |  |
| 303 | `makeThumbBlob()` | 画布生成缩略图 |
| 344 | `revokeUrls()` |  |
| 360 | `observeLazy()` |  |
| 367 | `renderRoots()` |  |
| 402 | `reloadConfig()` |  |
| 417 | `selectRoot()` |  |
| 431 | `buildTree()` |  |
| 453 | `bindTreeRow()` |  |
| 519 | `openNode()` | 展开一个节点（已加载过就只切换显示，不重复请求） |
| 530 | `closeNode()` | 收起一个节点 |
| 539 | `toggleNode()` |  |
| 550 | `expandNode()` | / |
| 620 | `markTreeActive()` |  |
| 625 | `reloadTreeNode()` | 目录内容变了，重新加载对应的树节点（保持展开状态） |
| 633 | `ensureVisible()` | 逐级展开，让目标路径的节点在树里可见 |
| 650 | `navigateTo()` |  |
| 663 | `loadVGroups()` |  |
| 671 | `loadDir()` |  |
| 717 | `reloadCurrent()` | 排序 / 筛选变化后回到第一页重新拉 |
| 730 | `loadMore()` | 滚到底自动加载下一页 |
| 741 | `refresh()` |  |
| 749 | `setStatus()` |  |
| 751 | `renderBreadcrumb()` |  |
| 784 | `showEmpty()` |  |
| 799 | `sorted()` |  |
| 814 | `filtered()` | 只看图片 / 只看视频时，文件夹和虚拟节点一并隐藏 —— 它们不是你要看的东西 |
| 820 | `injectedNodes()` | 根目录视图里要额外插入的虚拟节点：虚拟分类 + 散-未归类 |
| 835 | `renderContent()` |  |
| 870 | `appendTarget()` | append=true 时只追加还没渲染过的条目，不重建已有 DOM |
| 876 | `renderGrid()` |  |
| 910 | `renderList()` |  |
| 944 | `fillThumb()` | 填充缩略图（图片 / 视频首帧） |
| 1033 | `openTrash()` |  |
| 1045 | `renderTrash()` |  |
| 1100 | `trashRestore()` |  |
| 1111 | `trashPurge()` |  |
| 1129 | `visibleEntries()` |  |
| 1138 | `invalidateVisible()` | 数据变了就作废缓存（renderContent 开头会调） |
| 1140 | `updateSelectionStatus()` |  |
| 1194 | `clickSelect()` |  |
| 1215 | `previewable()` |  |
| 1219 | `openEntry()` |  |
| 1228 | `openLightbox()` |  |
| 1235 | `closeLightbox()` |  |
| 1241 | `renderLightbox()` |  |
| 1275 | `renderStrip()` |  |
| 1303 | `lbStep()` |  |
| 1312 | `selectedItems()` |  |
| 1319 | `isSelected()` | 某个条目是否处于「选中」状态（全选模式下，连还没加载出来的也算） |
| 1324 | `scopePayload()` | 当前视图范围 —— 交给后端自己算出「全部文件」，不受分页限制 |
| 1335 | `viewLabel()` | 当前视图叫什么（写日志用） |
| 1345 | `selectionBody()` | 批量操作的请求体：全选时给 scope，否则给明确 items |
| 1352 | `clearSelectAll()` |  |
| 1354 | `deleteSelected()` |  |
| 1409 | `renameEntry()` |  |
| 1423 | `openBatchRename()` |  |
| 1503 | `assignToGroup()` | 把文件归入某个虚拟分类 —— 只写引用，文件本体不动 |
| 1517 | `unassignFiles()` | 取消归类：从所有虚拟分类里移除引用 |
| 1537 | `openNewVGroupDialog()` | 虚拟新建：创建一个虚拟分类，并把当前选中的文件归进去 |
| 1587 | `renameVGroup()` |  |
| 1598 | `deleteVGroup()` |  |
| 1613 | `openMaterializeDialog()` | 虚拟分类 -> 实体文件夹：真正落到硬盘上，可选「平移」或「复制」 |
| 1696 | `moveItems()` |  |
| 1711 | `pasteClipboard()` |  |
| 1728 | `newFolderHere()` |  |
| 1730 | `openNewFolderDialog()` |  |
| 1767 | `openTextEditor()` |  |
| 1794 | `uploadFiles()` |  |
| 1825 | `uploadOne()` |  |
| 1850 | `connectInbox()` | 接上后端的 SSE：新文件到达主动推过来，前端不轮询 |
| 1861 | `enqueueInbox()` |  |
| 1872 | `flushHeldInbox()` | 一批上传全部落定后再开始弹卡片，避免传到一半就跳出来 |
| 1880 | `showNextIngest()` | 一次只弹一张卡片，处理完自动弹下一张 |
| 1887 | `openIngestCard()` |  |
| 2006 | `openAddRootDialog()` |  |
| 2097 | `showModal()` |  |
| 2103 | `closeModal()` |  |
| 2110 | `openSettings()` |  |
| 2199 | `openDeliverMenu()` | 点左侧栏按钮 → 弹出平台菜单 |
| 2212 | `checkMjaInstalled()` | / |
| 2237 | `dvStatusHTML()` |  |
| 2243 | `openDeliverPanel()` |  |
| 2318 | `openHelp()` |  |
| 2346 | `onSearchInput()` |  |
| 2358 | `doSearch()` |  |
| 2379 | `showCtxMenu()` |  |
| 2439 | `renderCtxMenu()` |  |
| 2458 | `showTreeCtxMenu()` | 左侧目录树的右键菜单（真实文件夹 / 虚拟分类 / 散-未归类 / 根目录） |
| 2491 | `renamePathByPath()` | 重命名任意文件夹（树里右键用） |
| 2507 | `deletePathByPath()` | 删除任意文件夹到回收站（树里右键用） |
| 2524 | `hideCtxMenu()` |  |
| 2526 | `revealInExplorer()` |  |
| 2533 | `copyToClipboard()` | 把选中的文件按 Windows 文件格式放进系统剪贴板，之后可在任意程序里 Ctrl+V |
| 2542 | `checkDuplicates()` |  |
| 2558 | `showDragGhost()` |  |
| 2567 | `moveDragGhost()` |  |
| 2573 | `hideDragGhost()` |  |
| 2577 | `setDropHints()` |  |
| 2583 | `clearDropTargets()` |  |
| 2591 | `isFileDrag()` | / |
| 2608 | `dragKind()` | / |
| 2619 | `bindEvents()` | / |
| 2630 | `bindToolbarEvents()` | 左树 ＋ / 视图切换 / 排序 / 筛选 / 缩放 / 滚动加载 |
| 2658 | `bindLogEvents()` | 操作日志面板：开关、清空、点外部关闭 |
| 2683 | `bindNavEvents()` | 导航按钮 / 侧栏按钮 / 搜索框 |
| 2708 | `bindContentEvents()` | 内容区：单击选中 / 双击打开 / 右键菜单 / 点空白关菜单 |
| 2759 | `bindOverlayEvents()` | 灯箱 / 模态遮罩 / 左侧分割条拖拽 |
| 2787 | `bindDragDropEvents()` | 拖拽：素材内部移动 + 外部文件拖入上传（从 bindEvents 拆出，纯搬迁） |
| 2929 | `bindKeyboardEvents()` | / |
| 3006 | `init()` |  |

### 前端顶层常量

| 行 | 名字 | 说明 |
|---|---|---|
| 4 | `$` |  |
| 5 | `$$` |  |
| 7 | `IMG_EXT` |  |
| 8 | `VID_EXT` |  |
| 9 | `AUD_EXT` |  |
| 10 | `TXT_EXT` |  |
| 14 | `TUNING` | 可调参数集中在这里 —— 不要再往代码里撒字面量 |
| 23 | `S` |  |
| 50 | `content` |  |
| 57 | `LOOSE` | / |
| 58 | `LOOSE_NAME` |  |
| 59 | `VG_PREFIX` |  |
| 60 | `isLoose` |  |
| 61 | `isVGroup` |  |
| 62 | `vgIdOf` |  |
| 69 | `isVirtualPath` | 这条路径是不是虚拟的 |
| 146 | `LOG_KEY` | / |
| 148 | `Log` |  |
| 229 | `Thumb` |  |
| 341 | `thumbQueue` |  |
| 351 | `lazyObs` |  |
| 2194 | `DELIVER_TARGETS` |  |

## 五、db.js（155 行）

| 行 | 名字 | 说明 |
|---|---|---|
| 44 | `tx()` |  |
| 52 | `getSettings()` | ---------------- settings ---------------- |
| 60 | `setSettings()` |  |
| 68 | `getRoots()` | ---------------- roots ---------------- |
| 72 | `replaceRoots()` |  |
| 83 | `getVGroups()` | ---------------- vgroups ---------------- |
| 93 | `replaceVGroups()` |  |
| 111 | `readJSON()` | ---------------- 首次迁移：把旧 JSON 导进库 ---------------- |
| 118 | `migrate()` |  |

