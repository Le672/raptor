import { useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { BROADCAST_INFO } from "@/lib/f1";
import { Empty, External } from "./F1Common";

const TERMS = [
  { name: "正赛与两项冠军", en: "Grand Prix / Championships", text: "正赛决定单站成绩。赛季累计积分分别决定车手世界冠军和车队世界冠军；车队积分来自旗下车手。", source: "https://www.formula1.com/en/results.html" },
  { name: "积分怎么计算", en: "Championship points", text: "正常完成全程的正赛，前十名依次获得 25、18、15、12、10、8、6、4、2、1 分；冲刺赛前八名为 8 至 1 分。缩短赛事可能适用不同计分规则。", source: "https://www.fia.com/regulation/category/110" },
  { name: "最快圈不再加分", en: "Fastest lap", text: "2025 年起，最快圈的额外积分已取消。比赛成绩中的最快圈标记用于展示圈速表现，不代表额外得分。", source: "https://www.formula1.com/en/latest/article/fastest-lap-point-to-be-scrapped-in-2025-after-latest-fia-world-motor-sport.4pUjDzWnGRN7KVWENLc1BY" },
  { name: "排位赛", en: "Qualifying", text: "排位赛用于争取正赛发车位置。Q1、Q2、Q3 逐轮淘汰，成绩按各阶段记录展示；最终发车顺序也可能受罚退影响。", source: "https://www.formula1.com/en/latest/article/f1-glossary-f-j.2g6grJVxT6dFCDpSmgoCQX" },
  { name: "轮胎的五种颜色", en: "Tyre compounds", text: "软胎为红色，中性胎为黄色，硬胎为白色；半雨胎为绿色，全雨胎为蓝色。软、中、硬是该周末的相对选择，并非每站都使用相同配方。", source: "https://www.formula1.com/en/latest/article/the-beginners-guide-to-f1-tyres.61SvF0Kfg29UR2SPhakDqd" },
  { name: "黄旗、红旗与蓝旗", en: "Flags", text: "黄旗提醒赛道危险，车手需减速并遵守限制；红旗表示场次暂停。正赛中的蓝旗通常提醒被套圈车手让行，方格旗标志场次结束。", source: "https://www.formula1.com/en/latest/article/the-beginners-guide-to-formula-1-flags.T5DqOqbWI6S4Va8Y5yMld" },
  { name: "安全车与虚拟安全车", en: "SC / VSC", text: "安全车以实体车辆控制车流；虚拟安全车通过规定时间差限制车速。两者会影响进站窗口、车手间隔与比赛节奏。", source: "https://www.formula1.com/en/latest/article/f1-glossary-a-e.1MFONigMlQSbSQtpP7YCy2" },
  { name: "进站与策略", en: "Pit stop / Undercut", text: "进站换胎会损失赛道时间，也会改变后续速度。提前进站尝试凭新胎获得优势，常被称为 undercut；实际效果还取决于交通与轮胎升温。", source: "https://www.formula1.com/en/latest/article/f1-glossary-a-e.1MFONigMlQSbSQtpP7YCy2" },
  { name: "2026 主动空气动力学", en: "Active aerodynamics", text: "2026 规则引入可调节的前后翼，让赛车在直道和弯道采用不同空气动力设置。查看历史比赛时，仍会见到旧规则中的 DRS。", source: "https://corp.formula1.com/f1-2026-regulations-terminology-update/" },
  { name: "2026 超车、增压与回充", en: "Overtake / Boost / Recharge", text: "Overtake Mode 是满足条件时的超车辅助；Boost 与能量释放有关，Recharge 则指电能回收。2026 起不要将这些机制与旧版 DRS 混用。", source: "https://www.formula1.com/en/latest/article/explained-the-new-key-terms-for-formula-1s-new-for-2026-rules.3T5BU6TC9quGcIpGzoWkY0.3T5BU6TC9quGcIpGzoWkY0" },
  { name: "DNF、DNS、DSQ", en: "Classification status", text: "DNF 表示未完赛，DNS 表示未发车，DSQ 表示取消资格。排名、完赛状态与积分请结合正式成绩一起阅读。", source: "https://openf1.org/docs/#session-result" },
  { name: "直播在哪里看", en: "Official broadcasts", text: "在观赛区选择 F1 TV 或所在地授权平台。直播、车载视角与回放是否开放，取决于你的地区、套餐和平台安排。", source: BROADCAST_INFO },
];
export function F1Guide() {
  const [search, setSearch] = useState("");
  const terms = TERMS.filter((term) => `${term.name} ${term.en} ${term.text}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="f1-section"><div className="f1-section-heading"><div><p className="f1-eyebrow">A SEAT FOR EVERY FAN</p><h2>第一次看，也能看懂</h2></div><BookOpen size={25}/></div><label className="f1-search"><Search size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="搜索 F1 术语" placeholder="搜索轮胎、积分、DRS、旗帜…"/></label><div className="f1-guide-grid">{terms.map((term) => <article key={term.name}><small>{term.en}</small><h3>{term.name}</h3><p>{term.text}</p><External href={term.source}>了解更多 / 来源</External></article>)}</div>{!terms.length && <Empty>未找到相关术语。</Empty>}<div className="f1-resources"><h3>继续探索</h3><External href="https://www.formula1.com/">Formula 1 官方网站</External><External href="https://www.fia.com/regulation/category/110">FIA 规则与文件</External><External href="https://www.pirelli.com/tyres/en-gb/motorsport/car/formula-1">Pirelli 轮胎资料</External><External href="https://jolpi.ca/ergast/">Jolpica 历史比赛数据</External><External href="https://openf1.org/docs/">OpenF1 计时数据文档</External></div></section>;
}
