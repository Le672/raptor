import { SERVERS as catalog, SERVER_GROUPS, COUNTRIES } from './servers.mjs';
export type Server = { id: string; name: string; url: string; httpUrl?: string; kind: 'cloudflare' | 'file'; region: string; note: string; desktopOnly?: boolean; group?: string; source?: string; checkedAt?: string; fileBytes?: number; referrer?: string; country?: string; countryName?: string; countryEnglish?: string; provider?: string; city?: string; cityEnglish?: string; rangeSupported?: boolean; cacheBust?: boolean; sourceLabel?: string };
export const SERVERS = catalog as Server[];
export { SERVER_GROUPS, COUNTRIES };
