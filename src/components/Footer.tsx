import { contactLinks } from "@/data/site";

export function Footer() {
  return (
    <footer className="border-t border-white/30 bg-white/20 backdrop-blur-2xl">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.32em] text-stone-500">
            Yukino Bond
          </p>
          <h2 className="font-display text-3xl text-stone-900">
            一个会继续写下去的个人博客。
          </h2>
          <p className="max-w-xl text-sm leading-7 text-stone-600">
            文章、近况、收藏和一些小工具都会慢慢留在这里。主站用来阅读，子域名则安静地承担各自的用途。
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {contactLinks.map((item) => (
            <a
              key={item.label}
              className="rounded-full border border-white/40 bg-white/30 px-4 py-2 text-sm text-stone-700 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
              href={item.href}
            >
              {item.label} · {item.value}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
