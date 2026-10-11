// Filters never turn an incompatible source into a browser-compatible one.
export function filterServers(servers, { query = '', group = 'all', country = 'all', client = 'all' } = {}) {
  const terms = String(query).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return servers.filter(server => {
    if (!server.url || (group !== 'all' && server.group !== group) || (country !== 'all' && server.country !== country)) return false;
    if (client === 'web' && (server.desktopOnly || !server.url.startsWith('https:'))) return false;
    if (client === 'windows' && !server.desktopOnly) return false;
    const text = [server.name, server.region, server.provider, server.city, server.cityEnglish, server.country, server.countryName, server.countryEnglish, server.url].join(' ').toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}
