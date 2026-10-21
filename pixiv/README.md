# Yukino Pixiv 画廊

独立的 Pixiv 搜索与欣赏工具，正式地址为 https://pixiv.yukino.bond 。界面沿用本仓库姬漫的白色侧栏、浅灰蓝背景与蓝粉配色。前端使用仓库现有 React/Vite 依赖，Cloudflare Worker 同时提供 API、静态页面与受限图片转发。

## 功能

- 按标签包含、标签完全一致或标题说明搜索；插画/动图、漫画筛选，最新/最早排序与分页。
- PID、`PID:123`、Pixiv 作品或画师链接直达；每日、每周、每月、新人与原创榜单显示源站实际日期。
- 多图作品翻页、浏览位置恢复、原图查看与单张保存、画师公开作品集、标签跳转；保存前检查 JPEG/PNG/WebP/GIF 完整标记，传输中断时提示重试。
- 本机收藏、最近 120 件作品、最近搜索、JSON 合并备份与日夜主题；320px 起响应式布局。
- 接口成功结果边缘缓存 5 分钟，详情 30 分钟，图片 1 天；无数据库、无 KV、无定时写入。缓存返回原始获取时间。

只访问无需 Pixiv 登录的公开网页接口，不存储 Pixiv 凭据。受限、已删除、非公开及付费内容请到原站查看。动图在本站只展示封面；超过 200 张的作品在原站继续浏览。搜索热门排序需要 Pixiv Premium，本站只提供匿名接口实际支持的时间排序。总数来自源站，经过公开可见性筛选后的本页数量可能较少。

## 本地运行

在仓库根目录安装依赖后执行：

```sh
npm run pixiv:dev
# http://127.0.0.1:5188
npm run pixiv:test
npm run pixiv:build
```

构建目录为 `pixiv/dist`。推送 `master` 的 `pixiv/**` 等相关文件时，`.github/workflows/deploy-pixiv.yml` 使用仓库已配置的 Cloudflare Secrets 部署独立 Worker 与 `pixiv.yukino.bond` 自定义域名，并调用真实搜索、详情、原图和路由检查。手动检查可运行 `node scripts/verify-pixiv-live.mjs`，`PIXIV_BASE_URL` 可指向本地预览。

## 实现参考与权属

参考 [FreeNowOrg/PixivNow](https://github.com/FreeNowOrg/PixivNow)（Apache-2.0）的产品功能与公开接口方式，尤其是 [Pixiv 网页接口说明](https://github.com/FreeNowOrg/PixivNow/blob/master/docs/pixiv-web-api.md) 和服务端统一设置 Referer 的代理思路。本站前后端独立编写，没有复制该项目的应用代码、商标或品牌素材；使用的第三方依赖保留各自许可。姬漫原有应用不受影响。

图片转发只接受 `https://i.pximg.net` 上受支持的图片路径，不转发客户端 Cookie，不允许任意目标、外部重定向或非图片响应。作者说明以纯文本展示，导入备份逐项校验、清理字段并合并较新浏览位置。

本站与 pixiv Inc. 无隶属关系。作品版权归原作者，下载仅供个人欣赏，转载与使用须取得作者许可。
