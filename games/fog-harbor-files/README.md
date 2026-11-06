# 雾港档案 / Fog Harbor Files

独立单人悬疑推理游戏，发布路径为 `https://games.yukino.bond/fog-harbor-files/`。首案《最后一卷录音》具有固定事实和完整解答，后续案件可独立扩展，不改变既有案件。

- `npm run mystery:dev`：本地 Vite，端口 5197。
- `npm run mystery:test`：内容引用、调查顺序、推理判定、结局与同步队列测试。
- `npm run mystery:build`：类型检查、独立构建与离线清单。
- `npm run build`：与主站及列国纪元一同构建。
- `npm run test -- src/test/mystery-cloud-api.test.ts src/test/mystery-routing.test.ts`：真实 SQLite 的存档 API 与独立路径测试。

`src/content.ts` 是版本化的首案内容；`engine.ts` 只处理命令与事实，不依赖 UI、网络、声音或动画。所有关键证据都可通过地点热点取得，人物认罪不作为必需证据。`storage.ts` 使用 IndexedDB 的事务与写入队列，`cloud.ts` 的队列按账号隔离，并将每次调查与主动启用同步的账号绑定。

云端复用现有主站身份验证与私有 `GAMES_SAVES` bucket，使用独立的 `fog_*` 表、`fog/` 对象前缀以及 `/api/games/fog-harbor-files/` API。迁移见 `cloud/schema.sql`，日常清理由原有 games 清理 Worker 同时处理两款游戏。不要将本游戏的章节或案件编号存入列国纪元的回合和时代字段。

剧本与逻辑依据在 `docs/games/fog-harbor-files-spec.md`。关键音轨同时以转录、时间码和背景事件表达；“朗读转录”使用设备语音辅助阅读，界面明确区分它与案件中的原始记录。所有环境音可关闭。

完整离线包通过游戏内设置主动下载。缓存范围仅为 `/fog-harbor-files/`，不会缓存账号接口，也不会接管其他子路径。

后续案件应增加自己的内容版本、素材目录与验证用例，并保持旧存档的版本边界。不能在现有 `1.0.0` 内容中更改时间线或证据意义。
