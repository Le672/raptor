import { ArrowUpRight, Globe2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { CopyButton } from "@/components/CopyButton";
import { useVisitorNetwork } from "@/hooks/useVisitorNetwork";
import "@/ip.css";

export function VisitorNetwork({ compact = false }: { compact?: boolean }) {
  const visitor = useVisitorNetwork();
  return <section className={`visitor-network${compact ? " visitor-network-compact" : ""}`} aria-label={compact ? "访问者网络摘要" : "访问者网络信息"} data-testid={compact ? "visitor-network-compact" : "visitor-network"}>
    <Globe2 size={compact ? 14 : 18} aria-hidden="true" />
    {visitor.loading ? <span role="status">正在读取当前 IP 与 ASN…</span> : visitor.error || !visitor.data?.ip ? <>
      <span>{visitor.error || "当前环境未提供公网连接信息。"}</span>
      <button type="button" className="ip-text-button" onClick={visitor.refresh} aria-label="重新读取连接信息"><RefreshCw size={13} /> 重试</button>
    </> : <>
      <div className="visitor-network-data"><span>你的 IP <strong>{visitor.data.ip}</strong></span><span><strong>{visitor.data.asn || "ASN 未提供"}</strong> {visitor.data.organization || "网络组织未提供"}</span></div>
      {!compact && <CopyButton text={visitor.data.ip} label="复制 IP" />}
    </>}
    <Link className="visitor-network-link" to="/ip">IP 纯净度 <ArrowUpRight size={13} /></Link>
  </section>;
}
