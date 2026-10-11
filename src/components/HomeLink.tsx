import React from "react";
import { SiteLink as Link } from "@/components/SiteLink";

/**
 * A link to the home page that works correctly on subdomains.
 * On subdomains (dev.yukino.bond, blog.yukino.bond, etc.), uses a full URL anchor.
 * On www/main domain, uses React Router client-side navigation.
 */
export function HomeLink({
  children,
  className,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <Link to="/" className={className} {...props}>
      {children}
    </Link>
  );
}

