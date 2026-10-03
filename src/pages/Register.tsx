import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Mail } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

export default function Register() {
  useDocumentMeta("注册账号", "在 Yukino Mail 注册邮箱账号，即可登录主站。");
  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md items-center px-6 py-12">
      <div className="glass-panel w-full rounded-[32px] p-8">
        <HomeLink className="inline-flex items-center gap-1.5 text-sm text-stone-600"><ArrowLeft size={16} />返回首页</HomeLink>
        <Mail className="mt-8 text-stone-600" size={30} />
        <h1 className="mt-4 font-display text-3xl text-stone-900">一个邮箱账号，两个入口</h1>
        <p className="mt-4 text-sm leading-7 text-stone-600">在 Yukino Mail 完成注册后，使用同一邮箱和密码即可登录主站。首次登录时会自动关联主站资料。</p>
        <a href="https://mail.yukino.bond/" target="_blank" rel="noreferrer"
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 px-5 py-3 text-sm text-white">
          前往邮箱站注册 <ArrowUpRight size={16} />
        </a>
        <p className="mt-6 text-center text-sm text-stone-500">已有账号？ <Link className="text-stone-900 underline" to="/login">回主站登录</Link></p>
      </div>
    </div>
  );
}
