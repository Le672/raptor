import { handleSpeed } from '../../../cloudflare/api.mjs';
export const onRequest = ({ request, env }) => handleSpeed(request, env);
