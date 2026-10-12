// Consumer web availability snapshots checked against the linked official pages.
// Country-level membership is separate from network reputation and account eligibility.
export const AI_POLICY_VERIFIED_ON = "2026-10-11";
export const KNOWN_COUNTRY_CODES = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW".split(" ");
export const AI_REGION_COUNTRIES = {
  chatgpt: "AD AE AF AG AL AM AO AR AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BR BS BT BW BZ CA CD CF CG CH CI CL CM CO CR CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FO FR GA GB GD GE GF GH GL GM GN GP GQ GR GT GW GY HN HR HT HU ID IE IL IN IQ IS IT JM JO JP KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MQ MR MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NZ OM PA PE PF PG PH PK PL PM PS PT PW PY QA RE RO RS RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SZ TD TF TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VN VU WF WS YE YT ZA ZM ZW".split(" "),
  claude: "AD AE AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BZ CA CG CH CI CL CM CO CR CV CY CZ DE DJ DK DM DO DZ EC EE EG ES FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HN HR HT HU ID IE IL IN IQ IS IT JM JO JP KE KG KH KI KM KN KR KW KZ LA LB LC LI LK LR LS LT LU LV MA MC MD ME MG MH MK MN MR MT MU MV MW MX MY MZ NA NE NG NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RW SA SB SC SE SG SI SK SL SM SN SR ST SV SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VN VU WS ZA ZM ZW".split(" "),
  gemini: "AD AE AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BZ CA CC CD CF CG CH CI CK CL CM CO CR CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IS IT JE JM JO JP KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW".split(" "),
} as const;

export const AI_DETAILS_VERIFIED_ON = "2026-10-12";
export type AiSiteId = "chatgpt" | "claude" | "gemini" | "copilot" | "perplexity" | "grok" | "deepseek" | "qwen" | "mistral" | "poe";
export type AiSitePolicy = {
  id: AiSiteId; name: string; href: string; scope: string;
  regionPolicy: "allowlist" | "copilot" | "unpublished";
  summary: string; advice: string;
  account: string; features: string;
  symptoms: { title: string; detail: string }[];
  checks: string[];
  links: { label: string; href: string }[];
};

export const AI_SITE_POLICIES: AiSitePolicy[] = [
  {
    id: "chatgpt", name: "ChatGPT", href: "https://chatgpt.com/", scope: "个人账号网页版", regionPolicy: "allowlist",
    summary: "异常活动可能与登录位置、使用模式和并发会话有关，排查建议包括停用 VPN 或代理。",
    advice: "如出现验证或功能限制，按官方说明使用可信设备与稳定网络排查；名单外访问可能导致账号受限。",
    account: "登录位置突然变化、并发会话或账号共享都可能触发异常活动提示。本站没有读取账号、设备或会话，纯净度高不能排除这些因素。",
    features: "异常活动提示可能影响部分功能；模型、文件或工具的可用性也需要核对账号当前提示，不能单凭 IP 解释。",
    symptoms: [
      { title: "Suspicious activity / 异常活动", detail: "同时核对近期登录设备、位置变化与并发使用；这类提示本身不代表账号已被永久封禁。" },
      { title: "不支持的国家或地区", detail: "优先核对网页支持地区与实际使用资格；提高纯净度不会消除地区限制。" },
    ],
    checks: ["对照地区名单，确认当前入口的资格。", "使用自己的可信设备与稳定网络，检查账号是否存在未知会话。", "保留错误原文、时间与请求编号，通过官方帮助核对账号状态。"],
    links: [
      { label: "地区名单", href: "https://help.openai.com/en/articles/7947663-chatgpt-supported-countries" },
      { label: "异常活动说明", href: "https://help.openai.com/en/articles/10471992-why-am-i-receiving-a-suspicious-activity-alert" },
    ],
  },
  {
    id: "claude", name: "Claude", href: "https://claude.ai/", scope: "个人账号网页版", regionPolicy: "allowlist",
    summary: "IP 与其他信号会参与粗略地区判断，用于地区资格及反滥用核验。",
    advice: "同时核对地区资格和账号状态。IP 数据库的位置不能证明你的实际居住地，也不能代替平台的判断。",
    account: "Claude 个人版会使用 IP 推断的粗略位置参与安全、反滥用与功能资格检查。用户主动开启的搜索位置功能是另一项设置。",
    features: "网页、Claude Code、API 和组织账号的入口与资格需要分别核对；网页地区名单不能证明 API 或订阅功能一定可用。",
    symptoms: [
      { title: "地区不可用或注册受限", detail: "先核对官方地区规则；若数据库位置有分歧，向网络服务商核对出口归属。" },
      { title: "无法使用某项功能", detail: "核对对应入口的账号与功能资格，不能把功能缺失直接归因于 IP 被封。" },
    ],
    checks: ["确认使用的是个人网页、组织入口还是 API。", "核对支持地区；粗略 IP 位置不等于实际居住地。", "检查账号显示的限制原因，再由官方支持核对。"],
    links: [
      { label: "地区名单", href: "https://support.claude.com/en/articles/8461763-where-can-i-access-claude" },
      { label: "IP 与位置说明", href: "https://privacy.claude.com/en/articles/11186740-does-claude-use-my-location" },
    ],
  },
  {
    id: "gemini", name: "Gemini", href: "https://gemini.google.com/", scope: "个人账号网页版", regionPolicy: "allowlist",
    summary: "个人版网页有公开地区和账号资格要求；Google 搜索的共享网络异常提示仅作参考，不是 Gemini 的风控阈值。",
    advice: "此处按个人账号核对；中国大陆在官网仅列为 Workspace 可用，工作账号、年龄与功能资格需另外确认。",
    account: "个人 Google 账号、Workspace 工作账号与学校账号的资格不同；受管理账号还可能取决于管理员启用与年龄条件。本站未检查任何 Google 账号。",
    features: "部分功能需要登录，且因账号类型、年龄、语言和地区不同而变化。个人网页可用不能证明所有模型和功能均可用。",
    symptoms: [
      { title: "Something went wrong / 功能不可用", detail: "官方排查包含账号类型、年龄和位置等多种条件，这个错误不是 IP 黑名单命中的证明。" },
      { title: "Google 异常流量提示", detail: "共享网络说明可供排查，但 Google 搜索的验证规则不是 Gemini 公布的风控阈值。" },
    ],
    checks: ["确认是个人、工作或学校账号，并检查管理员设置。", "分别核对网页地区与目标功能的账号、语言和年龄要求。", "若出现验证，记录具体页面与错误内容，避免把所有 Google 提示混为一类。"],
    links: [
      { label: "网页地区名单", href: "https://support.google.com/gemini/answer/13575153?hl=en" },
      { label: "账号资格", href: "https://support.google.com/gemini/answer/13278668?hl=en" },
      { label: "Google 共享网络说明", href: "https://support.google.com/websearch/answer/86640?hl=en" },
    ],
  },
  {
    id: "copilot", name: "Microsoft Copilot", href: "https://copilot.microsoft.com/", scope: "网页入口与具体功能", regionPolicy: "copilot",
    summary: "覆盖多个市场，中国大陆和部分受限制市场存在例外，新功能的地区范围也可能不同。",
    advice: "官方没有在此说明中列出逐国完整范围；除明确例外外，保留待核对状态，并按具体账号和功能确认。",
    account: "个人 Microsoft Copilot 与 Microsoft 365 的工作、学校入口需分别核对。个人账号、组织授权与管理员策略未被本站检测。",
    features: "官方说明新功能、地区及语言的可用范围可能不同。某功能不可用不等于整个 Copilot 服务阻止了这个 IP。",
    symptoms: [
      { title: "地区或语言不可用", detail: "核对具体功能的地区与语言；中国大陆的官方例外不自动套用于香港。" },
      { title: "组织入口无权限", detail: "先核对账号类型、组织授权和管理员设置，不能仅凭公网出口评分解释。" },
    ],
    checks: ["确认个人网页与 Microsoft 365 组织入口。", "核对目标功能的地区、语言和账号条件。", "查看账号或组织的具体提示，区分登录失败、功能限制和网络验证。"],
    links: [{ label: "地区与语言说明", href: "https://support.microsoft.com/en-au/microsoft-copilot/supported-regions-and-languages-in-microsoft-copilot" }],
  },
  {
    id: "perplexity", name: "Perplexity", href: "https://www.perplexity.ai/", scope: "个人账号网页版", regionPolicy: "unpublished",
    summary: "VPN 可能触发频繁的 Cloudflare 安全检查。",
    advice: "出现频繁安全检查时按官方帮助排查 VPN 和浏览器会话；验证码不代表账号已经被封禁。",
    account: "官方不建议使用 VPN，并说明它可能带来频繁的 Cloudflare 安全检查。账号共享也可能造成账号限制，本站未检查这类行为。",
    features: "网页登录、安全验证和账号权限是不同环节；通过验证码不能证明所有功能或账号权限可用。",
    symptoms: [
      { title: "Cloudflare 检查反复出现", detail: "结合本次 VPN、代理与共享出口标记核对网络；浏览器会话也要单独排查。" },
      { title: "账号访问受限", detail: "保留限制原文，核对是否与账号共享或登录方式有关；不能只看 IP 分数。" },
    ],
    checks: ["依官方帮助核对 VPN、代理和浏览器会话。", "使用自己的账号，检查实际的登录方式与会话状态。", "安全检查持续失败时记录时间、错误原文和页面编号，联系官方支持。"],
    links: [{ label: "账号与 VPN 说明", href: "https://www.perplexity.ai/help-center/en/articles/10352998-account-management-and-security" }],
  },
  {
    id: "grok", name: "Grok", href: "https://grok.com/", scope: "独立网页与 X 内入口", regionPolicy: "unpublished",
    summary: "X 帮助说明其内置 Grok 的可用性跟随 X；不能把这一说明当作 grok.com 的完整地区名单。",
    advice: "按你使用的入口核对账号与地区资格。此处只推断网络风险，不代表 Grok 已识别或限制这个 IP。",
    account: "独立 Grok 服务的条款要求准确的注册信息，并限制账号共享；第三方登录和 X 内入口还涉及相应账号资料。本站无法检查这些资格。",
    features: "grok.com 与 X 内 Grok 的入口和账号条件不同，X 内可用说明不能推断独立站所有功能或地区资格。",
    symptoms: [
      { title: "X 内能用，独立站不能用", detail: "核对两个入口的登录方式与账号状态，不把它们当作同一套网页地区规则。" },
      { title: "某功能或会话受限", detail: "查看入口内具体的账号及功能提示；IP 网络标记只是一部分参考。" },
    ],
    checks: ["确认是 grok.com 还是 X 内入口。", "检查使用的第三方账号、注册资料和实际错误提示。", "按对应入口的官方条款与帮助核对资格。"],
    links: [
      { label: "X 内 Grok 说明", href: "https://help.x.com/en/using-x/about-grok" },
      { label: "独立站官方条款", href: "https://x.ai/legal/terms-of-service" },
    ],
  },
  {
    id: "deepseek", name: "DeepSeek", href: "https://chat.deepseek.com/", scope: "个人账号网页版", regionPolicy: "unpublished",
    summary: "官方条款关注注册资料、账号使用与服务规则；没有在本次查到的资料中公布 IP 封禁概率或完整网页地区名单。",
    advice: "核对注册与账号提示，地区资格保持待确认；网络风险只能作为排查线索。",
    account: "条款要求注册信息真实、准确、完整，并按页面提供的方式验证；信息不符或违规可能影响功能与账号状态。本站未读取注册资料。",
    features: "网页对话与开发者 API 分开核对；API 额度或调用失败不能直接解释网页账号的访问资格。",
    symptoms: [{ title: "注册、验证或登录失败", detail: "先核对页面要求的验证方式与账号资料，再查看网络异常。" }, { title: "服务或功能暂不可用", detail: "记录错误与时间，区分账号提示、服务故障和公网出口问题。" }],
    checks: ["检查当前使用的是网页还是开发者 API。", "按注册页面核对邮箱、第三方登录与验证状态。", "结合具体错误向官方支持确认，本站不能读取内部账号限制。"],
    links: [{ label: "账号与服务条款", href: "https://cdn.deepseek.com/policies/en-US/deepseek-terms-of-use.html" }],
  },
  {
    id: "qwen", name: "Qwen Chat", href: "https://chat.qwen.ai/", scope: "Qwen Chat 网页入口", regionPolicy: "unpublished",
    summary: "Chat 与 Qwen Studio 的入口和条款范围不同；未核实到 Chat 的完整地区名单或公开 IP 风控阈值。",
    advice: "对照实际入口的使用政策与账号提示，不能用 Studio 的资格直接替代 Chat 的资格。",
    account: "需要按当前入口的使用政策核对账号与使用行为；本站未检测年龄、登录资料或平台内部的账号判断。",
    features: "不同入口、模型和工具的可用性需分别检查。模型不可选或功能缺失不能直接认定为 IP 被封。",
    symptoms: [{ title: "登录或安全验证", detail: "结合匿名网络标记与具体登录提示排查；平台未公布与本站分数对应的验证门槛。" }, { title: "Chat 与 Studio 表现不同", detail: "确认域名、账号和对应政策，避免跨入口套用资格结论。" }],
    checks: ["确认当前域名与产品入口。", "查看该入口的账号和使用政策，不跨产品推断地区资格。", "保留错误原文，分别核对网络验证与账号、模型功能限制。"],
    links: [{ label: "Chat 使用政策", href: "https://chat.qwen.ai/legal-agreement/usage-policy" }, { label: "Studio 条款范围", href: "https://qwen.ai/termsservice" }],
  },
  {
    id: "mistral", name: "Mistral · Le Chat", href: "https://chat.mistral.ai/", scope: "Le Chat 网页入口", regionPolicy: "unpublished",
    summary: "官方帮助说明产品有年龄与账号条件，Le Chat 不同套餐的功能和限制需要分别核对。",
    advice: "地区名单未核实到时保持未知；先看账号与套餐提示，再结合网络证据排查。",
    account: "官方要求至少 13 岁，未成年人须取得家长或监护人许可。本站未检查账号年龄或许可，不把高纯净度当作资格证明。",
    features: "Le Chat 的 Free、Pro 与 Team 功能和使用限制不同；额度或套餐提示不能当作 IP 黑名单记录。",
    symptoms: [{ title: "额度或功能受限", detail: "先核对当前套餐、额度和功能支持；这是账号层面的信息。" }, { title: "登录或网页验证失败", detail: "记录错误，单独排查浏览器会话、网络与账号条件。" }],
    checks: ["核对账号年龄及当前产品的资格要求。", "检查 Le Chat 套餐、额度和目标功能。", "区分额度提示、验证提示与服务故障，再联系官方帮助。"],
    links: [{ label: "年龄与账号条件", href: "https://help.mistral.ai/en/articles/347631-can-children-use-mistral-products-and-services" }, { label: "Le Chat 功能帮助", href: "https://help.mistral.ai/en/collections/701669-le-chat" }],
  },
  {
    id: "poe", name: "Poe", href: "https://poe.com/", scope: "Poe 聚合服务网页", regionPolicy: "unpublished",
    summary: "Poe 聚合多个模型，机器人和计算点数规则由 Poe 页面说明；并不是各模型提供方的原生网页入口。",
    advice: "核对 Poe 自身的账号、机器人和点数，不套用原生 ChatGPT 或 Claude 网页的可用性结论。",
    account: "这里评估 Poe 网页的网络线索，未读取 Poe 的登录或订阅状态；使用某个机器人不等于拥有原模型平台的账号资格。",
    features: "不同机器人消耗不同点数，免费每日点数与订阅点数有不同规则；点数耗尽、上下文限制或机器人不可选不能证明 IP 被封。",
    symptoms: [{ title: "点数不足或机器人不可用", detail: "先看 Poe 账号的点数、对应机器人的说明与当前权限。" }, { title: "某个模型失败，其他模型正常", detail: "核对机器人和服务提示；不要由单个模型错误直接推断整个公网出口被封。" }],
    checks: ["确认是 Poe 内机器人而非原模型平台网页。", "查看机器人的点数、上下文和功能说明。", "检查 Poe 登录与服务提示，网络证据只作为辅助。"],
    links: [{ label: "机器人与点数说明", href: "https://help.poe.com/hc/en-us/articles/19944206309524-Poe-FAQs" }, { label: "套餐与额度帮助", href: "https://help.poe.com/hc/en-us/articles/19945140063636-Poe-Purchases-FAQs" }],
  },
];
