import { createPath, resolvePath, useLocation, useNavigate, type NavigateOptions, type To } from 'react-router-dom';
import { siteHref } from '@/lib/site-routing';
export function useSiteNavigate() {
  const navigate = useNavigate(), location = useLocation();
  return (to: To | number, options?: NavigateOptions) => {
    if (typeof to === 'number') return navigate(to);
    const href = siteHref(createPath(resolvePath(to, location.pathname)));
    if (/^https?:\/\//.test(href)) { if (options?.replace) window.location.replace(href); else window.location.assign(href); return; }
    return navigate(href, options);
  };
}
