import { parse, type DefaultTreeAdapterTypes } from "parse5";
import archive from "../_data/f1-driver-of-the-day.json";
import { driverOfTheDaySource, type DriverOfTheDay } from "../../src/lib/f1-awards";

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;

function elements(node: Node, tag: string): Element[] {
  if (!("childNodes" in node)) return [];
  return node.childNodes.flatMap(child => [
    ...("tagName" in child && child.tagName === tag ? [child] : []),
    ...elements(child, tag),
  ]);
}

function plainText(node: Node): string {
  if ("value" in node && node.nodeName === "#text") return node.value;
  if ("tagName" in node && node.tagName === "svg") return "";
  return "childNodes" in node ? node.childNodes.map(plainText).join("") : "";
}

export function parseDriverOfTheDay(html: string, year: number): DriverOfTheDay[] {
  const page = parse(html);
  if (!elements(page, "h1").some(heading => new RegExp(`\\b${year}\\b.*driver of the day`, "i").test(plainText(heading)))) {
    throw new Error("F1 官网返回的奖项页面不符");
  }
  const table = elements(page, "table").find(candidate =>
    elements(candidate, "th").some(cell => plainText(cell).trim() === "Winner"));
  if (!table) throw new Error("F1 官网获奖榜单暂不可用");
  const rows: DriverOfTheDay[] = [];
  const path = new RegExp(`^/en/results/${year}/races/\\d+/[a-z0-9-]+/race-result/?$`);
  for (const tr of elements(table, "tr")) {
    const cells = tr.childNodes.filter((node): node is Element => "tagName" in node && node.tagName === "td");
    if (!cells.length || cells.length === 1) continue;
    const link = elements(cells[0], "a")[0];
    const href = link?.attrs.find(attr => attr.name === "href")?.value;
    const race = link ? plainText(link).trim() : "";
    const code = elements(cells[1], "span").find(span => span.attrs.some(attr =>
      attr.name === "class" && attr.value.split(/\s+/).includes("md:hidden")));
    const rawName = plainText(cells[1]).trim();
    const suffix = code ? plainText(code).trim() : "";
    const driver = (suffix && rawName.endsWith(suffix) ? rawName.slice(0, -suffix.length) : rawName).replace(/\s+/g, " ").trim();
    if (!href || !path.test(href) || !race || !driver) throw new Error("F1 官网获奖榜单格式有变化");
    rows.push({ race, driver, raceUrl: `https://www.formula1.com${href}` });
  }
  if (!rows.length || new Set(rows.map(row => row.raceUrl)).size !== rows.length) {
    throw new Error("F1 官网获奖榜单为空或含重复场次");
  }
  return rows;
}

export async function loadDriverOfTheDay(year: number) {
  const saved = (archive as Record<string, string[][]>)[year]?.map(([race, driver]) => ({ race, driver })) ?? [];
  const source = "Formula 1 官方";
  if (year <= 2025) return { year, rows: saved, source, errors: [] };
  if (year > new Date().getUTCFullYear()) return { year, rows: [], source, errors: [] };
  try {
    const response = await fetch(driverOfTheDaySource(year), {
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error(`F1 官网 HTTP ${response.status}`);
    const html = await response.text();
    if (html.length > 5_000_000) throw new Error("F1 官网响应过大");
    const rows = parseDriverOfTheDay(html, year);
    if (rows.length < saved.length) throw new Error("F1 官网返回的记录少于已核对存档");
    return { year, rows, source, errors: [] };
  } catch {
    if (!saved.length) throw new Error("暂时无法读取 F1 官方获奖榜单");
    return { year, rows: saved, source, stale: true, errors: ["暂时无法更新 F1 官方榜单，显示 2026-11-03 核对的存档。"] };
  }
}
