import { ipInCidr, normalizeIp } from "../../src/lib/ip";

function validDate(value: string | undefined, maximumAge: number): string {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp) || timestamp < Date.now() - maximumAge || timestamp > Date.now() + 86400000) throw new Error("名单数据日期缺失或已过期，未纳入判断");
  return new Date(timestamp).toISOString();
}
const ipv4 = (value: string) => normalizeIp(value)?.version === "IPv4";

export function parseDshield(body: string, ip: string) {
  const date = body.match(/^#\s*updated:\s*(\S+)/m)?.[1];
  const updatedAt = validDate(date?.endsWith("Z") ? date : date && `${date}Z`, 3 * 86400000);
  const rows = body.split(/\r?\n/).filter(line => line.trim() && !line.startsWith("#")).map(line => line.split("\t"));
  const ranges = rows.map(row => {
    const start = row[0]?.split(".").map(part => String(Number(part))).join(".");
    const end = row[1]?.split(".").map(part => String(Number(part))).join(".");
    if (!ipv4(start) || !ipv4(end) || row[2] !== "24" || !start.endsWith(".0") || end !== start.slice(0, -1) + "255" || !/^\d+$/.test(row[3] || "")) throw new Error("DShield 网段名单格式异常");
    return { cidr: `${start}/24`, targets: Number(row[3]) };
  });
  if (!ranges.length) throw new Error("DShield 名单为空，未纳入判断");
  return { updatedAt, match: ranges.find(row => ipInCidr(ip, row.cidr)) };
}

export function parseCins(body: string, updated?: string) {
  const updatedAt = validDate(updated, 3 * 86400000);
  const lines = body.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length || lines.some(line => !ipv4(line))) throw new Error("CINS 地址名单格式异常");
  return { updatedAt, addresses: lines };
}

export function parseIpsum(body: string) {
  const updatedAt = validDate(body.match(/^# Last update:\s*(.+)$/m)?.[1], 3 * 86400000);
  const rows = body.split(/\r?\n/).filter(line => line.trim() && !line.startsWith("#")).map(line => {
    const [ip, count, extra] = line.split("\t");
    if (!ipv4(ip) || !/^[1-9]\d{0,3}$/.test(count || "") || extra !== undefined) throw new Error("IPsum 聚合名单格式异常");
    return { ip, count: Number(count) };
  });
  if (!rows.length) throw new Error("IPsum 名单为空，未纳入判断");
  return { updatedAt, rows: rows.filter(row => row.count >= 3) };
}

export function compactIpsum(body: string): string {
  const { updatedAt, rows } = parseIpsum(body);
  if (!rows.length) throw new Error("IPsum 交叉名单为空，未纳入判断");
  // Keep the provenance date, while storing only level >= 3 to stay under D1's row limit.
  return `# Last update: ${updatedAt}\n${rows.map(row => `${row.ip}\t${row.count}`).join("\n")}\n`;
}
