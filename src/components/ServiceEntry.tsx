import { ArrowUpRight, FileUp, PencilRuler, Wrench } from "lucide-react";
import { yukinoServices, type YukinoService } from "@/data/services";

function ServiceIcon({ service }: { service: YukinoService }) {
  const Icon = service === yukinoServices.drop ? FileUp : service === yukinoServices.draw ? PencilRuler : Wrench;
  return <Icon size={23} strokeWidth={1.5} aria-hidden="true" />;
}

/** An additional destination, leaving each page's existing tools in place. */
export function ServiceEntry({ service }: { service: YukinoService }) {
  return <aside className="portal-card glass-panel flex flex-col gap-5 rounded-[24px] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-label={service.title + "入口"}>
    <div className="flex min-w-0 items-start gap-4">
      <span className="mt-1 shrink-0 text-stone-500"><ServiceIcon service={service} /></span>
      <div className="min-w-0"><h2 className="font-display text-xl text-stone-900">{service.title}</h2><p className="mt-2 text-sm leading-7 text-stone-600">{service.description}</p><p className="mt-2 break-all text-xs text-stone-500">{service.hostname}</p></div>
    </div>
    <a className="pill-button inline-flex w-fit shrink-0 items-center gap-2" href={service.href} target="_blank" rel="noopener noreferrer">打开{service.title}<ArrowUpRight size={15} aria-hidden="true" /></a>
  </aside>;
}
