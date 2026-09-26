# 代码索引 CODE_MAP.index

> **本文件由 `node map.js` 自动生成，不要手改。**
> 职责、规则、踩坑、排查表在 **[`CODE_MAP.md`](CODE_MAP.md)**（那份不含行号，所以不用维护）。
> 生成时间：2026/9/26 17:21:49

查行号最快的办法：`node map.js <关键词>`（例：`node map.js 收件箱`）。

## 一、文件行数

| 文件 | 行数 |
|---|---|
| `server.js` | 1980 |
| `db.js` | 179 |
| `launcher.js` | 236 |
| `browsers.js` | 211 |
| `public/app.js` | 3532 |
| `public/index.html` | 156 |
| `public/style.css` | 825 |

## 二、后端路由（44 个分支，全在 `http.createServer` 里）

| 行 | 方法 | 路由 |
|---|---|---|
| 1062 | GET | `/api/config` |
| 1079 | POST | `/api/config` |
| 1098 | GET | `/api/browsers` |
| 1105 | GET | `/api/edge` |
| 1122 | GET | `/api/events` |
| 1136 | GET | `/api/inbox` |
| 1145 | GET | `/api/inbox/targets` |
| 1150 | POST | `/api/inbox/ingest` |
| 1173 | POST | `/api/roots` |
| 1189 | DELETE | `/api/roots/` |
| 1202 | GET | `/api/skills` |
| 1216 | POST | `/api/skills` |
| 1231 | DELETE | `/api/skills/` |
| 1242 | GET | `/api/board` |
| 1249 | POST | `/api/board` |
| 1269 | GET | `/api/skills/file` |
| 1287 | GET | `/api/fs/drives` |
| 1291 | GET | `/api/fs/dirs` |
| 1310 | GET | `/api/list` |
| 1342 | GET | `/api/tree` |
| 1364 | GET | `/api/file` |
| 1370 | GET | `/api/text` |
| 1384 | POST | `/api/text` |
| 1394 | PUT | `/api/upload` |
| 1423 | POST | `/api/mkdir` |
| 1435 | POST | `/api/mkdir-template` |
| 1452 | POST | `/api/rename` |
| 1467 | POST | `/api/rename-batch` |
| 1500 | POST | `/api/move` · `/api/copy` |
| 1535 | POST | `/api/delete` |
| 1555 | GET | `/api/trash` |
| 1574 | POST | `/api/trash/restore` |
| 1600 | POST | `/api/trash/purge` |
| 1615 | GET | `/api/search` |
| 1658 | GET | `/api/vgroups` |
| 1663 | POST | `/api/vgroups` |
| 1682 | POST | `/api/vgroups/update` |
| 1694 | POST | `/api/vgroups/assign` |
| 1712 | POST | `/api/vgroups/delete` |
| 1726 | POST | `/api/vgroups/materialize` |
| 1783 | GET | `/api/duplicates` |
| 1802 | POST | `/api/clipboard` |
| 1847 | POST | `/api/reveal` |
| 1865 | GET | `/api/sysinfo` |

## 三、后端函数 / 常量（58 个函数）

| 行 | 名字 | 说明 |
|---|---|---|
| 55 | `extOf()` |  |
| 57 | `kindOf()` |  |
| 99 | `loadConfig()` |  |
| 107 | `saveConfig()` |  |
| 146 | `sendJSON()` |  |
| 167 | `LOG()` |  |
| 173 | `flushLog()` |  |
| 200 | `psArgs()` | / |
| 209 | `withClipboardLock()` |  |
| 216 | `cleanPsOutput()` | PowerShell 走 stderr 时会吐 CLIXML（进度/错误都在里面），这里挑出人话 |
| 228 | `runCommand()` |  |
| 245 | `sendError()` |  |
| 251 | `readJSONBody()` |  |
| 271 | `resolveSafe()` | 把「相对于根的 POSIX 路径」解析成绝对路径，并保证不越界 |
| 284 | `toRel()` | 绝对路径 -> 相对根的 POSIX 路径 |
| 289 | `getRoot()` |  |
| 295 | `uniqueName()` |  |
| 309 | `assertValidName()` |  |
| 318 | `listDrives()` |  |
| 342 | `saveVGroupsFile()` |  |
| 347 | `groupsOf()` |  |
| 359 | `readGroupsClean()` | / |
| 386 | `trashDirOf()` | ---------------------------------------------------------------- 回收站 |
| 387 | `trashIndexPath()` |  |
| 389 | `readTrashIndex()` |  |
| 397 | `writeTrashIndex()` |  |
| 403 | `moveToTrash()` | 删除（移动）到回收站 |
| 426 | `serveStatic()` | ---------------------------------------------------------------- 静态文件 |
| 447 | `streamFile()` | ---------------------------------------------------------------- 文件流（支持… |
| 498 | `statEntry()` | ---------------------------------------------------------------- 目录列举 |
| 520 | `hasSubDir()` | / |
| 533 | `listDir()` |  |
| 551 | `sortEntries()` | 服务端排序 —— 分页之后排序必须在这里做，否则只排当前页 |
| 568 | `resolveScope()` | / |
| 602 | `expandItems()` | 批量接口入参：给明确 items，或给 scope（= 全选当前视图的全部文件） |
| 636 | `edgeUserDataDir()` |  |
| 646 | `readEdgePrefs()` | / |
| 683 | `markSelfWrite()` | 网页自己写入的文件：登记忽略，否则监听器会把自己的操作当成"新下载" |
| 695 | `isSelfWrite()` |  |
| 703 | `snapshotTop()` |  |
| 712 | `sseSend()` |  |
| 720 | `waitFileReady()` | 等文件写完：同级还有 .crdownload、或大小还在变，都不算下载完成 |
| 734 | `matchSmartRule()` | 文件名"有没有意义"：命中设置里的 smartRules 正则就算没意义 |
| 742 | `queueInboxItem()` |  |
| 761 | `ingestFile()` | / |
| 828 | `autoIngestQuiet()` | 「全自动：直接入库不打扰」/ smart 判定为"名字有意义"时走这里 |
| 846 | `dispatchNewFile()` | / |
| 871 | `scanRoot()` | 扫一个根目录的顶层，找出"新增的文件"并按策略分派 |
| 897 | `stopInbox()` |  |
| 906 | `startInbox()` | （重新）挂上所有根目录的监听。roots 变了、开关变了都要重来一遍 |
| 932 | `ingestKey()` | 入库位置的唯一标识（虚拟分类靠 gid 区分，文件夹靠相对路径） |
| 937 | `collectDirs()` | 递归列文件夹（DFS + 带层级 depth），最多 limit 个 |
| 958 | `listIngestTargets()` | / |
| 1000 | `getSkillDir()` |  |
| 1007 | `collectSkillFiles()` | 递归收模板文件（限深限数，只留白名单扩展名） |
| 1911 | `browserInfo()` | 给网页设置面板用：当前选的是谁 + 自动发现的本机浏览器列表 |
| 1920 | `openBrowser()` | 服务就绪后自动打开浏览器（--open 时启用；配置的浏览器找不到就回退系统默认） |
| 1967 | `addRoot()` |  |

## 四、前端函数 / 常量（142 个函数）

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
| 911 | `renderList()` |  |
| 946 | `fillThumb()` | 填充缩略图（图片 / 视频首帧） |
| 1038 | `openTrash()` |  |
| 1050 | `renderTrash()` |  |
| 1105 | `trashRestore()` |  |
| 1116 | `trashPurge()` |  |
| 1134 | `visibleEntries()` |  |
| 1143 | `invalidateVisible()` | 数据变了就作废缓存（renderContent 开头会调） |
| 1145 | `updateSelectionStatus()` |  |
| 1199 | `clickSelect()` |  |
| 1220 | `previewable()` |  |
| 1224 | `openEntry()` |  |
| 1233 | `openLightbox()` |  |
| 1240 | `closeLightbox()` |  |
| 1246 | `renderLightbox()` |  |
| 1280 | `renderStrip()` |  |
| 1308 | `lbStep()` |  |
| 1317 | `selectedItems()` |  |
| 1324 | `isSelected()` | 某个条目是否处于「选中」状态（全选模式下，连还没加载出来的也算） |
| 1329 | `scopePayload()` | 当前视图范围 —— 交给后端自己算出「全部文件」，不受分页限制 |
| 1340 | `viewLabel()` | 当前视图叫什么（写日志用） |
| 1350 | `selectionBody()` | 批量操作的请求体：全选时给 scope，否则给明确 items |
| 1357 | `clearSelectAll()` |  |
| 1359 | `deleteSelected()` |  |
| 1414 | `renameEntry()` |  |
| 1428 | `openBatchRename()` |  |
| 1508 | `assignToGroup()` | 把文件归入某个虚拟分类 —— 只写引用，文件本体不动 |
| 1522 | `unassignFiles()` | 取消归类：从所有虚拟分类里移除引用 |
| 1542 | `openNewVGroupDialog()` | 虚拟新建：创建一个虚拟分类，并把当前选中的文件归进去 |
| 1592 | `renameVGroup()` |  |
| 1603 | `deleteVGroup()` |  |
| 1618 | `openMaterializeDialog()` | 虚拟分类 -> 实体文件夹：真正落到硬盘上，可选「平移」或「复制」 |
| 1701 | `moveItems()` |  |
| 1716 | `pasteClipboard()` |  |
| 1733 | `newFolderHere()` |  |
| 1735 | `openNewFolderDialog()` |  |
| 1772 | `openTextEditor()` |  |
| 1799 | `uploadFiles()` |  |
| 1830 | `uploadOne()` |  |
| 1855 | `connectInbox()` | 接上后端的 SSE：新文件到达主动推过来，前端不轮询 |
| 1866 | `enqueueInbox()` |  |
| 1877 | `flushHeldInbox()` | 一批上传全部落定后再开始弹卡片，避免传到一半就跳出来 |
| 1885 | `showNextIngest()` | 一次只弹一张卡片，处理完自动弹下一张 |
| 1892 | `openIngestCard()` |  |
| 2015 | `openAddRootDialog()` | / |
| 2120 | `buildSkillTree()` | 把服务端给的扁平文件列表（rel 形如 `漫剧/分镜.md`）构造成树 |
| 2143 | `renderSkillNode()` | / |
| 2176 | `renderSkills()` |  |
| 2235 | `previewSkill()` | 看一份模板的内容（投放前确认用） |
| 2264 | `boardData()` |  |
| 2270 | `saveBoard()` | 存盘（防抖 600ms；传 true 立刻存） |
| 2282 | `openBoard()` |  |
| 2309 | `closeBoard()` |  |
| 2316 | `toggleBoardSize()` | 放大 ↔ 缩小（Esc 就是调它；缩小态是右下小框，能继续接拖进来的图片） |
| 2329 | `buildBoard()` |  |
| 2422 | `assignBoardImages()` | 把拖进来的素材配给条目：指定了 id 就配那条，否则填第一条还没图的 |
| 2440 | `renderBoard()` |  |
| 2456 | `renderBoardSecs()` |  |
| 2469 | `renderBoardItems()` |  |
| 2516 | `renderBoardSkills()` |  |
| 2541 | `renderSkillPick()` | skill 选择树（和左侧技能分区同一套层级规则：缩进 + 折叠感） |
| 2573 | `showModal()` |  |
| 2579 | `closeModal()` |  |
| 2586 | `openSettings()` |  |
| 2694 | `openDeliverMenu()` | 点左侧栏按钮 → 弹出平台菜单 |
| 2707 | `checkMjaInstalled()` | / |
| 2732 | `dvStatusHTML()` |  |
| 2739 | `openDeliverPanel()` |  |
| 2815 | `openHelp()` |  |
| 2843 | `onSearchInput()` |  |
| 2855 | `doSearch()` |  |
| 2876 | `showCtxMenu()` |  |
| 2936 | `renderCtxMenu()` |  |
| 2955 | `showTreeCtxMenu()` | 左侧目录树的右键菜单（真实文件夹 / 虚拟分类 / 散-未归类 / 根目录） |
| 2988 | `renamePathByPath()` | 重命名任意文件夹（树里右键用） |
| 3004 | `deletePathByPath()` | 删除任意文件夹到回收站（树里右键用） |
| 3021 | `hideCtxMenu()` |  |
| 3023 | `revealInExplorer()` |  |
| 3030 | `copyToClipboard()` | 把选中的文件按 Windows 文件格式放进系统剪贴板，之后可在任意程序里 Ctrl+V |
| 3039 | `checkDuplicates()` |  |
| 3055 | `showDragGhost()` |  |
| 3064 | `moveDragGhost()` |  |
| 3070 | `hideDragGhost()` |  |
| 3074 | `setDropHints()` |  |
| 3080 | `clearDropTargets()` |  |
| 3088 | `isFileDrag()` | / |
| 3105 | `dragKind()` | / |
| 3116 | `bindEvents()` | / |
| 3127 | `bindToolbarEvents()` | 左树 ＋ / 视图切换 / 排序 / 筛选 / 缩放 / 滚动加载 |
| 3157 | `bindLogEvents()` | 操作日志面板：开关、清空、点外部关闭 |
| 3182 | `bindNavEvents()` | 导航按钮 / 侧栏按钮 / 搜索框 |
| 3207 | `bindContentEvents()` | 内容区：单击选中 / 双击打开 / 右键菜单 / 点空白关菜单 |
| 3258 | `bindOverlayEvents()` | 灯箱 / 模态遮罩 / 左侧分割条拖拽 |
| 3286 | `bindDragDropEvents()` | 拖拽：素材内部移动 + 外部文件拖入上传（从 bindEvents 拆出，纯搬迁） |
| 3429 | `bindKeyboardEvents()` | / |
| 3509 | `init()` |  |

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
| 2135 | `skillByName` |  |
| 2136 | `skillCount` |  |
| 2259 | `newBoardItem` |  |
| 2688 | `DELIVER_TARGETS` |  |

## 五、db.js（179 行）

| 行 | 名字 | 说明 |
|---|---|---|
| 52 | `tx()` |  |
| 60 | `getSettings()` | ---------------- settings ---------------- |
| 68 | `setSettings()` |  |
| 76 | `getSkillDirs()` | ---------------- skill_dirs（技能目录） ---------------- |
| 80 | `addSkillDir()` |  |
| 85 | `removeSkillDir()` |  |
| 91 | `getRoots()` | ---------------- roots ---------------- |
| 95 | `replaceRoots()` |  |
| 106 | `getVGroups()` | ---------------- vgroups ---------------- |
| 116 | `replaceVGroups()` |  |
| 134 | `readJSON()` | ---------------- 首次迁移：把旧 JSON 导进库 ---------------- |
| 141 | `migrate()` |  |

## 六、launcher.js（236 行）

| 行 | 名字 | 说明 |
|---|---|---|
| 81 | `loadValues()` | ---------------- 记忆 ---------------- |
| 92 | `saveValues()` |  |
| 98 | `buildArgs()` | ---------------- 启动 ---------------- |
| 109 | `start()` |  |
| 125 | `refreshChoices()` |  |
| 132 | `currentText()` | 菜单上显示当前值：优先显示选项的 label，找不到就原样显示 |
| 140 | `render()` |  |
| 155 | `editOption()` |  |
| 190 | `parseDirect()` | 命令行直通：node launcher.js browser=chrome port=8898 （给快捷方式用） |
| 199 | `main()` |  |

## 七、browsers.js（211 行）

| 行 | 名字 | 说明 |
|---|---|---|
| 43 | `friendlyName()` | exe 名 → 友好名（注册表里叫 "Google Chrome" 的，兜底路径里也叫 "Google Chrome"） |
| 54 | `regQuery()` | / |
| 66 | `regValue()` | 从 reg 输出里取 REG_SZ 的值 |
| 72 | `exeFromCommand()` | `"C:\x\chrome.exe" --single-argument` → `C:\x\chrome.exe` |
| 86 | `fromStartMenu()` | ① StartMenuInternet：系统里"注册为浏览器"的都在这里（装哪个盘都躲不掉） |
| 106 | `fromAppPaths()` | ② App Paths：安装程序登记的完整路径 |
| 119 | `fromCommonPaths()` | ③ 常见安装路径（兜底：绿色版 / 注册表没登记的） |
| 136 | `fromPath()` | ④ PATH 查找 |
| 151 | `discoverUnix()` | 非 Windows：给几个常见位置（macOS / Linux） |
| 168 | `discover()` | 列出本机浏览器：[{ name, path, source }]，按可靠度去重 |
| 194 | `resolve()` | / |

