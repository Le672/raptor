import { handleSpeed } from '../../../speed/cloudflare/api.mjs';
export const onRequest = ({ request, env }) => handleSpeed(request, env);
