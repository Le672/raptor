import React from "react";
import { Link } from "react-router-dom";

/**
 * A link to the home page that works correctly on subdomains.
 * On subdomains (dev.yukino.bond, blog.yukino.bond, etc.), uses a full URL anchor.
 * On www/main domain, uses React Router client-side navigation.
 */
export function HomeLink({ children, className, ...props }: { children: React.ReactNode; className?: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const parts = hostname.split(".");
  const isSubdomain = parts.length >= 3 && parts[0] !== "www";

  if (isSubdomain) {
    return (
      <a href="https://www.yukino.bond/" className={className} {...props}>
        {children}
      </a>
    );
  }

  return (
    <Link to="/" className={className} {...props}>
      {children}
    </Link>
  );
}
