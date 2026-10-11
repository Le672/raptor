import { Link, createPath, useResolvedPath, type LinkProps } from 'react-router-dom';
import { siteHref } from '@/lib/site-routing';

/** Native anchors cross origins; same-site and local routes keep React Router behavior. */
export function SiteLink({ to, children, replace, state, relative, reloadDocument, preventScrollReset, viewTransition, ...props }: LinkProps) {
  const resolved = useResolvedPath(to, { relative });
  const href = siteHref(createPath(resolved));
  if (/^https?:\/\//.test(href)) return <a {...props} href={href}>{children}</a>;
  return <Link {...props} to={href} replace={replace} state={state} reloadDocument={reloadDocument} preventScrollReset={preventScrollReset} viewTransition={viewTransition}>{children}</Link>;
}
