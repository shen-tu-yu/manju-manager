# 代码索引 CODE_MAP.index

> **本文件由 `node map.js` 自动生成，不要手改。**
> 职责、规则、踩坑、排查表在 **[`CODE_MAP.md`](CODE_MAP.md)**（那份不含行号，所以不用维护）。
> 生成时间：2026/9/26 20:01:31

查行号最快的办法：`node map.js <关键词>`（例：`node map.js 收件箱`）。

## 一、文件行数

| 文件 | 行数 |
|---|---|
| `server.js` | 2183 |
| `db.js` | 179 |
| `launcher.js` | 236 |
| `browsers.js` | 211 |
| `public/app.js` | 4623 |
| `public/index.html` | 156 |
| `public/style.css` | 980 |

## 二、后端路由（49 个分支，全在 `http.createServer` 里）

| 行 | 方法 | 路由 |
|---|---|---|
| 1116 | GET | `/api/config` |
| 1133 | POST | `/api/config` |
| 1152 | GET | `/api/browsers` |
| 1159 | GET | `/api/edge` |
| 1176 | GET | `/api/events` |
| 1190 | GET | `/api/inbox` |
| 1199 | GET | `/api/inbox/targets` |
| 1204 | POST | `/api/inbox/ingest` |
| 1227 | POST | `/api/roots` |
| 1243 | DELETE | `/api/roots/` |
| 1256 | GET | `/api/skills` |
| 1270 | POST | `/api/skills` |
| 1285 | DELETE | `/api/skills/` |
| 1296 | GET | `/api/board` |
| 1309 | POST | `/api/board` |
| 1352 | GET | `/api/deliver/next` |
| 1385 | POST | `/api/deliver/done` |
| 1410 | POST | `/api/deliver/queue` |
| 1455 | POST | `/api/deliver/send` |
| 1462 | GET | `/api/deliver/state` |
| 1472 | GET | `/api/skills/file` |
| 1490 | GET | `/api/fs/drives` |
| 1494 | GET | `/api/fs/dirs` |
| 1513 | GET | `/api/list` |
| 1545 | GET | `/api/tree` |
| 1567 | GET | `/api/file` |
| 1573 | GET | `/api/text` |
| 1587 | POST | `/api/text` |
| 1597 | PUT | `/api/upload` |
| 1626 | POST | `/api/mkdir` |
| 1638 | POST | `/api/mkdir-template` |
| 1655 | POST | `/api/rename` |
| 1670 | POST | `/api/rename-batch` |
| 1703 | POST | `/api/move` · `/api/copy` |
| 1738 | POST | `/api/delete` |
| 1758 | GET | `/api/trash` |
| 1777 | POST | `/api/trash/restore` |
| 1803 | POST | `/api/trash/purge` |
| 1818 | GET | `/api/search` |
| 1861 | GET | `/api/vgroups` |
| 1866 | POST | `/api/vgroups` |
| 1885 | POST | `/api/vgroups/update` |
| 1897 | POST | `/api/vgroups/assign` |
| 1915 | POST | `/api/vgroups/delete` |
| 1929 | POST | `/api/vgroups/materialize` |
| 1986 | GET | `/api/duplicates` |
| 2005 | POST | `/api/clipboard` |
| 2050 | POST | `/api/reveal` |
| 2068 | GET | `/api/sysinfo` |

## 三、后端函数 / 常量（60 个函数）

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
| 1033 | `normBoardImages()` | / |
| 1061 | `queueDeliver()` |  |
| 2114 | `browserInfo()` | 给网页设置面板用：当前选的是谁 + 自动发现的本机浏览器列表 |
| 2123 | `openBrowser()` | 服务就绪后自动打开浏览器（--open 时启用；配置的浏览器找不到就回退系统默认） |
| 2170 | `addRoot()` |  |

## 四、前端函数 / 常量（179 个函数）

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
| 2330 | `askPresetText()` | 当前预设要用的正文（内置两条用内置模板；用户那份的 text 为空也回落到对应内置模板） |
| 2344 | `migrateBoard()` | / |
| 2356 | `saveBoard()` | 存盘（防抖 600ms；传 true 立刻存） |
| 2375 | `openBoard()` |  |
| 2406 | `closeBoard()` |  |
| 2414 | `applyBoardLayout()` | 工作台的「大窗 / 小窗」各记一套布局 —— 两种模式都能拖能缩（用户要求） |
| 2424 | `toggleBoardSize()` |  |
| 2438 | `buildBoard()` |  |
| 2566 | `assignBoardImages()` | / |
| 2592 | `renderBoardItems()` |  |
| 2653 | `renderBoard()` |  |
| 2675 | `renderBoardPreset()` | 工作台上的预设下拉：**分镜预设 / 文本预设**分组；选哪类，生成按钮就是哪种行为 |
| 2695 | `renderBoardSecs()` |  |
| 2708 | `renderBoardSkills()` |  |
| 2733 | `renderSkillPick()` | skill 选择树（和左侧技能分区同一套层级规则：缩进 + 折叠感） |
| 2769 | `deliverItem()` | 投放这一条：图 + 提示词入队 |
| 2792 | `sendItem()` | 让助手脚本去点豆包的发送按钮 |
| 2804 | `onDeliverEvent()` | 助手脚本的回执（走 SSE）→ 更新对应条目的状态 |
| 2962 | `buildAskText()` | 把预设指令渲染成真正要投出去的那段文字 |
| 2975 | `openAskTemplateEditor()` | / |
| 3119 | `sbBoundary()` | 切分边界：优先 ###，其次「大分镜N」标题行（内容兜底，见 SB_HEAD_RE） |
| 3128 | `countBigShots()` | 主判据是「大分镜N｜」标题行；模型连标题都没写时，退一步数【小分镜】的段数。 |
| 3136 | `splitStoryboard()` | 把 AI 的回复切成一条条。返回 `{parts, mode}`：mode 说明这次按什么切的 |
| 3143 | `setGenState()` |  |
| 3150 | `syncGenButtons()` | 「查看」「撤销」只在有内容时出现 |
| 3160 | `applyStoryboard()` | 把切好的分镜落进条目（**自动**；留底供撤销） |
| 3173 | `undoStoryboard()` |  |
| 3183 | `generateStoryboard()` |  |
| 3209 | `trimBeforeFirstToken()` | 去掉第一个边界之前的杂质（思考过程有时和回答在同一段文本里） |
| 3227 | `buildRawWindow()` |  |
| 3277 | `openRawWindow()` |  |
| 3285 | `closeRawWindow()` |  |
| 3293 | `setRawReply()` | mode：'split' = 分镜（要切）/ 'text' = 剧情文本（**不切**） |
| 3313 | `renderRawWindow()` | 窗口内容与层级摘要（每次刷新都从"当前文本"现算，不缓存） |
| 3329 | `renderRawHist()` | 原文历史下拉（新的在前；"当前"永远是第 0 项） |
| 3348 | `renderRawMeta()` | / |
| 3376 | `fillRawToScript()` | 把原文窗口里的整段填进「剧情 / 本轮要求」—— 写剧情 → 做分镜的顺畅接续 |
| 3390 | `setRawFoot()` |  |
| 3397 | `copyRawWindow()` |  |
| 3409 | `splitFromRawWindow()` | ✂ 用窗口里的文本切条 —— 这是**唯一的**分割入口（生成后自动走一次，手动重切也走它） |
| 3435 | `describeRaw()` | 这份原文的层级：几个大分镜、每个里头几个小分镜（小分镜行 = 行首的 "0-5s｜…" / "1. 0-5s｜…"） |
| 3450 | `openStoryboardReview()` | 切好的分镜先给用户过一遍：勾选 + 可改 + 选替换还是追加 |
| 3508 | `floatLayouts()` | 读全部浮层布局（坏了 / 隐私模式写不了 → 当没有，不影响使用） |
| 3511 | `readFloatLayout()` |  |
| 3515 | `saveFloatLayout()` |  |
| 3528 | `clampFloatLayout()` | / |
| 3542 | `floatable()` | / |
| 3642 | `showModal()` |  |
| 3650 | `closeModal()` |  |
| 3657 | `openSettings()` |  |
| 3779 | `checkMjaInstalled()` | / |
| 3808 | `openDeliverPanel()` | / |
| 3909 | `openHelp()` |  |
| 3937 | `onSearchInput()` |  |
| 3949 | `doSearch()` |  |
| 3970 | `showCtxMenu()` |  |
| 4030 | `renderCtxMenu()` |  |
| 4049 | `showTreeCtxMenu()` | 左侧目录树的右键菜单（真实文件夹 / 虚拟分类 / 散-未归类 / 根目录） |
| 4082 | `renamePathByPath()` | 重命名任意文件夹（树里右键用） |
| 4098 | `deletePathByPath()` | 删除任意文件夹到回收站（树里右键用） |
| 4115 | `hideCtxMenu()` |  |
| 4117 | `revealInExplorer()` |  |
| 4124 | `copyToClipboard()` | 把选中的文件按 Windows 文件格式放进系统剪贴板，之后可在任意程序里 Ctrl+V |
| 4133 | `checkDuplicates()` |  |
| 4149 | `showDragGhost()` |  |
| 4158 | `moveDragGhost()` |  |
| 4164 | `hideDragGhost()` |  |
| 4168 | `setDropHints()` |  |
| 4174 | `clearDropTargets()` |  |
| 4182 | `isFileDrag()` | / |
| 4199 | `dragKind()` | / |
| 4210 | `bindEvents()` | / |
| 4221 | `bindToolbarEvents()` | 左树 ＋ / 视图切换 / 排序 / 筛选 / 缩放 / 滚动加载 |
| 4251 | `bindLogEvents()` | 操作日志面板：开关、清空、点外部关闭 |
| 4276 | `bindNavEvents()` | 导航按钮 / 侧栏按钮 / 搜索框 |
| 4298 | `bindContentEvents()` | 内容区：单击选中 / 双击打开 / 右键菜单 / 点空白关菜单 |
| 4349 | `bindOverlayEvents()` | 灯箱 / 模态遮罩 / 左侧分割条拖拽 |
| 4377 | `bindDragDropEvents()` | 拖拽：素材内部移动 + 外部文件拖入上传（从 bindEvents 拆出，纯搬迁） |
| 4520 | `bindKeyboardEvents()` | / |
| 4600 | `init()` |  |

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
| 2881 | `BOARD_SPLIT` | ---------- 用文本 AI（DeepSeek）生成分镜：投剧情 + skill → 取回 → 按 ### 切条 → 预览挑 -----… |
| 2888 | `SB_HEAD` | / |
| 2889 | `SB_HEAD_RE` |  |
| 2898 | `DEFAULT_ASK_TEMPLATE` | / |
| 2944 | `DEFAULT_TEXT_TEMPLATE` | / |
| 3157 | `cloneItems` |  |
| 3493 | `FLOAT_KEY` |  |
| 3494 | `FLOAT_GRIP` |  |
| 3495 | `FLOAT_HINT` |  |
| 3498 | `FLOAT_LIVE` | 装好的浮层（同一个 key 只留最新的一个），窗口变小后统一夹回视口内 |
| 3522 | `clampNum` |  |
| 3759 | `DELIVER_TARGETS` |  |
| 3766 | `siteName` | 平台 id → 显示名（工作台/提示里用；注意它定义在工作台后面，但只在用户操作时调用，没问题） |
| 3769 | `DELIVER_KEY` | 记住上次选的投放平台（脚本一份通用，选哪个只是决定"打开"按钮开谁） |
| 3770 | `deliverSite` |  |

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

