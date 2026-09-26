# 代码索引 CODE_MAP.index

> **本文件由 `node map.js` 自动生成，不要手改。**
> 职责、规则、踩坑、排查表在 **[`CODE_MAP.md`](CODE_MAP.md)**（那份不含行号，所以不用维护）。
> 生成时间：2026/9/26 22:31:37

查行号最快的办法：`node map.js <关键词>`（例：`node map.js 收件箱`）。

## 一、文件行数

| 文件 | 行数 |
|---|---|
| `server.js` | 2026 |
| `db.js` | 179 |
| `launcher.js` | 236 |
| `browsers.js` | 211 |
| `public/app.js` | 4638 |
| `public/index.html` | 156 |
| `public/style.css` | 984 |

## 二、后端路由（49 个分支，全在 `http.createServer` 里）

| 行 | 方法 | 路由 |
|---|---|---|
| 1061 | GET | `/api/config` |
| 1078 | POST | `/api/config` |
| 1097 | GET | `/api/browsers` |
| 1104 | GET | `/api/edge` |
| 1121 | GET | `/api/events` |
| 1135 | GET | `/api/inbox` |
| 1144 | GET | `/api/inbox/targets` |
| 1149 | POST | `/api/inbox/ingest` |
| 1172 | POST | `/api/roots` |
| 1188 | DELETE | `/api/roots/` |
| 1201 | GET | `/api/skills` |
| 1215 | POST | `/api/skills` |
| 1230 | DELETE | `/api/skills/` |
| 1241 | GET | `/api/board` |
| 1254 | POST | `/api/board` |
| 1297 | GET | `/api/deliver/next` |
| 1300 | POST | `/api/deliver/done` |
| 1306 | POST | `/api/deliver/queue` |
| 1309 | POST | `/api/deliver/send` |
| 1312 | GET | `/api/deliver/state` |
| 1315 | GET | `/api/skills/file` |
| 1333 | GET | `/api/fs/drives` |
| 1337 | GET | `/api/fs/dirs` |
| 1356 | GET | `/api/list` |
| 1388 | GET | `/api/tree` |
| 1410 | GET | `/api/file` |
| 1416 | GET | `/api/text` |
| 1430 | POST | `/api/text` |
| 1440 | PUT | `/api/upload` |
| 1469 | POST | `/api/mkdir` |
| 1481 | POST | `/api/mkdir-template` |
| 1498 | POST | `/api/rename` |
| 1513 | POST | `/api/rename-batch` |
| 1546 | POST | `/api/move` · `/api/copy` |
| 1581 | POST | `/api/delete` |
| 1601 | GET | `/api/trash` |
| 1620 | POST | `/api/trash/restore` |
| 1646 | POST | `/api/trash/purge` |
| 1661 | GET | `/api/search` |
| 1704 | GET | `/api/vgroups` |
| 1709 | POST | `/api/vgroups` |
| 1728 | POST | `/api/vgroups/update` |
| 1740 | POST | `/api/vgroups/assign` |
| 1758 | POST | `/api/vgroups/delete` |
| 1772 | POST | `/api/vgroups/materialize` |
| 1829 | GET | `/api/duplicates` |
| 1848 | POST | `/api/clipboard` |
| 1893 | POST | `/api/reveal` |
| 1911 | GET | `/api/sysinfo` |

## 三、后端函数 / 常量（57 个函数）

| 行 | 名字 | 说明 |
|---|---|---|
| 64 | `loadConfig()` |  |
| 72 | `saveConfig()` |  |
| 111 | `sendJSON()` |  |
| 132 | `LOG()` |  |
| 138 | `flushLog()` |  |
| 165 | `psArgs()` | / |
| 174 | `withClipboardLock()` |  |
| 181 | `cleanPsOutput()` | PowerShell 走 stderr 时会吐 CLIXML（进度/错误都在里面），这里挑出人话 |
| 193 | `runCommand()` |  |
| 210 | `sendError()` |  |
| 216 | `readJSONBody()` |  |
| 236 | `resolveSafe()` | 把「相对于根的 POSIX 路径」解析成绝对路径，并保证不越界 |
| 249 | `toRel()` | 绝对路径 -> 相对根的 POSIX 路径 |
| 254 | `getRoot()` |  |
| 260 | `uniqueName()` |  |
| 274 | `assertValidName()` |  |
| 283 | `listDrives()` |  |
| 307 | `saveVGroupsFile()` |  |
| 312 | `groupsOf()` |  |
| 324 | `readGroupsClean()` | / |
| 351 | `trashDirOf()` | ---------------------------------------------------------------- 回收站 |
| 352 | `trashIndexPath()` |  |
| 354 | `readTrashIndex()` |  |
| 362 | `writeTrashIndex()` |  |
| 368 | `moveToTrash()` | 删除（移动）到回收站 |
| 391 | `serveStatic()` | ---------------------------------------------------------------- 静态文件 |
| 412 | `streamFile()` | ---------------------------------------------------------------- 文件流（支持… |
| 463 | `statEntry()` | ---------------------------------------------------------------- 目录列举 |
| 485 | `hasSubDir()` | / |
| 498 | `listDir()` |  |
| 516 | `sortEntries()` | 服务端排序 —— 分页之后排序必须在这里做，否则只排当前页 |
| 533 | `resolveScope()` | / |
| 567 | `expandItems()` | 批量接口入参：给明确 items，或给 scope（= 全选当前视图的全部文件） |
| 601 | `edgeUserDataDir()` |  |
| 611 | `readEdgePrefs()` | / |
| 648 | `markSelfWrite()` | 网页自己写入的文件：登记忽略，否则监听器会把自己的操作当成"新下载" |
| 660 | `isSelfWrite()` |  |
| 668 | `snapshotTop()` |  |
| 677 | `sseSend()` |  |
| 685 | `waitFileReady()` | 等文件写完：同级还有 .crdownload、或大小还在变，都不算下载完成 |
| 699 | `matchSmartRule()` | 文件名"有没有意义"：命中设置里的 smartRules 正则就算没意义 |
| 707 | `queueInboxItem()` |  |
| 726 | `ingestFile()` | / |
| 793 | `autoIngestQuiet()` | 「全自动：直接入库不打扰」/ smart 判定为"名字有意义"时走这里 |
| 811 | `dispatchNewFile()` | / |
| 836 | `scanRoot()` | 扫一个根目录的顶层，找出"新增的文件"并按策略分派 |
| 862 | `stopInbox()` |  |
| 871 | `startInbox()` | （重新）挂上所有根目录的监听。roots 变了、开关变了都要重来一遍 |
| 897 | `ingestKey()` | 入库位置的唯一标识（虚拟分类靠 gid 区分，文件夹靠相对路径） |
| 902 | `collectDirs()` | 递归列文件夹（DFS + 带层级 depth），最多 limit 个 |
| 923 | `listIngestTargets()` | / |
| 965 | `getSkillDir()` |  |
| 972 | `collectSkillFiles()` | 递归收模板文件（限深限数，只留白名单扩展名） |
| 998 | `normBoardImages()` | / |
| 1957 | `browserInfo()` | 给网页设置面板用：当前选的是谁 + 自动发现的本机浏览器列表 |
| 1966 | `openBrowser()` | 服务就绪后自动打开浏览器（--open 时启用；配置的浏览器找不到就回退系统默认） |
| 2013 | `addRoot()` |  |

## 四、前端函数 / 常量（180 个函数）

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
| 1870 | `enqueueInbox()` |  |
| 1881 | `flushHeldInbox()` | 一批上传全部落定后再开始弹卡片，避免传到一半就跳出来 |
| 1889 | `showNextIngest()` | 一次只弹一张卡片，处理完自动弹下一张 |
| 1896 | `openIngestCard()` |  |
| 2021 | `openAddRootDialog()` | / |
| 2126 | `buildSkillTree()` | 把服务端给的扁平文件列表（rel 形如 `漫剧/分镜.md`）构造成树 |
| 2149 | `renderSkillNode()` | / |
| 2182 | `renderSkills()` |  |
| 2242 | `previewSkill()` | 看一份模板的内容（投放前确认用） |
| 2280 | `boardData()` |  |
| 2317 | `askPresetList()` | 预设全表（内置两条在最前） |
| 2321 | `askPreset()` | 当前选中的那一条（找不到就回内置分镜） |
| 2326 | `askPresetKind()` | 当前这套是"分镜"还是"文本" —— **取回后要不要分割，就看它** |
| 2330 | `askPresetText()` | 当前预设要用的正文（内置两条用内置模板；自己那份的 text 为空也回落到对应内置模板） |
| 2344 | `migrateBoard()` | / |
| 2356 | `saveBoard()` | 存盘（防抖 600ms；传 true 立刻存） |
| 2375 | `openBoard()` |  |
| 2406 | `closeBoard()` |  |
| 2414 | `applyBoardLayout()` | 工作台的「大窗 / 小窗」各记一套布局 —— 两种模式都能拖能缩（硬性要求） |
| 2424 | `toggleBoardSize()` |  |
| 2438 | `buildBoard()` |  |
| 2579 | `assignBoardImages()` | / |
| 2605 | `renderBoardItems()` |  |
| 2667 | `updateBoardSub()` | 工作台标题栏那行小字（条数 / 秒数 / 配图 / skill）—— 只有这一处实现 |
| 2677 | `renderBoard()` |  |
| 2694 | `renderBoardPreset()` | 工作台上的预设下拉：**分镜预设 / 文本预设**分组；选哪类，生成按钮就是哪种行为 |
| 2714 | `renderBoardSecs()` |  |
| 2727 | `renderBoardSkills()` |  |
| 2752 | `renderSkillPick()` | skill 选择树（和左侧技能分区同一套层级规则：缩进 + 折叠感） |
| 2784 | `deliverItem()` | 投放这一条：图 + 提示词入队 |
| 2807 | `sendItem()` | 让助手脚本去点豆包的发送按钮 |
| 2819 | `onDeliverEvent()` | 助手脚本的回执（走 SSE）→ 更新对应条目的状态 |
| 2977 | `buildAskText()` | 把预设指令渲染成真正要投出去的那段文字 |
| 2990 | `openAskTemplateEditor()` | / |
| 3134 | `sbBoundary()` | 切分边界：优先 ###，其次「大分镜N」标题行（内容兜底，见 SB_HEAD_RE） |
| 3143 | `countBigShots()` | 主判据是「大分镜N｜」标题行；模型连标题都没写时，退一步数【小分镜】的段数。 |
| 3151 | `splitStoryboard()` | 把 AI 的回复切成一条条。返回 `{parts, mode}`：mode 说明这次按什么切的 |
| 3158 | `setGenState()` |  |
| 3165 | `syncGenButtons()` | 「查看」「撤销」只在有内容时出现 |
| 3175 | `applyStoryboard()` | 把切好的分镜落进条目（**自动**；留底供撤销） |
| 3188 | `undoStoryboard()` |  |
| 3198 | `generateStoryboard()` |  |
| 3224 | `trimBeforeFirstToken()` | 去掉第一个边界之前的杂质（思考过程有时和回答在同一段文本里） |
| 3242 | `buildRawWindow()` |  |
| 3292 | `openRawWindow()` |  |
| 3300 | `closeRawWindow()` |  |
| 3308 | `setRawReply()` | mode：'split' = 分镜（要切）/ 'text' = 剧情文本（**不切**） |
| 3328 | `renderRawWindow()` | 窗口内容与层级摘要（每次刷新都从"当前文本"现算，不缓存） |
| 3344 | `renderRawHist()` | 原文历史下拉（新的在前；"当前"永远是第 0 项） |
| 3363 | `renderRawMeta()` | / |
| 3391 | `fillRawToScript()` | 把原文窗口里的整段填进「剧情 / 本轮要求」—— 写剧情 → 做分镜的顺畅接续 |
| 3405 | `setRawFoot()` |  |
| 3412 | `copyRawWindow()` |  |
| 3424 | `splitFromRawWindow()` | ✂ 用窗口里的文本切条 —— 这是**唯一的**分割入口（生成后自动走一次，手动重切也走它） |
| 3450 | `describeRaw()` | 这份原文的层级：几个大分镜、每个里头几个小分镜（小分镜行 = 行首的 "0-5s｜…" / "1. 0-5s｜…"） |
| 3465 | `openStoryboardReview()` | 切好的分镜先给用户过一遍：勾选 + 可改 + 选替换还是追加 |
| 3523 | `floatLayouts()` | 读全部浮层布局（坏了 / 隐私模式写不了 → 当没有，不影响使用） |
| 3526 | `readFloatLayout()` |  |
| 3530 | `saveFloatLayout()` |  |
| 3543 | `clampFloatLayout()` | / |
| 3557 | `floatable()` | / |
| 3657 | `showModal()` |  |
| 3665 | `closeModal()` |  |
| 3672 | `openSettings()` |  |
| 3794 | `checkMjaInstalled()` | / |
| 3823 | `openDeliverPanel()` | / |
| 3924 | `openHelp()` |  |
| 3952 | `onSearchInput()` |  |
| 3964 | `doSearch()` |  |
| 3985 | `showCtxMenu()` |  |
| 4045 | `renderCtxMenu()` |  |
| 4064 | `showTreeCtxMenu()` | 左侧目录树的右键菜单（真实文件夹 / 虚拟分类 / 散-未归类 / 根目录） |
| 4097 | `renamePathByPath()` | 重命名任意文件夹（树里右键用） |
| 4113 | `deletePathByPath()` | 删除任意文件夹到回收站（树里右键用） |
| 4130 | `hideCtxMenu()` |  |
| 4132 | `revealInExplorer()` |  |
| 4139 | `copyToClipboard()` | 把选中的文件按 Windows 文件格式放进系统剪贴板，之后可在任意程序里 Ctrl+V |
| 4148 | `checkDuplicates()` |  |
| 4164 | `showDragGhost()` |  |
| 4173 | `moveDragGhost()` |  |
| 4179 | `hideDragGhost()` |  |
| 4183 | `setDropHints()` |  |
| 4189 | `clearDropTargets()` |  |
| 4197 | `isFileDrag()` | / |
| 4214 | `dragKind()` | / |
| 4225 | `bindEvents()` | / |
| 4236 | `bindToolbarEvents()` | 左树 ＋ / 视图切换 / 排序 / 筛选 / 缩放 / 滚动加载 |
| 4266 | `bindLogEvents()` | 操作日志面板：开关、清空、点外部关闭 |
| 4291 | `bindNavEvents()` | 导航按钮 / 侧栏按钮 / 搜索框 |
| 4313 | `bindContentEvents()` | 内容区：单击选中 / 双击打开 / 右键菜单 / 点空白关菜单 |
| 4364 | `bindOverlayEvents()` | 灯箱 / 模态遮罩 / 左侧分割条拖拽 |
| 4392 | `bindDragDropEvents()` | 拖拽：素材内部移动 + 外部文件拖入上传（从 bindEvents 拆出，纯搬迁） |
| 4535 | `bindKeyboardEvents()` | / |
| 4615 | `init()` |  |

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
| 2141 | `skillByName` |  |
| 2142 | `skillCount` |  |
| 2270 | `BOARD_IMAGES_MAX` |  |
| 2272 | `newBoardItem` |  |
| 2278 | `boardImageCount` | 整块板子上总共配了多少张图 |
| 2304 | `BUILTIN_TEXT_ID` | / |
| 2305 | `PRESET_KINDS` |  |
| 2309 | `BUILTIN_PRESETS` |  |
| 2313 | `isBuiltinPreset` |  |
| 2314 | `presetKindOf` |  |
| 2337 | `RAW_HISTORY_MAX` |  |
| 2338 | `newPresetId` |  |
| 2896 | `BOARD_SPLIT` | ---------- 用文本 AI（DeepSeek）生成分镜：投剧情 + skill → 取回 → 按 ### 切条 → 预览挑 -----… |
| 2903 | `SB_HEAD` | / |
| 2904 | `SB_HEAD_RE` |  |
| 2913 | `DEFAULT_ASK_TEMPLATE` | / |
| 2959 | `DEFAULT_TEXT_TEMPLATE` | / |
| 3172 | `cloneItems` |  |
| 3508 | `FLOAT_KEY` |  |
| 3509 | `FLOAT_GRIP` |  |
| 3510 | `FLOAT_HINT` |  |
| 3513 | `FLOAT_LIVE` | 装好的浮层（同一个 key 只留最新的一个），窗口变小后统一夹回视口内 |
| 3537 | `clampNum` |  |
| 3774 | `DELIVER_TARGETS` |  |
| 3781 | `siteName` | 平台 id → 显示名（工作台/提示里用；注意它定义在工作台后面，但只在交互时调用，没问题） |
| 3784 | `DELIVER_KEY` | 记住上次选的投放平台（脚本一份通用，选哪个只是决定"打开"按钮开谁） |
| 3785 | `deliverSite` |  |

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

