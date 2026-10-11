import init from "./pkg/zr_wasm.js";
import wasm from "./pkg/zr_wasm_bg.wasm";

export default {
  async fetch() {
    try {
      await init(wasm);
      return new Response("WASM test started\n", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    } catch (error) {
      return new Response(`PRE-INIT ERROR\n${error?.stack || String(error)}`, {
        status: 500,
      });
    }
  },
};
