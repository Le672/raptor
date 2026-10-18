// Fixed destinations only. TLS to the existing IP certificate is validated by
// Cloudflare; no user input can select an upstream host, scheme, or port.
const targets = Object.freeze({
  "drop.yukino.bond": { origin: "https://31.56.233.214:9443", prefix: "/drop" },
  "draw.yukino.bond": { origin: "https://31.56.233.214:9444", prefix: "" },
  "tools.yukino.bond": { origin: "https://31.56.233.214:9445", prefix: "" },
});

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = Object.hasOwn(targets, url.hostname) ? targets[url.hostname] : undefined;
    if (!target) return new Response("Unknown Yukino service", { status: 404 });
    if (url.protocol !== "https:") {
      url.protocol = "https:";
      return Response.redirect(url.href, 308);
    }
    if (["CONNECT", "TRACE"].includes(request.method)) return new Response("Method not allowed", { status: 405 });
    const upstreamUrl = new URL(target.origin);
    // Assign pathname/search separately: strings such as //other-host remain paths.
    upstreamUrl.pathname = target.prefix + url.pathname;
    upstreamUrl.search = url.search;
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.set("X-Forwarded-Host", url.hostname);
    headers.set("X-Forwarded-Proto", "https");
    try {
      // Manual redirects prevent forwarding upload credentials or cookies to a
      // different destination. Never retry a POST whose result is uncertain.
      const upstream = await fetch(upstreamUrl.href, {
        method: request.method, headers,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
        redirect: "manual", cache: "no-store", signal: request.signal,
      });
      const response = new Response(upstream.body, upstream);
      const location = response.headers.get("Location");
      if (location) {
        const destination = new URL(location, upstreamUrl);
        if (destination.origin === target.origin) {
          if (target.prefix && (destination.pathname === target.prefix || destination.pathname.startsWith(target.prefix + "/"))) {
            destination.pathname = destination.pathname.slice(target.prefix.length) || "/";
          }
          destination.protocol = "https:";
          destination.hostname = url.hostname;
          destination.port = url.port;
          response.headers.set("Location", destination.href);
        }
      }
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    } catch {
      return new Response("服务暂时连接不上，请稍后重试。若刚提交了内容，请先确认结果再重新上传。", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
  },
};
