# 列国纪元 · Age of Nations

独立单人策略游戏，发布路径 `https://games.yukino.bond/age-of-nations/`。沿用 `game-spec.md` v0.3 的 P0 范围；主站游戏中心继续保留原有小游戏。

## 开发和发布

- `npm run nations:dev`：本地 `http://127.0.0.1:5196/age-of-nations/`。
- `npm run nations:test`：规则、确定性、存档、AI 与完整回合测试。
- `npm run nations:build`：独立类型检查与生产构建。
- `npm run build`：构建主站并将独立游戏放入 `dist/age-of-nations/`，现有 Pages 工作流一同发布。

## 架构

`core.ts` 只依赖 `content.ts` 与 JSON 数据，无 DOM、墙上时钟或非种子随机数。命令先验证再应用；失败保留原状态。`projectView` 为 AI 提供经过迷雾过滤的视图；`ai.worker.ts` 在 Worker 规划对手行动。`render.ts` 使用轻量原生 WebGL 绘制六边形，再叠加 Canvas 墨线、图标与文字；WebGL 不可用时降级 Canvas。这里替换了规范中的建议 PixiJS，以免为无纹理地图引入额外运行时。

`store.ts` 的 `SaveStore`/`LocalSaveStore` 管理 IndexedDB 原子事务、五回合滚动存档、操作检查点、手动存档、状态哈希与导入校验。每次已执行操作立即排队写检查点，页面隐藏时再补写，不依赖浏览器退出时才保存。未完成写入会显示错误并保留导出入口。当前 schemaVersion 为 1；未来结构变化必须添加迁移及测试。用户设置单独保存，核心状态不直接访问存储。

所有数值与内容在 `src/data/rules.json`；中文文本集中在 `i18n.ts`。首屏无需网络接口、账号或外部字体。云存档、账号对接、PWA、完整 72 项科技、联机、核武器等按文档留在后续阶段。

## 验证边界

自动测试不代表真机帧率、手机发热、外部玩家可用性或胜率平衡已经达标。发布前后需要真机检查；核心规则变更后应运行完整自对战模拟，再根据结果校准 JSON 数值。
