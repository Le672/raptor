// Consumer web availability snapshots checked against the linked official pages.
// Country-level membership is separate from network reputation and account eligibility.
export const AI_POLICY_VERIFIED_ON = "2026-10-11";
export const KNOWN_COUNTRY_CODES = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW".split(" ");
export const AI_REGION_COUNTRIES = {
  chatgpt: "AD AE AF AG AL AM AO AR AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BR BS BT BW BZ CA CD CF CG CH CI CL CM CO CR CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FO FR GA GB GD GE GF GH GL GM GN GP GQ GR GT GW GY HN HR HT HU ID IE IL IN IQ IS IT JM JO JP KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MQ MR MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NZ OM PA PE PF PG PH PK PL PM PS PT PW PY QA RE RO RS RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SZ TD TF TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VN VU WF WS YE YT ZA ZM ZW".split(" "),
  claude: "AD AE AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BZ CA CG CH CI CL CM CO CR CV CY CZ DE DJ DK DM DO DZ EC EE EG ES FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HN HR HT HU ID IE IL IN IQ IS IT JM JO JP KE KG KH KI KM KN KR KW KZ LA LB LC LI LK LR LS LT LU LV MA MC MD ME MG MH MK MN MR MT MU MV MW MX MY MZ NA NE NG NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RW SA SB SC SE SG SI SK SL SM SN SR ST SV SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VN VU WS ZA ZM ZW".split(" "),
  gemini: "AD AE AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BZ CA CC CD CF CG CH CI CK CL CM CO CR CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IS IT JE JM JO JP KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW".split(" "),
} as const;

export type AiSiteId = "chatgpt" | "claude" | "gemini" | "copilot" | "perplexity" | "grok";
export type AiSitePolicy = {
  id: AiSiteId; name: string; href: string; scope: string;
  regionPolicy: "allowlist" | "copilot" | "unpublished";
  summary: string; advice: string;
  links: { label: string; href: string }[];
};

export const AI_SITE_POLICIES: AiSitePolicy[] = [
  {
    id: "chatgpt", name: "ChatGPT", href: "https://chatgpt.com/", scope: "个人账号网页版", regionPolicy: "allowlist",
    summary: "异常活动可能与登录位置、使用模式和并发会话有关，排查建议包括停用 VPN 或代理。",
    advice: "如出现验证或功能限制，按官方说明使用可信设备与稳定网络排查；名单外访问可能导致账号受限。",
    links: [
      { label: "地区名单", href: "https://help.openai.com/en/articles/7947663-chatgpt-supported-countries" },
      { label: "异常活动说明", href: "https://help.openai.com/en/articles/10471992-why-am-i-receiving-a-suspicious-activity-alert" },
    ],
  },
  {
    id: "claude", name: "Claude", href: "https://claude.ai/", scope: "个人账号网页版", regionPolicy: "allowlist",
    summary: "IP 与其他信号会参与粗略地区判断，用于地区资格及反滥用核验。",
    advice: "同时核对地区资格和账号状态。IP 数据库的位置不能证明你的实际居住地，也不能代替平台的判断。",
    links: [
      { label: "地区名单", href: "https://support.claude.com/en/articles/8461763-where-can-i-access-claude" },
      { label: "IP 与位置说明", href: "https://privacy.claude.com/en/articles/11186740-does-claude-use-my-location" },
    ],
  },
  {
    id: "gemini", name: "Gemini", href: "https://gemini.google.com/", scope: "个人账号网页版", regionPolicy: "allowlist",
    summary: "个人版网页有公开地区和账号资格要求；Google 搜索的共享网络异常提示仅作参考，不是 Gemini 的风控阈值。",
    advice: "此处按个人账号核对；中国大陆在官网仅列为 Workspace 可用，工作账号、年龄与功能资格需另外确认。",
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
    links: [{ label: "地区与语言说明", href: "https://support.microsoft.com/en-us/microsoft-365-copilot/supported-languages-for-microsoft-365-copilot" }],
  },
  {
    id: "perplexity", name: "Perplexity", href: "https://www.perplexity.ai/", scope: "个人账号网页版", regionPolicy: "unpublished",
    summary: "VPN 可能触发频繁的 Cloudflare 安全检查。",
    advice: "出现频繁安全检查时按官方帮助排查 VPN 和浏览器会话；验证码不代表账号已经被封禁。",
    links: [{ label: "账号与 VPN 说明", href: "https://www.perplexity.ai/help-center/en/articles/10352998-account-management-and-security" }],
  },
  {
    id: "grok", name: "Grok", href: "https://grok.com/", scope: "独立网页与 X 内入口", regionPolicy: "unpublished",
    summary: "X 帮助说明其内置 Grok 的可用性跟随 X；不能把这一说明当作 grok.com 的完整地区名单。",
    advice: "按你使用的入口核对账号与地区资格。此处只推断网络风险，不代表 Grok 已识别或限制这个 IP。",
    links: [
      { label: "X 内 Grok 说明", href: "https://help.x.com/en/using-x/about-grok" },
      { label: "独立站官方条款", href: "https://x.ai/legal/terms-of-service" },
    ],
  },
];
