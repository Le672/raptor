import { Fragment, type ReactNode } from "react";
import { safeHttpUrl } from "@/lib/content";
import { CopyButton } from "@/components/CopyButton";

// No HTML injection: content stays React text, and links use a protocol allowlist.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^\s)]+\))/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code className="rounded bg-stone-100 px-1" key={index}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = safeHttpUrl(link[2]) ?? (/^\/(?!\/)/.test(link[2]) && !/[\\\x00-\x1f]/.test(link[2]) ? link[2] : null);
      return href ? <a key={index} className="underline underline-offset-4" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{link[1]}</a> : <Fragment key={index}>{link[1]}</Fragment>;
    }
    return part;
  });
}
export function markdownText(value: string) {
  // Original SQL seed used literal backslash-n; authored multiline Markdown is left intact.
  return !value.includes("\n") && value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}
export function markdownHeadings(value: string) {
  let inCode = false;
  return markdownText(value).split("\n").flatMap((line, index) => {
    if (/^\s*```/.test(line)) { inCode = !inCode; return []; }
    const match = !inCode && line.match(/^(#{1,4})\s+(.+)$/);
    return match ? [{ id: `section-${index}`, title: match[2], level: match[1].length }] : [];
  });
}
export function Markdown({ content }: { content: string }) {
  const lines = markdownText(content).split("\n"), blocks: ReactNode[] = [];
  for (let index = 0; index < lines.length;) {
    const start = index, line = lines[index];
    if (!line.trim()) { index++; continue; }
    if (/^\s*```/.test(line)) {
      const language = line.trim().slice(3), code: string[] = []; index++;
      while (index < lines.length && !/^\s*```/.test(lines[index])) code.push(lines[index++]);
      index++;
      blocks.push(<div key={start} className="my-6 overflow-hidden rounded-2xl border border-stone-200"><div className="flex items-center justify-between bg-stone-100 px-4 py-2"><span className="text-xs text-stone-500">{language || "代码"}</span><CopyButton text={code.join("\n")} label="复制代码" /></div><pre className="overflow-x-auto bg-white/50 p-4 text-sm"><code>{code.join("\n")}</code></pre></div>); continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const Tag = heading[1].length <= 2 ? "h2" : "h3";
      blocks.push(<Tag key={start} id={`section-${start}`} className="mb-4 mt-8 scroll-mt-32 font-display text-2xl text-stone-900">{inline(heading[2])}</Tag>); index++; continue;
    }
    if (/^\s*([-*]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line), items: ReactNode[] = [];
      while (index < lines.length && (ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/).test(lines[index])) {
        items.push(<li key={index}>{inline(lines[index++].replace(/^\s*([-*]|\d+[.)])\s+/, ""))}</li>);
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={start} className={`my-4 space-y-2 pl-6 ${ordered ? "list-decimal" : "list-disc"}`}>{items}</List>); continue;
    }
    if (line.startsWith("> ")) { blocks.push(<blockquote key={start} className="my-4 border-l-2 border-stone-300 pl-4 italic">{inline(line.slice(2))}</blockquote>); index++; continue; }
    const paragraph = [line]; index++;
    while (index < lines.length && lines[index].trim() && !/^(#{1,4}\s|```|> |\s*(?:[-*]|\d+[.)])\s)/.test(lines[index])) paragraph.push(lines[index++]);
    blocks.push(<p key={start} className="my-4 whitespace-pre-line break-words leading-8">{inline(paragraph.join("\n"))}</p>);
  }
  return <div className="text-sm text-stone-700">{blocks}</div>;
}
