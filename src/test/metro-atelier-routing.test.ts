import { describe, expect, it } from "vitest";
import { onRequest } from "../../functions/_middleware";
import { canonicalPageUrl } from "../../speed/src/site-routing.mjs";

const game = "https://games.yukino.bond/metro-atelier/";

describe("Metro Atelier deployment route", () => {
  it("keeps the slash on the directory entry and preserves query and fragment", () => {
    expect(canonicalPageUrl(game)).toBe(game);
    expect(canonicalPageUrl("https://www.yukino.bond/games/metro-atelier?from=games#map")).toBe(game + "?from=games#map");
    expect(canonicalPageUrl(game + "app.js")).toBeNull();
  });

  it("redirects the slashless URL once and serves the directory entry", async () => {
    const next = async () => new Response("Metro Atelier");
    const first = await onRequest({ request: new Request(game.slice(0, -1)), next });
    expect(first.status).toBe(308);
    expect(first.headers.get("Location")).toBe(game);
    expect(await (await onRequest({ request: new Request(game), next })).text()).toBe("Metro Atelier");
  });
});
