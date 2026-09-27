# Yukino 余票提醒

网页入口：`https://cr.yukino.bond`（部署后）；同一页面也可在 `https://www.yukino.bond/cr` 打开。

## 功能

- 填写出行日期、12306 车站名、可选车次、关注席别和 1–60 分钟的检查间隔。
- Cloudflare Pages Function 从 12306 获取车站列表与余票，结果显示车次、时间及各席别状态。
- 网页可发送浏览器系统通知。需要允许通知，并保持页面打开；后台标签页休眠时检查可能延迟。
- Windows 便携版使用同一界面，最小化或关闭窗口后留在系统托盘继续轮询，发现关注席别余票时发送 Windows 通知。配置保存在本机用户数据目录。
- 只在无票变有票时通知，避免每次轮询重复提示；重新开启监控后会重新提醒当前有票的车次。

12306 余票接口未提供可信的物理配属车型，页面会明确显示“12306 未提供准确配属车型”。车次字母前缀不能当作车型。软件只查询余票，不登录、抢票或购票。上游限流、网络故障、列车调图和浏览器休眠都可能影响提醒，出行与购票请以 12306 官网为准。

## 本地运行

```powershell
npm ci
npm run build
npx wrangler pages dev dist
```

打开本地预览的 `/cr`。仅运行 Vite 开发服务时，Cloudflare Functions 不会启动，余票 API 无法查询。

## 构建 Windows 便携版

```powershell
npm run build
node node_modules/electron-builder/out/cli/cli.js --config rail-electron-builder.json --win portable
```

生成文件在 `release-rail/`。推送到 `master` 后，`build-rail-desktop.yml` 也会构建并上传 Windows 构建产物。桌面版通过 `www.yukino.bond/api/rail` 查询，不要求窗口保持打开，但需要网络且云端 API 已部署。

主站的 Cloudflare Pages 部署工作流会绑定 `cr.yukino.bond`，并尝试在 DNS 中创建指向 `raptor.pages.dev` 的 CNAME。现有部署令牌若缺少 Zone Read 或 DNS Edit 权限，网站构建仍可成功，但需在 Cloudflare DNS 中补齐该 CNAME；不能仅靠前端路由创建域名。
