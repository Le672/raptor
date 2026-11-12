import { ipJson, visitorNetwork, type IpContext } from "../../_utils/ip-service";
export function onRequest({ request }: IpContext) {
  if (request.method === "GET") return ipJson(visitorNetwork(request));
  return ipJson({ error: "此接口仅支持 GET。" }, 405);
}
