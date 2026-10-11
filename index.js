import { Config } from "./src/core.js";
import { handleConfigPage } from "./src/routes.js";

export default {
  async fetch(request, env) {
    try {
      const cfg = Config.fromEnv(env);
      const url = new URL(request.url);

      if (!url.pathname.startsWith(`/${cfg.userID}`)) {
        return new Response("ROUTING OK", {
          status: 404,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }

      const response = await handleConfigPage(
        cfg.userID,
        url.hostname,
        cfg.proxyAddress,
        cfg.workerName,
      );

      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });
    } catch (error) {
      return new Response(
        `PANEL ERROR\n${error?.stack || error?.message || String(error)}`,
        {
          status: 500,
          headers: { "content-type": "text/plain; charset=utf-8" },
        },
      );
    }
  },
};
