# 列国纪元 · Age of Nations

独立单人策略游戏，发布路径 `https://games.yukino.bond/age-of-nations/`。沿用 `game-spec.md` v0.3 的 P0 范围；主站游戏中心继续保留原有小游戏。

## 开发和发布

- `npm run nations:dev`：本地 `http://127.0.0.1:5196/age-of-nations/`。
- `npm run nations:test`：规则、确定性、存档、AI 与完整回合测试。
- `npm run nations:build`：独立类型检查与生产构建。
- `npm run build`：构建主站并将独立游戏放入 `dist/age-of-nations/`，现有 Pages 工作流一同发布。

## 架构

`core.ts` 只依赖 `content.ts` 与 JSON 数据，无 DOM、墙上时钟或非种子随机数。命令先验证再应用；失败保留原状态。操作记录携带 playerId、turn、seq；LocalHuman / Ai / Remote 共享 PlayerController 接口，Remote 只留接口。状态哈希使用键排序后的规范化序列化，同时兼容读取早期未排序哈希的存档。界面仅拿当前玩家的视图，权威完整状态留在命令与存档边界。`projectView` 为 AI 提供经过迷雾过滤的视图；`ai.worker.ts` 在 Worker 规划对手行动。`render.ts` 使用轻量原生 WebGL 绘制六边形，再叠加 Canvas 墨线、图标与文字；WebGL 不可用时降级 Canvas。这里替换了规范中的建议 PixiJS，以免为无纹理地图引入额外运行时。

`store.ts` 的 `SaveStore`/`LocalSaveStore` 管理 IndexedDB 原子事务、五回合滚动存档、操作检查点、手动存档、状态哈希与导入校验。每次已执行操作立即排队写检查点，页面隐藏时再补写，不依赖浏览器退出时才保存。未完成写入会显示错误并保留导出入口。当前 schemaVersion 为 1；未来结构变化必须添加迁移及测试。用户设置单独保存，核心状态不直接访问存储。

初轮 100 局 150 回合模拟全部到达结局且无崩溃，但科技推进过慢。根据结果降低初始研究与终局工程成本，明确人口税收与科研贡献，并让 AI 先建工坊、学院，再扩军与扩张。胜率目标仍需后续更大规模模拟与玩家反馈校准。

所有数值与内容在 `src/data/rules.json`；中文文本集中在 `i18n.ts`。本地游玩无需账号或外部字体。PWA、完整 72 项科技、联机、核武器等按文档留在后续阶段。

## 主站登录与云存档

`PortalAuth` 复用主站的 HttpOnly 共享会话，不复制 JWT 签名密钥或邮箱密码。`CloudSaveStore` 与 `SyncedSaveStore` 对接 `/api/games/age-of-nations/*`，本机检查点先写入，自动存档延迟 3.5 秒同步，手动存档立即同步。首次需玩家启用；账号切换后队列分别保留，写入请求的账号标记必须与服务端验证会话一致。

IndexedDB 升级至版本 2，保留原 saves 表，增加同步设置和待上传队列；进度 schemaVersion 仍为 1。每个本机对局使用独立 campaignId 映射到云端自动存档，加载云端自动存档会继承其 revision。离线、会话过期和云端故障不阻塞本地保存；重新登录会比较最近本机自动存档，补传新进度。409 冲突由玩家选择云端、本机或两份保留。

后端复用主站 D1 的账号验证与独立 `nations_*` 表，压缩存档放在私有 R2。D1 条件更新与事务控制 revision、20 份 / 50 MB 配额以及最近三版本；R2 使用唯一暂存键，失败写入不会覆盖其他设备的对象。删除保留标记以阻止旧设备静默恢复，Cron 清理中断上传、过期对象与已注销账号的存档。云端不解析 GameState，也不记录存档内容。

部署工作流创建私有 `yukino-games-saves` bucket，幂等执行 `cloud/schema.sql` 并发布每日清理 Worker；R2 必须已启用，现有部署令牌需要 R2 读写权限。存档无需公开 bucket 地址。`privacy.html` 说明存储内容、版本保留、导出与删除。

## 验证边界

自动测试不代表真机帧率、手机发热、外部玩家可用性或胜率平衡已经达标。发布前后需要真机检查；核心规则变更后应运行完整自对战模拟，再根据结果校准 JSON 数值。
