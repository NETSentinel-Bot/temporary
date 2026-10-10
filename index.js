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
      .map(([name, value]) => {
        return `${typeof value === "undefined" ? "FAIL" : "OK"} ${name}: ${typeof value}`;
      })
      .join("\n");

    return new Response(report, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  },
};
