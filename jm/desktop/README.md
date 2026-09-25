# Yukino 漫画书房（Windows）

独立桌面界面，复用网站的搜索、阅读、封面解码和 PDF/ZIP/CBZ 导出逻辑。桌面版需要联网访问 `jm-api-yukino.3584643854.workers.dev` 和漫画图片源；本地收藏与阅读进度保存在这台电脑上。

## 获取 exe

`release/Yukino-Comic-Studio-1.0.0-portable.exe` 是 Windows x64 便携版，双击即可运行。导出时系统会弹出保存位置窗口。它目前没有代码签名，Windows 首次运行可能显示发布者未知。

## 从源码重建

在仓库根目录安装 Node.js 22、npm 与 pnpm 10，然后运行：

```powershell
npm ci
pnpm --dir jm install --frozen-lockfile
$env:VITE_BACKEND_URL = 'https://jm-api-yukino.3584643854.workers.dev'
pnpm --dir jm/packages/page exec vite build --config vite.desktop.config.ts
node node_modules/electron-builder/out/cli/cli.js --projectDir jm/desktop --config electron-builder.json --win portable
```

输出在 `jm/desktop/release/`。桌面版和网页采用不同入口及样式；网页的 Cloudflare 构建不包含桌面文件。
