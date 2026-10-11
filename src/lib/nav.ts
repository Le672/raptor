/**
 * Get the home URL for navigation.
 * On subdomains, returns full URL to www.yukino.bond
 * On www/main domain, returns "/" for client-side navigation
 */
import { siteHref } from './site-routing';
export function getHomeUrl(): string { return siteHref('/'); }

/**
 * Get the admin URL for navigation.
 */
export function getAdminUrl(): string { return siteHref('/admin'); }
