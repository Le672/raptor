import { allowIpQuery, inspectIp, ipJson, readIpBody, type IpContext } from "../../_utils/ip-service";
async function onRequestPost({ request, env }: IpContext) {
  if (!allowIpQuery(request)) { const response = ipJson({ error: "查询过于频繁，请等待一分钟后重试。" }, 429); response.headers.set("Retry-After", "60"); return response; }
  let input: unknown;
  try { input = await readIpBody(request); } catch { return ipJson({ error: "请求格式错误，仅支持一个 IP 地址，JSON 请求不超过 1 KB。" }, 400); }
  try { return ipJson(await inspectIp((input as { ip?: unknown })?.ip, env)); }
  catch (error) { return ipJson({ error: error instanceof Error ? error.message : "查询失败，请稍后重试。" }, 400); }
}
export function onRequest(context: IpContext) {
  if (context.request.method === "POST") return onRequestPost(context);
  return ipJson({ error: "此接口仅支持 POST。" }, 405);
}
