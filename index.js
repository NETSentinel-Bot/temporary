import { Config, buildLink, buildSettingsUrl, SENS } from "./src/core.js";
import { handleConfigPage } from "./src/routes.js";

export default {
  async fetch(request, env) {
    const stage = (name, data = {}) =>
      new Response(JSON.stringify({ stage: name, ...data }, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });

    try {
      const cfg = Config.fromEnv(env);
      const url = new URL(request.url);

      if (!url.pathname.startsWith(`/${cfg.userID}`)) {
        return stage("config-ok", {
          pathname: url.pathname,
          workerName: cfg.workerName,
        });
      }

      const common = {
        userID: cfg.userID,
        hostName: url.hostname,
        address: url.hostname,
        port: 443,
      };

      const dream = buildLink({
        ...common,
        core: "xray",
        proto: "tls",
        tag: `${url.hostname}-Xray`,
      });

      const freedom = buildLink({
        ...common,
        core: "sb",
        proto: "tls",
        tag: `${url.hostname}-Singbox`,
      });

      const pattng = buildLink({
        ...common,
        core: "xray",
        proto: "tls",
        tag: `${url.hostname}-PTN`,
        enhanced: true,
      });

      const settingsUrl = buildSettingsUrl(cfg.workerName);

      return stage("links-ok", {
        dreamLength: dream.length,
        freedomLength: freedom.length,
        pattngLength: pattng.length,
        settingsUrl,
        hasV2rayng: Boolean(SENS.v2rayng()),
        hasClash: Boolean(SENS.clash()),
        hasHiddify: Boolean(SENS.hiddify()),
        hasExclave: Boolean(SENS.exclave()),
      });
    } catch (error) {
      return stage("caught-error", {
        message: error?.message || String(error),
        stack: error?.stack || null,
      });
    }
  },
};
