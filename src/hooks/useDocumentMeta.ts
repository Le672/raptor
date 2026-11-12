import { useEffect } from "react";

const defaultTitle = "Yukino Portal";
const defaultDescription =
  "yukino.bond 的个人博客首页，聚合文章、近况，以及邮件、工具和资源等子域入口。";

export function useDocumentMeta(title: string, description = defaultDescription) {
  useEffect(() => {
    const previousTitle = document.title;
    const metaDescription =
      document.querySelector('meta[name="description"]') ??
      document.createElement("meta");

    metaDescription.setAttribute("name", "description");
    metaDescription.setAttribute("content", description);
    document.head.appendChild(metaDescription);
    document.title = `${title} | ${defaultTitle}`;

    return () => {
      document.title = previousTitle || defaultTitle;
    };
  }, [description, title]);
}
