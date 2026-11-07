# 列国纪元 · Age of Nations

独立单人策略游戏，发布路径 `https://games.yukino.bond/age-of-nations/`。沿用 `game-spec.md` v0.3 的 P0 范围；主站游戏中心继续保留原有小游戏。

## 开发和发布

- `npm run nations:dev`：本地 `http://127.0.0.1:5196/age-of-nations/`。
- `npm run nations:test`：规则、确定性、存档、AI 与完整回合测试。
- `npm run nations:build`：独立类型检查与生产构建。
- `npm run build`：构建主站并将独立游戏放入 `dist/age-of-nations/`，现有 Pages 工作流一同发布。

## 架构

### 0.3 远征界面

`GameArt.tsx` 提供主菜单城镇插画、资源图标和单位档案图；`map-art.ts` 按坐标生成并缓存地形绘制，地图区分城镇、马车、步兵、工程师、海空军及机械部队。所有插画随站点打包，无外部图片、字体或动画循环。`expedition.css` 覆盖主菜单、指挥界面与移动端底部面板。开国任务可直接定位开拓者、城市生产和首项研究，不改变核心规则或存档结构。

`core.ts` 只依赖 `content.ts` 与 JSON 数据，无 DOM、墙上时钟或非种子随机数。命令先验证再应用；失败保留原状态。操作记录携带 playerId、turn、seq；LocalHuman / Ai / Remote 共享 PlayerController 接口，Remote 只留接口。状态哈希使用键排序后的规范化序列化，同时兼容读取早期未排序哈希的存档。界面仅拿当前玩家的视图，权威完整状态留在命令与存档边界。`projectView` 为 AI 提供经过迷雾过滤的视图；`ai.worker.ts` 在 Worker 规划对手行动。`render.ts` 使用轻量原生 WebGL 绘制六边形，再叠加 Canvas 墨线、图标与文字；WebGL 不可用时降级 Canvas。这里替换了规范中的建议 PixiJS，以免为无纹理地图引入额外运行时。

`store.ts` 的 `SaveStore`/`LocalSaveStore` 管理 IndexedDB 原子事务、五回合滚动存档、操作检查点、手动存档、状态哈希与导入校验。每次已执行操作立即排队写检查点，页面隐藏时再补写，不依赖浏览器退出时才保存。未完成写入会显示错误并保留导出入口。当前 schemaVersion 为 1；未来结构变化必须添加迁移及测试。用户设置单独保存，核心状态不直接访问存储。

初轮 100 局 150 回合模拟全部到达结局且无崩溃，但科技推进过慢。根据结果降低初始研究与终局工程成本，明确人口税收与科研贡献，并让 AI 先建工坊、学院，再扩军与扩张。胜率目标仍需后续更大规模模拟与玩家反馈校准。

所有数值与内容在 `src/data/rules.json`；中文文本集中在 `i18n.ts`。本地游玩无需账号或外部字体。PWA、完整 72 项科技、联机、核武器等按文档留在后续阶段。

## 主站登录与云存档

`PortalAuth` 复用主站的 HttpOnly 共享会话，不复制 JWT 签名密钥或邮箱密码。`CloudSaveStore` 与 `SyncedSaveStore` 对接 `/api/games/age-of-nations/*`，本机检查点先写入，自动存档延迟 3.5 秒同步，手动存档立即同步。首次需玩家启用；账号切换后队列分别保留，写入请求的账号标记必须与服务端验证会话一致。

IndexedDB 升级至版本 2，保留原 saves 表，增加同步设置和待上传队列；进度 schemaVersion 仍为 1。每个本机对局使用独立 campaignId 映射到云端自动存档，加载云端自动存档会继承其 revision。离线、会话过期和云端故障不阻塞本地保存；重新登录会比较最近本机自动存档，补传新进度。409 冲突由玩家选择云端、本机或两份保留。

账号验证继续使用主站 D1，游戏的 `nations_*` 表与压缩正文存放在独立的 `yukino-nations` D1 数据库（`GAMES_DB`）。正文按 256 KiB 分块，每次最多八块；元数据、最近三版本、配额与分块在同一 D1 batch 事务中提交。20 份 / 50 MiB 配额按保留版本的逻辑大小计算。同一账号的相同压缩快照共用数据块；删除最后一个引用或淘汰旧版本时回收。账号删除后的游戏数据由独立 Cron 校验主站账号表并清理。云端不解压或记录 GameState 内容。

### 存档与写入优化

- 存储格式 `nations-packed` v1 独立于游戏 schemaVersion：重复记录的字段名只写一次，地图坐标 ID 在读取时恢复，视野改用地图索引。单位、城市、日志和完整命令记录全部保留，不截断重放历史。JSON 文件导入导出格式保持兼容；早期 JSON / gzip 快照仍可读取。
- 本机相同检查点与自动档跳过重复写入。云端同一对局的待上传进度合并为最新一份；未改变的自动存档不上传，手动另存仍保留独立存档。待上传队列持久保存压缩快照，并直接复用已压缩内容上传。
- 自动同步仍延迟 3.5 秒合并连续操作，手动存档立即同步。重复上传或丢失回执后的重试不会增加版本；不同内容的旧 revision 仍产生 409，由玩家选择。
- `node scripts/benchmark-nations-saves.mjs` 比较新旧 gzip 体积，生成 `.wrangler/nations-saves/benchmark.json`。`node scripts/check-nations-d1.mjs` 在实际 Workers / D1 本机运行时检查 2 MiB 分块恢复与中途失败后的事务回滚。

### 发布与旧数据

CI 运行 `scripts/ensure-nations-d1.mjs`，查找或创建名为 `yukino-nations` 的数据库，将真实 ID 写入本次发布的 Pages 和 D1 清理 Worker 配置，然后幂等执行 `cloud/schema.sql`。部署令牌需要 `Account > D1 > Edit`，无需开通 R2。清理配置中的全零 ID 仅为占位，必须先运行配置脚本，不能直接用于生产部署。

`scripts/migrate-nations-legacy.mjs` 一次性复制旧主站数据库中的游戏元数据，不修改主站记录或私有对象；中断后可恢复。旧 R2 存档保留只读回退，新保存一律进入 D1。另一款游戏及历史对象仍沿用原有的可选 R2 发布步骤；R2 的 `10042` 不影响《列国纪元》的 D1 存档。D1 权限、迁移或网络错误会停止本次发布，不会假装云端可用。

## 验证边界

自动测试不代表真机帧率、手机发热、外部玩家可用性或胜率平衡已经达标。发布前后需要真机检查；核心规则变更后应运行完整自对战模拟，再根据结果校准 JSON 数值。
