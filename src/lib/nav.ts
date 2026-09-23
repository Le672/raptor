/**
 * Get the home URL for navigation.
 * On subdomains, returns full URL to www.yukino.bond
 * On www/main domain, returns "/" for client-side navigation
 */
export function getHomeUrl(): string {
  const hostname = window.location.hostname;
  const parts = hostname.split(".");
  // If on a subdomain (e.g., dev.yukino.bond, blog.yukino.bond)
  if (hostname.endsWith(".yukino.bond") && parts[0] !== "www") {
    return `https://www.yukino.bond/`;
  }
  return "/";
}

/**
 * Get the admin URL for navigation.
 */
export function getAdminUrl(): string {
  const hostname = window.location.hostname;
  const parts = hostname.split(".");
  if (hostname.endsWith(".yukino.bond") && parts[0] !== "www") {
    return `https://www.yukino.bond/admin`;
  }
  return "/admin";
}
