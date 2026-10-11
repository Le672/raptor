import { SERVERS as catalog, SERVER_GROUPS } from './servers.mjs';
export type Server = { id: string; name: string; url: string; httpUrl?: string; kind: 'cloudflare' | 'file'; region: string; note: string; desktopOnly?: boolean; group?: string; source?: string; checkedAt?: string; fileBytes?: number; referrer?: string };
export const SERVERS = catalog as Server[];
export { SERVER_GROUPS };
