# 代码索引 CODE_MAP.index

> **本文件由 `node map.js` 自动生成，不要手改。**
> 职责、规则、踩坑、排查表在 **[`CODE_MAP.md`](CODE_MAP.md)**（那份不含行号，所以不用维护）。
> 生成时间：2026/9/26 22:53:14

查行号最快的办法：`node map.js <关键词>`（例：`node map.js 收件箱`）。

## 一、文件行数

| 文件 | 行数 |
|---|---|
| `server.js` | 1888 |
| `db.js` | 179 |
| `launcher.js` | 236 |
| `browsers.js` | 211 |
| `public/app.js` | 4706 |
| `public/index.html` | 156 |
| `public/style.css` | 995 |
| `lib/board.js` | 94 |
| `lib/deliver.js` | 160 |
| `lib/filetypes.js` | 52 |
| `lib/skills.js` | 113 |

## 二、后端路由（49 个分支，全在 `http.createServer` 里）

| 行 | 方法 | 路由 |
|---|---|---|
| 1017 | GET | `/api/config` |
| 1034 | POST | `/api/config` |
| 1053 | GET | `/api/browsers` |
| 1060 | GET | `/api/edge` |
| 1077 | GET | `/api/events` |
| 1091 | GET | `/api/inbox` |
| 1100 | GET | `/api/inbox/targets` |
| 1105 | POST | `/api/inbox/ingest` |
| 1128 | POST | `/api/roots` |
| 1144 | DELETE | `/api/roots/` |
| 1157 | GET | `/api/skills` |
| 1159 | POST | `/api/skills` |
| 1161 | DELETE | `/api/skills/` |
| 1166 | GET | `/api/board` |
| 1168 | POST | `/api/board` |
| 1173 | GET | `/api/deliver/next` |
| 1176 | POST | `/api/deliver/done` |
| 1182 | POST | `/api/deliver/queue` |
| 1185 | POST | `/api/deliver/send` |
| 1188 | GET | `/api/deliver/state` |
| 1192 | GET | `/api/skills/file` |
| 1195 | GET | `/api/fs/drives` |
| 1199 | GET | `/api/fs/dirs` |
| 1218 | GET | `/api/list` |
| 1250 | GET | `/api/tree` |
| 1272 | GET | `/api/file` |
| 1278 | GET | `/api/text` |
| 1292 | POST | `/api/text` |
| 1302 | PUT | `/api/upload` |
| 1331 | POST | `/api/mkdir` |
| 1343 | POST | `/api/mkdir-template` |
| 1360 | POST | `/api/rename` |
| 1375 | POST | `/api/rename-batch` |
| 1408 | POST | `/api/move` · `/api/copy` |
| 1443 | POST | `/api/delete` |
| 1463 | GET | `/api/trash` |
| 1482 | POST | `/api/trash/restore` |
| 1508 | POST | `/api/trash/purge` |
| 1523 | GET | `/api/search` |
| 1566 | GET | `/api/vgroups` |
| 1571 | POST | `/api/vgroups` |
| 1590 | POST | `/api/vgroups/update` |
| 1602 | POST | `/api/vgroups/assign` |
| 1620 | POST | `/api/vgroups/delete` |
| 1634 | POST | `/api/vgroups/materialize` |
| 1691 | GET | `/api/duplicates` |
| 1710 | POST | `/api/clipboard` |
| 1755 | POST | `/api/reveal` |
| 1773 | GET | `/api/sysinfo` |

## 三、后端函数 / 常量（54 个函数）

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
| 1819 | `browserInfo()` | 给网页设置面板用：当前选的是谁 + 自动发现的本机浏览器列表 |
| 1828 | `openBrowser()` | 服务就绪后自动打开浏览器（--open 时启用；配置的浏览器找不到就回退系统默认） |
| 1875 | `addRoot()` |  |

## 四、前端函数 / 常量（183 个函数）

| 行 | 名字 | 说明 |
|---|---|---|
| 65 | `realPath()` | 虚拟路径（散-未归类 / 虚拟分类）背后真实的目录，永远是根目录 |
| 74 | `fmtSize()` |  |
| 82 | `fmtDur()` |  |
| 89 | `fmtTime()` |  |
| 99 | `kindOfName()` |  |
| 109 | `joinPath()` |  |
| 110 | `parentOf()` |  |
| 111 | `baseName()` |  |
| 113 | `esc()` |  |
| 117 | `fileUrl()` |  |
| 125 | `api()` |  |
| 134 | `apiPost()` |  |
| 181 | `fmtClock()` |  |
| 187 | `renderLogButton()` |  |
| 195 | `renderLogPanel()` |  |
| 215 | `toast()` |  |
| 304 | `makeThumbBlob()` | 画布生成缩略图 |
| 345 | `revokeUrls()` |  |
| 361 | `observeLazy()` |  |
| 368 | `renderRoots()` |  |
| 403 | `reloadConfig()` |  |
| 418 | `selectRoot()` |  |
| 432 | `buildTree()` |  |
| 454 | `bindTreeRow()` |  |
| 520 | `openNode()` | 展开一个节点（已加载过就只切换显示，不重复请求） |
| 531 | `closeNode()` | 收起一个节点 |
| 540 | `toggleNode()` |  |
| 551 | `expandNode()` | / |
| 621 | `markTreeActive()` |  |
| 626 | `reloadTreeNode()` | 目录内容变了，重新加载对应的树节点（保持展开状态） |
| 634 | `ensureVisible()` | 逐级展开，让目标路径的节点在树里可见 |
| 651 | `navigateTo()` |  |
| 664 | `loadVGroups()` |  |
| 672 | `loadDir()` |  |
| 718 | `reloadCurrent()` | 排序 / 筛选变化后回到第一页重新拉 |
| 731 | `loadMore()` | 滚到底自动加载下一页 |
| 742 | `refresh()` |  |
| 750 | `setStatus()` |  |
| 752 | `renderBreadcrumb()` |  |
| 785 | `showEmpty()` |  |
| 800 | `sorted()` |  |
| 815 | `filtered()` | 只看图片 / 只看视频时，文件夹和虚拟节点一并隐藏 —— 它们不是你要看的东西 |
| 821 | `injectedNodes()` | 根目录视图里要额外插入的虚拟节点：虚拟分类 + 散-未归类 |
| 836 | `renderContent()` |  |
| 871 | `appendTarget()` | append=true 时只追加还没渲染过的条目，不重建已有 DOM |
| 877 | `renderGrid()` |  |
| 912 | `renderList()` |  |
| 947 | `fillThumb()` | 填充缩略图（图片 / 视频首帧） |
| 1039 | `openTrash()` |  |
| 1051 | `renderTrash()` |  |
| 1106 | `trashRestore()` |  |
| 1117 | `trashPurge()` |  |
| 1135 | `visibleEntries()` |  |
| 1144 | `invalidateVisible()` | 数据变了就作废缓存（renderContent 开头会调） |
| 1146 | `updateSelectionStatus()` |  |
| 1200 | `clickSelect()` |  |
| 1221 | `previewable()` |  |
| 1225 | `openEntry()` |  |
| 1234 | `openLightbox()` |  |
| 1241 | `closeLightbox()` |  |
| 1247 | `renderLightbox()` |  |
| 1281 | `renderStrip()` |  |
| 1309 | `lbStep()` |  |
| 1318 | `selectedItems()` |  |
| 1325 | `isSelected()` | 某个条目是否处于「选中」状态（全选模式下，连还没加载出来的也算） |
| 1330 | `scopePayload()` | 当前视图范围 —— 交给后端自己算出「全部文件」，不受分页限制 |
| 1341 | `viewLabel()` | 当前视图叫什么（写日志用） |
| 1351 | `selectionBody()` | 批量操作的请求体：全选时给 scope，否则给明确 items |
| 1358 | `clearSelectAll()` |  |
| 1360 | `deleteSelected()` |  |
| 1415 | `renameEntry()` |  |
| 1429 | `openBatchRename()` |  |
| 1509 | `assignToGroup()` | 把文件归入某个虚拟分类 —— 只写引用，文件本体不动 |
| 1523 | `unassignFiles()` | 取消归类：从所有虚拟分类里移除引用 |
| 1543 | `openNewVGroupDialog()` | 虚拟新建：创建一个虚拟分类，并把当前选中的文件归进去 |
| 1593 | `renameVGroup()` |  |
| 1604 | `deleteVGroup()` |  |
| 1619 | `openMaterializeDialog()` | 虚拟分类 -> 实体文件夹：真正落到硬盘上，可选「平移」或「复制」 |
| 1702 | `moveItems()` |  |
| 1717 | `pasteClipboard()` |  |
| 1734 | `newFolderHere()` |  |
| 1736 | `openNewFolderDialog()` |  |
| 1773 | `openTextEditor()` |  |
| 1800 | `uploadFiles()` |  |
| 1831 | `uploadOne()` |  |
| 1856 | `connectInbox()` | 接上后端的 SSE：新文件到达主动推过来，前端不轮询 |
| 1871 | `enqueueInbox()` |  |
| 1882 | `flushHeldInbox()` | 一批上传全部落定后再开始弹卡片，避免传到一半就跳出来 |
| 1890 | `showNextIngest()` | 一次只弹一张卡片，处理完自动弹下一张 |
| 1897 | `openIngestCard()` |  |
| 2022 | `openAddRootDialog()` | / |
| 2127 | `buildSkillTree()` | 把服务端给的扁平文件列表（rel 形如 `漫剧/分镜.md`）构造成树 |
| 2150 | `renderSkillNode()` | / |
| 2183 | `renderSkills()` |  |
| 2243 | `previewSkill()` | 看一份模板的内容（投放前确认用） |
| 2281 | `boardData()` |  |
| 2318 | `askPresetList()` | 预设全表（内置两条在最前） |
| 2322 | `askPreset()` | 当前选中的那一条（找不到就回内置分镜） |
| 2327 | `askPresetKind()` | 当前这套是"分镜"还是"文本" —— **取回后要不要分割，就看它** |
| 2331 | `askPresetText()` | 当前预设要用的正文（内置两条用内置模板；自己那份的 text 为空也回落到对应内置模板） |
| 2345 | `migrateBoard()` | / |
| 2357 | `saveBoard()` | 存盘（防抖 600ms；传 true 立刻存） |
| 2376 | `openBoard()` |  |
| 2407 | `closeBoard()` |  |
| 2415 | `applyBoardLayout()` | 工作台的「大窗 / 小窗」各记一套布局 —— 两种模式都能拖能缩（硬性要求） |
| 2425 | `toggleBoardSize()` |  |
| 2439 | `buildBoard()` |  |
| 2580 | `assignBoardImages()` | / |
| 2607 | `boardRefIndex()` | 当前引用目标是第几条（-1 = 还没设，或目标那条已经被删了） |
| 2618 | `refBoardImage()` | / |
| 2639 | `renderBoardItems()` |  |
| 2718 | `updateSkillClearBtn()` | / |
| 2732 | `updateBoardSub()` | 工作台标题栏那行小字（条数 / 秒数 / 配图 / skill）—— 只有这一处实现 |
| 2745 | `renderBoard()` |  |
| 2762 | `renderBoardPreset()` | 工作台上的预设下拉：**分镜预设 / 文本预设**分组；选哪类，生成按钮就是哪种行为 |
| 2782 | `renderBoardSecs()` |  |
| 2795 | `renderBoardSkills()` |  |
| 2820 | `renderSkillPick()` | skill 选择树（和左侧技能分区同一套层级规则：缩进 + 折叠感） |
| 2852 | `deliverItem()` | 投放这一条：图 + 提示词入队 |
| 2875 | `sendItem()` | 让助手脚本去点豆包的发送按钮 |
| 2887 | `onDeliverEvent()` | 助手脚本的回执（走 SSE）→ 更新对应条目的状态 |
| 3045 | `buildAskText()` | 把预设指令渲染成真正要投出去的那段文字 |
| 3058 | `openAskTemplateEditor()` | / |
| 3202 | `sbBoundary()` | 切分边界：优先 ###，其次「大分镜N」标题行（内容兜底，见 SB_HEAD_RE） |
| 3211 | `countBigShots()` | 主判据是「大分镜N｜」标题行；模型连标题都没写时，退一步数【小分镜】的段数。 |
| 3219 | `splitStoryboard()` | 把 AI 的回复切成一条条。返回 `{parts, mode}`：mode 说明这次按什么切的 |
| 3226 | `setGenState()` |  |
| 3233 | `syncGenButtons()` | 「查看」「撤销」只在有内容时出现 |
| 3243 | `applyStoryboard()` | 把切好的分镜落进条目（**自动**；留底供撤销） |
| 3256 | `undoStoryboard()` |  |
| 3266 | `generateStoryboard()` |  |
| 3292 | `trimBeforeFirstToken()` | 去掉第一个边界之前的杂质（思考过程有时和回答在同一段文本里） |
| 3310 | `buildRawWindow()` |  |
| 3360 | `openRawWindow()` |  |
| 3368 | `closeRawWindow()` |  |
| 3376 | `setRawReply()` | mode：'split' = 分镜（要切）/ 'text' = 剧情文本（**不切**） |
| 3396 | `renderRawWindow()` | 窗口内容与层级摘要（每次刷新都从"当前文本"现算，不缓存） |
| 3412 | `renderRawHist()` | 原文历史下拉（新的在前；"当前"永远是第 0 项） |
| 3431 | `renderRawMeta()` | / |
| 3459 | `fillRawToScript()` | 把原文窗口里的整段填进「剧情 / 本轮要求」—— 写剧情 → 做分镜的顺畅接续 |
| 3473 | `setRawFoot()` |  |
| 3480 | `copyRawWindow()` |  |
| 3492 | `splitFromRawWindow()` | ✂ 用窗口里的文本切条 —— 这是**唯一的**分割入口（生成后自动走一次，手动重切也走它） |
| 3518 | `describeRaw()` | 这份原文的层级：几个大分镜、每个里头几个小分镜（小分镜行 = 行首的 "0-5s｜…" / "1. 0-5s｜…"） |
| 3533 | `openStoryboardReview()` | 切好的分镜先给用户过一遍：勾选 + 可改 + 选替换还是追加 |
| 3591 | `floatLayouts()` | 读全部浮层布局（坏了 / 隐私模式写不了 → 当没有，不影响使用） |
| 3594 | `readFloatLayout()` |  |
| 3598 | `saveFloatLayout()` |  |
| 3611 | `clampFloatLayout()` | / |
| 3625 | `floatable()` | / |
| 3725 | `showModal()` |  |
| 3733 | `closeModal()` |  |
| 3740 | `openSettings()` |  |
| 3862 | `checkMjaInstalled()` | / |
| 3891 | `openDeliverPanel()` | / |
| 3992 | `openHelp()` |  |
| 4020 | `onSearchInput()` |  |
| 4032 | `doSearch()` |  |
| 4053 | `showCtxMenu()` |  |
| 4113 | `renderCtxMenu()` |  |
| 4132 | `showTreeCtxMenu()` | 左侧目录树的右键菜单（真实文件夹 / 虚拟分类 / 散-未归类 / 根目录） |
| 4165 | `renamePathByPath()` | 重命名任意文件夹（树里右键用） |
| 4181 | `deletePathByPath()` | 删除任意文件夹到回收站（树里右键用） |
| 4198 | `hideCtxMenu()` |  |
| 4200 | `revealInExplorer()` |  |
| 4207 | `copyToClipboard()` | 把选中的文件按 Windows 文件格式放进系统剪贴板，之后可在任意程序里 Ctrl+V |
| 4216 | `checkDuplicates()` |  |
| 4232 | `showDragGhost()` |  |
| 4241 | `moveDragGhost()` |  |
| 4247 | `hideDragGhost()` |  |
| 4251 | `setDropHints()` |  |
| 4257 | `clearDropTargets()` |  |
| 4265 | `isFileDrag()` | / |
| 4282 | `dragKind()` | / |
| 4293 | `bindEvents()` | / |
| 4304 | `bindToolbarEvents()` | 左树 ＋ / 视图切换 / 排序 / 筛选 / 缩放 / 滚动加载 |
| 4334 | `bindLogEvents()` | 操作日志面板：开关、清空、点外部关闭 |
| 4359 | `bindNavEvents()` | 导航按钮 / 侧栏按钮 / 搜索框 |
| 4381 | `bindContentEvents()` | 内容区：单击选中 / 双击打开 / 右键菜单 / 点空白关菜单 |
| 4432 | `bindOverlayEvents()` | 灯箱 / 模态遮罩 / 左侧分割条拖拽 |
| 4460 | `bindDragDropEvents()` | 拖拽：素材内部移动 + 外部文件拖入上传（从 bindEvents 拆出，纯搬迁） |
| 4603 | `bindKeyboardEvents()` | / |
| 4683 | `init()` |  |

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
| 51 | `content` |  |
| 58 | `LOOSE` | / |
| 59 | `LOOSE_NAME` |  |
| 60 | `VG_PREFIX` |  |
| 61 | `isLoose` |  |
| 62 | `isVGroup` |  |
| 63 | `vgIdOf` |  |
| 70 | `isVirtualPath` | 这条路径是不是虚拟的 |
| 147 | `LOG_KEY` | / |
| 149 | `Log` |  |
| 230 | `Thumb` |  |
| 342 | `thumbQueue` |  |
| 352 | `lazyObs` |  |
| 2142 | `skillByName` |  |
| 2143 | `skillCount` |  |
| 2271 | `BOARD_IMAGES_MAX` |  |
| 2273 | `newBoardItem` |  |
| 2279 | `boardImageCount` | 整块板子上总共配了多少张图 |
| 2305 | `BUILTIN_TEXT_ID` | / |
| 2306 | `PRESET_KINDS` |  |
| 2310 | `BUILTIN_PRESETS` |  |
| 2314 | `isBuiltinPreset` |  |
| 2315 | `presetKindOf` |  |
| 2338 | `RAW_HISTORY_MAX` |  |
| 2339 | `newPresetId` |  |
| 2964 | `BOARD_SPLIT` | ---------- 用文本 AI（DeepSeek）生成分镜：投剧情 + skill → 取回 → 按 ### 切条 → 预览挑 -----… |
| 2971 | `SB_HEAD` | / |
| 2972 | `SB_HEAD_RE` |  |
| 2981 | `DEFAULT_ASK_TEMPLATE` | / |
| 3027 | `DEFAULT_TEXT_TEMPLATE` | / |
| 3240 | `cloneItems` |  |
| 3576 | `FLOAT_KEY` |  |
| 3577 | `FLOAT_GRIP` |  |
| 3578 | `FLOAT_HINT` |  |
| 3581 | `FLOAT_LIVE` | 装好的浮层（同一个 key 只留最新的一个），窗口变小后统一夹回视口内 |
| 3605 | `clampNum` |  |
| 3842 | `DELIVER_TARGETS` |  |
| 3849 | `siteName` | 平台 id → 显示名（工作台/提示里用；注意它定义在工作台后面，但只在交互时调用，没问题） |
| 3852 | `DELIVER_KEY` | 记住上次选的投放平台（脚本一份通用，选哪个只是决定"打开"按钮开谁） |
| 3853 | `deliverSite` |  |

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

## 八、lib/board.js（94 行）

| 行 | 名字 | 说明 |
|---|---|---|
| 18 | `normBoardImages()` | / |

## 九、lib/deliver.js（160 行）

| 行 | 名字 | 说明 |
|---|---|---|

## 十、lib/filetypes.js（52 行）

| 行 | 名字 | 说明 |
|---|---|---|
| 40 | `extOf()` |  |
| 42 | `kindOf()` |  |

## 十一、lib/skills.js（113 行）

| 行 | 名字 | 说明 |
|---|---|---|

