import { Config, buildSettingsUrl } from "./src/core.js";

export default {
  async fetch(request, env) {
    try {
      const cfg = Config.fromEnv(env);
      const url = new URL(request.url);
      const settingsUrl = buildSettingsUrl(cfg.workerName);

      return new Response(
        JSON.stringify({
          stage: "fetch-ok",
          pathname: url.pathname,
          workerName: cfg.workerName,
          hasUUID: Boolean(cfg.userID),
          hasProxyAddress: Boolean(cfg.proxyAddress),
          settingsUrl,
        }, null, 2),
        {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        },
      );
    } catch (error) {
      return new Response(
        `FETCH ERROR\n${error?.stack || error?.message || String(error)}`,
        {
          status: 500,
          headers: { "content-type": "text/plain; charset=utf-8" },
        },
      );
    }
  },
};
