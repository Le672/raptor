# Yukino 日常实验室

三个原创的小项目，共用独立的私有管理入口和 SQLite 持久化数据：

- [网页变化雷达](https://tools.yukino.bond/lab/radar/)：每 15 分钟至每天检查公开页面，支持关注词、暂停、手动检查、20 版文字快照与逐行差异。只读取静态 HTTP 内容，不执行 JavaScript；失败不会覆盖最后一次成功快照。
- [Webhook 回调信箱](https://tools.yukino.bond/lab/hooks/)：每个信箱有随机接收地址，支持真实测试请求、请求头/方法/查询/正文查看与停用。请求头和查询中的常见认证字段遮盖，正文保留前 16 KiB；请求最大 32 KiB，每个信箱每分钟最多 30 次，保留最近 100 条并在 7 天后清理。
- [短链工坊](https://tools.yukino.bond/lab/links/)：自定义短名、有效期、停用、SVG 二维码与累计/每日点击。仅接受 HTTP/HTTPS 标准端口地址，不保存访问者 IP；HEAD 请求不计点击。

服务上限：12 个监测页面、12 个信箱、100 条短链。停用保留数据；删除会删除该项及关联记录。首页可导出完整 JSON，导出包含信箱接收地址与私有记录，请自行保管。

## 部署

源代码位于本目录，Windows 维护与部署脚本位于 `../vps-playground` 的实际同级工作区目录 `D:/Administrator/Documents/Raptor/vps-playground`。服务端源代码放在 `/opt/yukino-lab/apps/current`，独立虚拟环境放在 `/opt/yukino-lab/apps/venv`，状态目录为 `/var/lib/yukino-lab-apps`。

Flask + Gunicorn 运行在 `yukino-lab-apps.service`，使用 systemd 动态用户、只读系统、256 MiB 内存和半核 CPU 上限。只监听 `/run/yukino-lab-apps/app.sock`，由已有 Nginx 的 `tools.yukino.bond/lab/` 路径代理，不新增公网端口或 DNS 记录。原 IT-Tools 首页与工具路径继续由原容器处理。

现有 IT-Tools 使用覆盖根路径的 Workbox 离线导航。网关对固定镜像的 `sw.js` 添加 `/lab` 导航排除，部署时检查原模式唯一并验证实际响应；脚本设置 `no-store`，首次迁移精确清理 CDN 中的该脚本与品牌脚本，不清理浏览器数据。后续若更换 IT-Tools 镜像，必须重新核对这一规则。

随机专用管理口令由 systemd `LoadCredential` 从 `/opt/yukino-lab/secrets/apps-owner-key` 传入，不进入源码、命令参数或日志。本机副本位于 `D:/Administrator/Documents/Raptor/vps-playground/.private/apps-access.json`。管理口令与主站账号、原传送门口令分别管理。登录 Cookie 为 Secure / HttpOnly / SameSite=Strict，有效一天；写操作验证 CSRF。

网页抓取对每一跳解析结果进行公网地址检查，并将目标 IPv4 固定给 curl，保留正常 TLS 校验；拒绝内网、保留地址、账号密码 URL、非标准端口和非文字响应，最多 3 次跳转、512 KiB 响应，快照最多 40,000 字符。抓取流量不使用服务器默认代理。

依赖由官方 PyPI 下载固定版本，`requirements.lock.txt` 固定全部运行依赖；部署脚本生成离线 wheel 清单并在服务器逐一验证 SHA-256 后安装。

## 维护

```sh
systemctl status yukino-lab-apps.service --no-pager
journalctl -u yukino-lab-apps.service -n 80 --no-pager
systemctl restart yukino-lab-apps.service
systemctl status yukino-lab-apps-backup.timer --no-pager
systemctl start yukino-lab-apps-backup.service
```

每日备份通过 SQLite 在线备份 API 生成，经 `quick_check` 验证后存入 `/var/backups/yukino-lab/apps`，只清理该目录内本应用命名规则下超过 14 天的备份。恢复前先停止本应用并保存当前数据库，再恢复由该服务生成的备份；不要替换其他项目数据。动态用户状态目录的实际位置由 systemd 管理，恢复后应确认目录所有者。

## 验证

```powershell
lab-apps/.venv/Scripts/python.exe -m unittest discover -s lab-apps/tests -v
```

12 项隔离 API 测试覆盖身份与 CSRF、公网/DNS/跳转边界、回调脱敏/大小/过期、短链重定向/停用/到期/计数/二维码、快照变化与失败保存、重启持久化。线上验收单独记录，不以隔离测试替代真实收发或公网证明。
