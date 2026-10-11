export const MAIN_ORIGIN: string;
export const SITE_SECTIONS: [path: string, subdomain: string][];
export const PORTAL_HOSTS: string[];
export const SUBDOMAIN_ROUTES: Record<string, string>;
export function isPortalHost(hostname: string): boolean;
export function isMainHost(hostname: string): boolean;
export function isLocalHost(hostname: string): boolean;
export function canonicalPageUrl(input: string): string | null;
export function siteHref(path: string, hostname?: string): string;
