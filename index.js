import init from "./pkg/zr_wasm.js";
import wasm from "./pkg/zr_wasm_bg.wasm";

import { Config, buildSettingsUrl } from "./src/core.js";

import {
  handleConfigPage,
  handleIpSubscription,
  handleMyConnection,
  handleResolveDomain,
  handleProxyIpPool,
  handleProxyIpConfigs,
} from "./src/routes.js";

import { handleClashConfig } from "./src/clash.js";
import { ProtocolOverWSHandler } from "./src/network.js";

export default {
  async fetch() {
    const checks = {
      Config,
      buildSettingsUrl,
      handleConfigPage,
      handleIpSubscription,
      handleMyConnection,
      handleResolveDomain,
      handleProxyIpPool,
      handleProxyIpConfigs,
      handleClashConfig,
      ProtocolOverWSHandler,
      wasmInit: init,
      wasmBinary: wasm,
    };

    const report = Object.entries(checks)
      .map(([name, value]) => `${typeof value === "undefined" ? "FAIL" : "OK"} ${name}: ${typeof value}`)
      .join("\n");

    try {
      await init(wasm);

      return new Response(`${report}\n\nOK WASM initialization completed`, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    } catch (error) {
      return new Response(
        `${report}\n\nFAIL WASM initialization\n${error?.stack || error?.message || String(error)}`,
        {
          status: 500,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
          },
        },
      );
    }
  },
};
