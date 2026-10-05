import { ArrowLeft, GitCommit, Plus, Wrench, Zap } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

type ChangelogEntry = {
  date: string;
  version?: string;
  type: "feature" | "improvement" | "fix";
  title: string;
  changes: string[];
};

const changelog: ChangelogEntry[] = [
  {
    date: "2026-10-05",
    type: "feature",
    title: "车站到发大屏",
    changes: [
      "余票工具新增车站大屏，网页与 Windows 桌面端均可选择全国 12306 车站及到发日期，以深色电子屏展示车次、始发终到、计划到发时间、停靠时长、站台、检票口和列车／检票状态",
      "支持到达与出发切换、车次与到发站筛选、近期车次、每分钟自动刷新、分页、自动翻页与全屏展示；跨日车次保留实际始发日期，窄屏表格可横向滑动",
      "到发与停台资料直接查询 12306，按始发日逐日核验开行，区分当日不开行与临时取消；正晚点补充官方未来三小时结果，候车、检票中、停检、取消只展示官方确认的状态，缺失项标注未提供，更新失败保留旧快照并隐藏过期实时状态",
      "列车位置停站表沿用原有浅色样式，补充各站车次、始发终到、停靠时长、站台、检票口及列车／检票状态，保留下一站与已过站进度；跨日按停站日期查询，过期实时状态自动隐藏",
      "cr.yukino.bond 首页保持根地址，四个功能分别使用 /ticket、/transfer、/live 和 /arrivalinfo；支持直达、刷新、浏览器前进后退及旧链接兼容，切换保留余票查询和监控状态；页底 RailGo 补充来源署名缩为居中小卡片",
    ],
  },
  {
    date: "2026-10-05",
    type: "improvement",
    title: "Yukino Mail 与主站统一风格",
    changes: [
      "邮箱站登录与注册页、侧栏、邮件列表、设置和弹窗统一采用主站的浅色纸张背景、鼠尾草绿配色、细边框及衬线标题；品牌头像和 Yukino 标识与主站一致",
      "登录页加入信件插画与返回主站入口，邮箱导航补充主站链接；适配手机窄屏和深色模式，登录表单支持回车提交、密码显示与键盘切换注册入口",
    ],
  },
  {
    date: "2026-10-05",
    type: "fix",
    title: "列车位置地图国内访问",
    changes: [
      "2D 底图默认改用高德国内地图，保留 OpenStreetMap 备用来源；加载失败或超时可直接重试和切换底图",
      "切换 2D 与卫星图时同步转换铁路线路、停站与设备位置坐标，保留当前视野和缩放，避免底图偏移；适配窄屏地图来源选择器",
    ],
  },
  {
    date: "2026-10-05",
    type: "feature",
    title: "Yukino F1 围场与比赛中心",
    changes: [
      "新增 f1.yukino.bond 与主站 /f1 入口，整合历年赛历、赛道资料、比赛周末时间表、正赛／排位／冲刺成绩、车手和车队积分榜；可切换赛季、时区和赛事，并导出整季或单站日历",
      "比赛中心展示 OpenF1 场次计时、轮胎、赛道天气和赛事控制消息，标明实时、未开赛、已结束和数据不可用状态；实时计时需有效订阅凭据，未接入时明确显示计时不可用，页面区分检查时间与赛道数据时间，避免将历史记录显示为直播",
      "加入 F1 TV、腾讯体育、beIN SPORTS 和全球官方转播入口，支持在页面内播放用户有观看权限的 HLS／MP4 地址，HLS 优先使用播放器引擎以改善 Chrome 兼容性，并提供明确标注年份的官方历史集锦；本站不提供赛事视频信号",
      "新增真实逐圈对比、分段数据和原始 CSV 导出；整合 Sky Sports、Autosport、BBC F1 资讯，以及积分、旗帜、轮胎与 2026 规则说明，车手关注列表保存在当前浏览器",
      "首页、顶端导航与资源导航补充 F1 入口；数据源部分失败时保留可用内容、标记未知项，后台标签页暂停自动查询",
      "车手卡片和计时表改用 F1 官网的真实车号图案，保留描边、斜体等专属造型，并按 2026 赛季显示实际参赛车号；图案在本站加载，旧赛季与暂无对应图案的车手保留数据源号码",
      "车手姓名改为 F1 官网的手写名与赛事字体大写姓氏，积分榜、比赛成绩和计时表同步展示；国籍改为国旗，车队加入官方标志与 2026 赛车图，并保留旧赛季的历史车队名称",
      "比赛中心扩展为多面板看板，新增圈速／分段／轮胎策略切换、赛道布局、用胎时间线与胎龄、进站通道和停车耗时、车队无线电原声及双车手圈速对比；可筛选赛控事件和蓝旗、自选显示面板，天气补充风向和气压，无效用胎圈数显示未知，实时授权与缺失数据状态保持明确",
    ],
  },
  {
    date: "2026-10-04",
    type: "feature",
    title: "平铺导航、小游戏与新闻阅读室",
    changes: [
      "移除“更多”和折叠菜单，所有页面统一展示顶端导航；游戏、新闻、资源、设备、实验、友链、订阅、状态与日志均可直接打开，手机端自动多行排列",
      "小游戏增至 19 个，新增数独、数字华容道、四子棋、五子棋、关灯挑战、猜数字、打地鼠、反应测试与中英文打字练习；支持每日数独与华容道题目，人机或本机双人棋局",
      "游戏中心增加分类搜索、收藏、最近游玩、随机一局和可分享链接，游戏按需加载；修复记忆翻牌空白图案、计时和最少步数记录，新游戏与离开页面会清理计时器",
      "新闻源由 4 个扩展到 14 个，补充少数派、Solidot、Ars Technica、GitHub、Cloudflare、Mozilla、NASA、BBC、纽约时报和卫报，失效的 36氪订阅改为阮一峰网络日志；增加分类、语言、来源和标题筛选，支持稍后阅读、更多条目与来源状态展示",
      "新闻抓取增加超时控制、重复链接合并与五分钟缓存，Hacker News 聚合接口不可用时自动尝试官方订阅；部分来源失败不影响其他新闻，无法更新时保留并标注上次快照，新闻页和订阅页均可导出新闻源 OPML",
      "新增专注角落：可调整的番茄钟、待办清单、可撤销的任务删除、自动保存随手记、七日专注记录与备份导出；刷新或切换后台后按实际时间继续计时，个人记录保存在当前浏览器",
      "首页补充新闻、专注与设备入口，全站搜索覆盖所有导航和小游戏；页面按需加载，减少首页下载内容，游戏键盘操作不再干扰搜索输入；增加页面阅读进度和返回顶部，更新浏览器缓存以获取新版界面",
    ],
  },
  {
    date: "2026-10-04",
    type: "improvement",
    title: "车次与车型优先查询 12306",
    changes: [
      "按车次查询补充 12306 按日期车次表，关键词搜索漏项时仍可从官方车次记录识别始发终到；去重并精确匹配车次与日期，停站表和位置查询共用该逻辑",
      "余票、中转及列车位置优先读取 12306 始发日车型资料和官方客运担当；官方缺少车型时才使用 RailGo 参考资料，不为补充车辆配属而额外请求第三方",
      "无指定日期的车型记录标为参考车型，客运担当与车辆配属分别展示；具体车型仍可能因临时调整发生变化，车型补充不阻塞官方余票通知",
    ],
  },
  {
    date: "2026-10-03",
    type: "improvement",
    title: "余票与中转行程：官方数据、站群换乘和排序",
    changes: [
      "停站表、站序、到发时间和跨日运行改由 12306 提供；正晚点使用官方未来三小时查询，暂无结果时按官方时刻表估算",
      "RailGo 仅补充官方缺少的车型、配属和铁路坐标；停止第三方整段车次、时刻表及正晚点查询，单车次车型请求合并并缓存 12 小时",
      "先显示官方余票和停站表，再补充车型；第三方暂不可用时仍可正常查询余票和下一站，网页及 Windows、Android、iOS 客户端同步调整",
      "新增全国多程中转规划：所有官方车站均可作为候选，结合当日推荐、全国干线及城际／市域节点发现路线；按官方城市标识识别全国同城异站，保留广东七组相邻站群，自动处理跨日乘车",
      "每程显示真实车站、到发时间、余票、官方票价和车型插图，最多两次中转、三段列车；可指定中转站及最短换乘、最长等待时间",
      "余票与中转均支持总票价、总耗时、出发／到达时间、余票和车型排序，加入车型及有票筛选；严格核验电报码，避免同城其他车站车次混入，未知票价不计为零元",
      "全国查询可扩大搜索范围并显示候选范围和未完成区间；连续失败时停止请求并提示重试，同城异站明确要求站外交通，未核实城区范围的站点至少预留 180 分钟；同步 Windows 1.9.3 与手机 1.1.2",
      "升级时自动更新旧版车站缓存，确保已访问过的浏览器也能立即识别全国同城异站",
      "中转新增全国城市轨道可选接驳：地铁、轻轨、有轨电车、单轨、磁浮、市域轨道、APM 与轨道缆车；默认关闭且铁路方案优先，可选择轨道站为起终点，按真实线路和站序显示逐段换线与预估耗时",
      "轨道规划在本机读取全国开放网络快照，排除公交、规划施工线路和不完整站序；票价、车型或运营时段缺失时明确标注，总价不把未知费用当零元，铁路小计单列，可手动改为统一排序；同步 Windows 1.9.4 与手机 1.1.3",
    ],
  },
  {
    date: "2026-10-03",
    type: "feature",
    title: "邮箱账号登录与设备清单编辑",
    changes: [
      "主站支持使用 Yukino Mail 的邮箱和密码登录，首次登录自动关联账号；邮箱站超级管理员同步取得主站管理权限，原主站账号保留独立登录入口",
      "注册入口统一引导至邮箱站；密码由邮箱站验证，主站不保存邮箱密码或向浏览器暴露邮箱会话",
      "设备与环境页支持管理员增删分类和条目、修改图标及页面介绍，保存后同步到云端并向访客展示；管理台新增设备清单入口",
      "编辑权限由服务端核实，普通用户与未登录访客只能浏览；保存时检查清单版本，避免不同窗口的修改相互覆盖",
      "修复邮箱登录连接异常，账号或密码错误时正常提示，邮箱服务暂时不可用时保留清晰的重试提示",
    ],
  },
  {
    date: "2026-09-30",
    type: "feature",
    title: "余票提醒 Android 与 iOS 客户端预览",
    changes: [
      "新增独立手机界面与 Android / iOS 原生工程，提供余票查询、车型插图、位置地图及 GPS 测速，手机底部导航与窄屏布局独立适配",
      "接入手机原生通知和本机监控设置；Android 后台最短约 15 分钟检查，iOS 由系统安排，前台按所设间隔检查，后台停止读取 GPS",
      "提供 Android / iOS 自动构建、中文安装和商店发行教程，并新增公开的手机应用隐私政策；正式商店发行仍需开发者账号签名与审核",
    ],
  },
  {
    date: "2026-09-30",
    type: "improvement",
    title: "导航栏头像统一",
    changes: [
      "导航栏的 Y 字徽标换为浏览器标签页同款头像，以圆形展示，适配桌面与手机导航",
    ],
  },
  {
    date: "2026-09-30",
    type: "fix",
    title: "港铁动感号车型与涂装",
    changes: [
      "核对港铁现行及 10 月 11 日起生效的官方时刻表，补齐 77 个动感号车次的车型识别；结合配属、日期、区间与方向判断，实际车型资料优先",
      "动感号显示港铁版 CRH380A，按官方实拍重绘银色车身、红色驾驶窗及灯区、橙色弧线和红白波纹；支持港铁名称及 0251 至 0259 车组号，同步 Windows 1.8.1",
      "Windows 1.8.2 改为独立桌面界面：功能侧栏、紧凑查询工具栏、车次表格与监控状态；修复 exe 加载网页入口，保留通知、托盘与定位功能",
      "Windows 1.8.3 的应用、窗口、托盘及通知图标统一使用余票页同款浅绿底列车图案，提供多尺寸图标",
    ],
  },
  {
    date: "2026-09-29",
    type: "fix",
    title: "补齐普速车位置地图",
    changes: [
      "Z、T、K 和四位数字车次缺少完整铁路线路时保留停靠站地图，显示按时刻表判断的下一站和跨日运行区间",
      "收到 GPS 信号后自动定位到设备实时位置，支持位置跟随、全程站点视图和实时测速；无完整线路时明确标注下一站按时刻表估算",
      "补充普速车查询示例和首站始发日期提示，同步 Windows 1.8.0",
    ],
  },
  {
    date: "2026-09-29",
    type: "fix",
    title: "修复余票页面窄屏排版",
    changes: [
      "手机上查询条件改为单列，日期与时间输入框保持在卡片内，标题和说明可自动换行",
      "调整车次插画与到发时间布局、速度卡片及地图工具栏，长车型名称和停站表不再撑宽页面；同步 Windows 1.7.1 的窄窗口样式",
      "检查间隔范围移到标题同行，使分钟输入框与关注席别下拉框对齐；同步 Windows 1.7.2",
    ],
  },
  {
    date: "2026-09-29",
    type: "feature",
    title: "列车位置与下一停靠站",
    changes: [
      "新增独立的列车位置查询，输入车次和始发日期，查看当前运行区间、下一停靠站及到达时间；余票结果可直接转入查询",
      "沿铁路线路点绘制路线并每秒更新估算位置，下一站仅取当日停站表，区分通过站、停站中、尚未发车和已到终点",
      "支持北京时间、自定义观察时间、跨日停站与正晚点修正；资料缺失时保留停站表推算并说明依据",
      "网页和 Windows 1.4.0 同步，位置明确标注为时刻表及线路估算",
      "修正线路图标题图标的尺寸，保持地图与说明的紧凑排版",
      "新增 GPS 实时定位，按设备位置匹配铁路线路和下一停靠站，显示精度、更新时间及距下一站的线路距离；失效定位明确退回时刻表估算",
      "改为可拖动缩放的完整地图，支持 2D／卫星图切换、全程与当前位置视图；Windows 1.5.0 接入系统定位，隐藏窗口即停止读取",
      "新增实时测速卡片，优先显示设备瞬时速度，缺少读数时根据最近几秒定位短时估算；显示来源、更新时间与误差参考，信号过期或异常时暂停数值，网页与 Windows 1.6.0 同步",
      "无有效 GPS 测速时，结合铁路区间距离、车型和停站时刻预估当前速度，模拟线性加速、巡航与减速；地图按同一速度曲线更新进度，停站显示 0，网页与 Windows 1.7.0 同步",
    ],
  },
  {
    date: "2026-09-29",
    type: "fix",
    title: "按实拍修正车型插画",
    changes: [
      "按中国动车组资料重绘 33 款首车侧视图，修正车头、驾驶窗、窗带和红金色带，并分开处理 AF-C 与智能型涂装",
      "同名头型或代际无法确认的 10 款车型恢复原版插画，图旁标注「参考外观 · 版本待核实」，页底说明版本差异和参考来源",
      "补齐 14 款 CR200J 参考图，修复 CR200J1-C(长编) 无图显示，兼容长编、长编组、全角括号和空格写法；网页与 Windows 1.3.4 同步更新",
      "全面排查车型目录并补齐缺图项，现支持 162 个车型与版本条目；修复 CRH380A 统型、阶段与 NG 名称，新增普速客车参考图和混编图示，新版本说明保留原图并标注",
    ],
  },
  {
    date: "2026-09-28",
    type: "improvement",
    title: "余票提醒开通子域、独立车次查询与车型插画",
    changes: [
      "车次号旁新增 43 款按实拍外观绘制的 Q 版首车侧视图，区分完整型号和参考涂装",
      "型号缺失、冲突或无法区分代际时不显示近似替代图；可展开查看实拍来源和摄影者",
      "补齐 cr.yukino.bond 的 DNS 记录，修正 Pages 目标域名，恢复 HTTPS 余票入口",
      "按出行日期、车站、车次与发车时间匹配 RailGo 车型和配属资料，标明来源与查询时间",
      "新增 rail.re 历史交路入口；第三方资料缺失或暂不可用时仍显示 12306 余票",
      "车次查询与区间查询并列，输入车次即可自动识别线路，区间查询无需填写车次",
      "日期默认今天，车次结果标明全程余票；两种查询均支持网页和 Windows 监控",
    ],
  },
  {
    date: "2026-09-27",
    type: "fix",
    title: "恢复根域名跳转",
    changes: [
      "访问 yukino.bond 时自动以 302 跳转到 www.yukino.bond，保留页面路径和查询参数",
    ],
  },
  {
    date: "2026-09-27",
    type: "feature",
    title: "12306 余票提醒",
    changes: [
      "新增 /cr 余票查询页，可按日期、车站、车次与席别查看结果并定时监控",
      "cr.yukino.bond 子域入口仍在配置中，可先通过主站 /cr 使用",
      "网页开启浏览器通知；Windows 桌面版在系统托盘持续检查并发送系统通知",
      "结果显示席别余票和查询时间，车型未获可靠数据时明确标注",
    ],
  },
  {
    date: "2026-09-25",
    type: "feature",
    title: "姬漫图书馆与桌面端上线",
    changes: [
      "上线 JM 网页图书馆与 Cloudflare 子域部署，提供漫画浏览、阅读、搜索、收藏和批量下载",
      "新增 Windows 桌面漫画工作台及独立构建流程",
      "重做 JM 图书馆界面，更新站点标题和应用图标",
      "优化 Yukino 品牌标识：首页插画改为「记录」，导航徽标改为 Y",
    ],
  },
  {
    date: "2026-09-23",
    type: "feature",
    title: "首页改版与全站搜索",
    changes: [
      "重做首页、关于、笔记与博客页面，围绕个人数字花园重新整理内容",
      "笔记卡片可直达对应文章，修复本地预览环境的站内路由",
      "新增 Ctrl/⌘ K 全站搜索，覆盖文章、常用页面和站点入口",
      "笔记页新增即时关键词筛选，文章页支持复制当前链接",
    ],
  },
  {
    date: "2026-09-22",
    type: "improvement",
    title: "个人站视觉与导航重整",
    changes: [
      "建立统一的 Yukino 配色、排版和页面视觉样式",
      "简化桌面导航，统一页头、页脚和页面入口",
      "改善移动菜单与键盘操作，并加入跳转到正文的无障碍入口",
    ],
  },
  {
    date: "2026-07-31",
    type: "feature",
    title: "新增桌面端与 Android 应用支持",
    changes: [
      "加入 Electron 桌面应用和 Capacitor Android 项目配置",
      "新增 Windows 桌面安装包构建流程；移除无法在 Windows 构建的 iOS 平台目标",
      "修复 Electron 使用 file:// 加载时的静态资源路径",
    ],
  },
  {
    date: "2026-09-26",
    version: "v0.8.0",
    type: "improvement",
    title: "JM 漫画书房独立重写",
    changes: [
      "重写 jm.yukino.bond 的搜索、作品详情和阅读界面，网页视觉与主站统一",
      "新增本机书架、阅读进度、纵向与横向阅读、缩放、缓存和 PWA 安装",
      "支持章节批量导出为 CBZ、ZIP、PDF，并提供可配置的 OCR 翻译入口",
      "Windows 便携版采用独立深色工作台界面，不再沿用网页版布局",
    ],
  },
  {
    date: "2026-07-29",
    version: "v0.7.0",
    type: "feature",
    title: "新闻聚合页、自动部署与文案润色",
    changes: [
      "新增 news.yukino.bond 新闻聚合页，聚合 IT之家、36氪、Hacker News、The Verge 四个源，支持按源筛选、刷新、部分失败提示",
      "新增 Pages Function /api/news，服务端抓取并解析 RSS 转 JSON，解决跨域，10 分钟缓存",
      "配置 GitHub Actions：push 到 master 自动构建并部署到 Cloudflare Pages，免手动 wrangler",
      "README 新增简体中文版 README.zh-CN.md，顶部加语言切换链接，保留英文版不替换",
      "润色主页文案：去掉 AI 元叙述，tagline、intro、三个 section 标题与段落改为博客作者口吻",
      "本地仓库与 GitHub 同步：以远程为准 reset，安装 Git 与 Node.js 环境",
    ],
  },
  {
    date: "2026-07-16",
    type: "fix",
    title: "修复 TypeScript 5.8 构建配置",
    changes: [
      "移除已弃用的 tsconfig baseUrl 配置，保持生产构建兼容并重新部署",
    ],
  },
  {
    date: "2026-07-13",
    version: "v0.6.0",
    type: "fix",
    title: "子域逻辑修复与顶栏排版",
    changes: [
      "修复顶栏在中等屏幕宽度下导航文字竖排：断点从 md 提到 lg，加 whitespace-nowrap，< 1024px 改用汉堡菜单",
      "统一 about 语义：删除 /about 站点地图页，TopNav「关于」与 about.yukino.bond 均指向 /about-me",
      "TopNav 一致性：「开发」「资源」从外链改为站内 SPA 路由 /dev /box，仅「邮箱」保留外链",
      "统一联系邮箱为 Raptor@yukino.bond（关于我、友链页），关于我页网站链接修正为 www.yukino.bond",
      "安全修复：JWT_SECRET 从硬编码改为读取 Cloudflare 环境变量，wrangler.toml 移除明文 [vars] 死配置",
      "清理死代码：删除未引用的 src/components/SubdomainRouter.tsx 与 functions_backup/ 备份目录",
      "修复开发工具的 Base64 编解码，改用 UTF-8 并与标准工具保持一致",
    ],
  },
  {
    date: "2026-06-21",
    version: "v0.5.0",
    type: "feature",
    title: "新增所有子域独立页面",
    changes: [
      "新增 dev.yukino.bond 开发工具页面（Base64、JSON、URL编码、时间戳、哈希、大小写转换、颜色转换）",
      "新增 box.yukino.bond 资源站页面",
      "新增 blog.yukino.bond 博客正文页面",
      "新增 links.yukino.bond 快速导航页面",
      "新增 about.yukino.bond 关于我页面",
      "新增 uses.yukino.bond 设备与环境页面",
      "新增 changelog.yukino.bond 更新日志页面",
      "新增 friends.yukino.bond 友情链接页面",
      "新增 rss.yukino.bond 订阅源页面",
      "新增 lab.yukino.bond 实验室页面",
      "新增 status.yukino.bond 状态页",
    ],
  },
  {
    date: "2026-06-18",
    version: "v0.4.0",
    type: "feature",
    title: "博客首页内容完善",
    changes: [
      "完善首页文章预览卡片",
      "添加站点概览统计区域",
      "优化首页整体布局和信息结构",
    ],
  },
  {
    date: "2026-06-15",
    version: "v0.3.0",
    type: "feature",
    title: "笔记页面与筛选功能",
    changes: [
      "新增笔记页面，支持按标签筛选",
      "添加文章预览卡片组件",
      "引入 zustand 状态管理",
    ],
  },
  {
    date: "2026-06-10",
    version: "v0.2.0",
    type: "improvement",
    title: "关于页面与站点地图",
    changes: [
      "新增关于页面，展示完整子域地图",
      "添加站点设计原则说明",
      "完善联系方式区域",
    ],
  },
  {
    date: "2026-06-05",
    version: "v0.1.0",
    type: "feature",
    title: "项目初始化",
    changes: [
      "使用 Vite + React + TypeScript 初始化项目",
      "配置 Tailwind CSS 样式系统",
      "搭建基础页面结构与路由",
      "设计 glass-panel 视觉风格",
      "部署到 Cloudflare Pages",
    ],
  },
];

const typeConfig = {
  feature: {
    icon: Plus,
    label: "新功能",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  },
  improvement: {
    icon: Wrench,
    label: "改进",
    className: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  },
  fix: {
    icon: Zap,
    label: "修复",
    className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  },
};

export default function Changelog() {
  useDocumentMeta("更新日志", "汇总站点、工具和页面的持续更新记录。");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-10 lg:px-8">
      <div>
        <div className="flex items-center gap-3">
          <HomeLink
            className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-3 py-1.5 text-xs text-stone-600 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
          >
            <ArrowLeft className="size-3.5" />
            返回主页
          </HomeLink>
          <span className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs uppercase tracking-[0.24em] text-stone-600 backdrop-blur-xl">
            changelog.yukino.bond
          </span>
        </div>
        <h1 className="mt-4 font-display text-4xl text-stone-900 sm:text-5xl">
          更新日志
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">
          汇总站点、工具和页面的持续更新记录，方便追踪每次变化。
        </p>
      </div>

      <div className="space-y-1">
        {changelog.map((entry, index) => {
          const config = typeConfig[entry.type];
          const Icon = config.icon;
          return (
            <div key={`${entry.date}-${entry.title}`} className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="flex size-10 items-center justify-center rounded-full border-2 border-white/40 bg-white/30 backdrop-blur-xl">
                  <GitCommit className="size-4 text-stone-500" />
                </div>
                {index < changelog.length - 1 && (
                  <div className="mt-1 w-px flex-1 bg-stone-200" />
                )}
              </div>
              <div className="pb-8">
                <div className="flex flex-wrap items-center gap-3">
                  {entry.version && (
                    <span className="font-display text-xl text-stone-900">
                      {entry.version}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-[0.2em] ${config.className}`}
                  >
                    <Icon className="size-3" />
                    {config.label}
                  </span>
                  <span className="text-xs text-stone-500">{entry.date}</span>
                </div>
                <h3 className="mt-2 text-lg text-stone-900">{entry.title}</h3>
                <ul className="mt-3 space-y-1.5">
                  {entry.changes.map((change) => (
                    <li
                      key={change}
                      className="flex items-start gap-2 text-sm leading-6 text-stone-600"
                    >
                      <span className="mt-2 block size-1 shrink-0 rounded-full bg-stone-400" />
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
