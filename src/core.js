const decodeSecure = (encoded) => atob(encoded);

export const SENS = {
  vless:   () => decodeSecure("dmxlc3M="),
  ws:      () => decodeSecure("d3M="),
  wsOpts:  () => decodeSecure("d3Mtb3B0czo="),
  edLine:  () => decodeSecure("ZWFybHktZGF0YS1oZWFkZXItbmFtZTog"),
  hiddify: () => decodeSecure("aGlkZGlmZTovL2luc3RhbGwtY29uZmlnP3VybD0="),
  v2rayng: () => decodeSecure("djJyYXluZzovL2luc3RhbGwtY29uZmlnP3VybD0="),
  clash:   () => decodeSecure("Y2xhc2g6Ly9pbnN0YWxsLWNvbmZpZz91cmw9"),
  exclave: () => decodeSecure("c246Ly9zdWJzY3JpcHRpb24/dXJsPQ=="),
};

export const CONST = {
  ED_PARAMS: { ed: 2560, eh: decodeSecure("U2VjLVdlYlNvY2tldC1Qcm90b2NvbA==") },
  AT_SYMBOL: "@",
  VLESS_PROTOCOL: decodeSecure("dmxlc3M="),
  WS_READY_STATE_OPEN: 1,
  WS_READY_STATE_CLOSING: 2,
  CIPHER_SUITES:
    "TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384:TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384:TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256:TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256:TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256:TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256:TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA:TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA:TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256:TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256",
  FINAL_MASK: JSON.stringify({
    tcp: [
      {
        type: "fragment",
        settings: { packets: "tlshello", lengths: ["0", "104", "1"], delays: ["0"], maxSplit: "0" },
      },
      {
        type: "fragment",
        settings: { packets: "1-1", lengths: ["114", "1"], delays: ["1"], maxSplit: "11" },
      },
    ],
  }),
};

export const Config = {
  userID: "be0ff9df-1468-41a0-8865-796d1c6800db",
  proxyIPs: ["di.nscl.ir:443", "tr.diam4.ggff.net:443"],
  fromEnv(env) {
    const pool = env.PROXYIP
      ? [env.PROXYIP, ...this.proxyIPs.filter((ip) => ip !== env.PROXYIP)]
      : this.proxyIPs;
    return {
      userID: env.UUID || this.userID,
      proxyPool: pool,
      proxyAddress: pool[0],
      workerName: env.WORKERNAME || "",
    };
  },
};

export async function safeFetch(url, options = {}, timeout = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}


const ZIZIFN_PROXY_POOL_URL =
  "https://raw.githubusercontent.com/NiREvil/vless/main/sub/ProxyIP-for-zizifn.json";

const ZIZIFN_PROXY_POOL_FRESH_TTL = 900;
const ZIZIFN_PROXY_POOL_STALE_TTL = 86400;

function createProxyPoolCacheKey(type) {
  return new Request(`https://zizifn-proxy-pool.local/${type}`);
}

function isValidProxyPoolIp(ip) {
  if (typeof ip !== "string" || !ip || ip.length > 45) return false;

  const parts = ip.split(".");
  if (parts.length === 4) {
    return parts.every(
      (part) =>
        /^\d{1,3}$/.test(part) &&
        Number(part) >= 0 &&
        Number(part) <= 255,
    );
  }

  if (!ip.includes(":") || !/^[\da-f:.]+$/i.test(ip)) return false;

  try {
    return new URL(`http://[${ip}]/`).hostname.length > 0;
  } catch {
    return false;
  }
}

export function validateZizifnProxyPool(data) {
  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray(data.proxies) ||
    !data.countries ||
    typeof data.countries !== "object" ||
    Array.isArray(data.countries) ||
    !data.providers ||
    typeof data.providers !== "object" ||
    Array.isArray(data.providers)
  ) {
    throw new Error("Invalid ProxyIP dataset structure");
  }

  const proxies = data.proxies.filter(
    (proxy) =>
      proxy &&
      isValidProxyPoolIp(proxy.ip) &&
      Number.isInteger(proxy.port) &&
      proxy.port >= 1 &&
      proxy.port <= 65535 &&
      typeof proxy.country === "string" &&
      /^[A-Z]{2}$/.test(proxy.country),
  );

  if (proxies.length === 0) {
    throw new Error("ProxyIP dataset contains no valid proxies");
  }

  const countries = Object.fromEntries(
    Object.entries(data.countries).filter(
      ([code, ips]) =>
        /^[A-Z]{2}$/.test(code) &&
        Array.isArray(ips) &&
        ips.some(isValidProxyPoolIp),
    ),
  );

  const providers = Object.fromEntries(
    Object.entries(data.providers).filter(
      ([name, ips]) =>
        typeof name === "string" &&
        Array.isArray(ips) &&
        ips.some(isValidProxyPoolIp),
    ),
  );

  return {
    updated_at:
      typeof data.updated_at === "string" ? data.updated_at : null,
    proxies,
    countries,
    providers,
  };
}

export async function fetchZizifnProxyPool(ctx) {
  const cache = caches.default;
  const freshKey = createProxyPoolCacheKey("fresh");
  const staleKey = createProxyPoolCacheKey("stale");

  try {
    const fresh = await cache.match(freshKey);

    if (fresh) {
      return validateZizifnProxyPool(await fresh.json());
    }
  } catch (error) {
    console.error("ProxyIP fresh cache read failed:", error);
  }

  try {
    const response = await safeFetch(
      ZIZIFN_PROXY_POOL_URL,
      {
        headers: {
          Accept: "application/json",
        },
      },
      8000,
    );

    if (!response.ok) {
      throw new Error(`GitHub returned HTTP ${response.status}`);
    }

    const text = await response.text();

    if (!text || text.length < 100) {
      throw new Error("GitHub returned an unexpectedly small dataset");
    }

    const data = validateZizifnProxyPool(JSON.parse(text));

    const freshResponse = new Response(text, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${ZIZIFN_PROXY_POOL_FRESH_TTL}`,
      },
    });

    const staleResponse = new Response(text, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${ZIZIFN_PROXY_POOL_STALE_TTL}`,
      },
    });

    const cacheWrite = Promise.all([
      cache.put(freshKey, freshResponse),
      cache.put(staleKey, staleResponse),
    ]).catch((error) => {
      console.error("ProxyIP cache write failed:", error);
    });

    if (ctx?.waitUntil) {
      ctx.waitUntil(cacheWrite);
    } else {
      await cacheWrite;
    }

    return data;
  } catch (error) {
    console.error("ProxyIP GitHub fetch failed:", error);

    try {
      const stale = await cache.match(staleKey);

      if (stale) {
        console.warn("Using stale ProxyIP dataset");
        return validateZizifnProxyPool(await stale.json());
      }
    } catch (staleError) {
      console.error("ProxyIP stale cache read failed:", staleError);
    }

    throw new Error("ProxyIP dataset unavailable");
  }
}

export function buildSettingsUrl(workerName) {
  return workerName
    ? `https://dash.cloudflare.com/?to=/:account/workers/services/view/${workerName}/production/settings`
    : `https://dash.cloudflare.com/?to=/:account/workers-and-pages`;
}

export function generateRandomPath(length = 28, query = "") {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `/${result}${query ? `?${query}` : ""}`;
}

export const CORE_PRESETS = {
  xray: {
    tls: {
      path: () => generateRandomPath(12, "ed=2048"),
      security: "tls",
      fp: "chrome",
      alpn: "http/1.1",
      extra: {},
    },
    tcp: {
      path: () => generateRandomPath(12, "ed=2048"),
      security: "none",
      fp: "chrome",
      alpn: "http/1.1",
      extra: {},
    },
  },
  sb: {
    tls: {
      path: () => generateRandomPath(18),
      security: "tls",
      fp: "chrome",
      alpn: "http/1.1",
      extra: CONST.ED_PARAMS,
    },
  },
};

export function makeName(tag, proto) {
  return `${tag}-${proto.toUpperCase()}`;
}

export function createVlessLink({
  userID,
  address,
  port,
  host,
  path,
  security,
  sni,
  fp,
  alpn,
  extra = {},
  enhanced = false,
  name,
}) {
  const params = new URLSearchParams({ type: decodeSecure("d3M="), host, path });
  if (security) params.set("security", security);
  if (sni) params.set("sni", sni);
  if (fp) params.set("fp", fp);
  if (alpn) params.set("alpn", alpn);
  if (enhanced) {
    if (security === "tls") params.set("cs", CONST.CIPHER_SUITES);
    params.set("fm", CONST.FINAL_MASK);
  }
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  return `${CONST.VLESS_PROTOCOL}://${userID}@${address}:${port}?${params.toString()}#${encodeURIComponent(name)}`;
}

export function buildLink({ core, proto, userID, hostName, address, port, tag, enhanced = false }) {
  const p = CORE_PRESETS[core][proto];
  return createVlessLink({
    userID,
    address,
    port,
    host: hostName,
    path: p.path(),
    security: p.security,
    sni: p.security === "tls" ? hostName : undefined,
    fp: enhanced && p.security === "tls" ? "unsafe" : p.fp,
    alpn: p.alpn,
    extra: p.extra,
    enhanced,
    name: makeName(tag, proto) + (enhanced ? "-Enhanced" : ""),
  });
}

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function isInIgnoredRange(ip) {
  return ip.startsWith("198.41.208.");
}

export function buildMainDomains(hostName) {
  return [
    hostName,
    "creativecommons.org",
    "sky.rethinkdns.com",
    "www.speedtest.net",
    "singapore.com",
    "go.inmobi.com",
    "www.visa.com",
    "www.wto.org",
    "chatgpt.com",
    "medium.com",
    "lb.nscl.ir",
    "nodejs.org",
    "linkerd.io",
    "harbor.io",
    "npmjs.com",
    "csgo.com",
    "fbi.gov",
    "ip.sb",
    "time.is",
    "icook.hk",
    "codepen.io",
    "unpkg.com",
    "jsdelivr.com",
    "www.cdnjs.com",
    "auth.vercel.com",
    "www.udacity.com",
    "www.gitbook.com",
    "www.ipaddress.my",
    "www.glassdoor.com",
    "www.ipchicken.com",
    "static.cloudflareinsights.com",
  ];
}

export function buildSubscriptionHeaders(subName) {
  const CAKE_INFO = { total_TB: 380, base_GB: 42000, daily_growth_GB: 250 };
  const GB_in_bytes = 1024 * 1024 * 1024;
  const TB_in_bytes = 1024 * GB_in_bytes;
  const total_bytes = CAKE_INFO.total_TB * TB_in_bytes;
  const base_bytes = CAKE_INFO.base_GB * GB_in_bytes;
  const now = new Date();
  const hours_passed = now.getHours() + now.getMinutes() / 60;
  const daily_growth_bytes = (hours_passed / 24) * (CAKE_INFO.daily_growth_GB * GB_in_bytes);
  const cake_download = base_bytes + daily_growth_bytes / 2;
  const cake_upload = base_bytes + daily_growth_bytes / 2;
  const expire_timestamp = Math.floor(Date.now() / 1000) + 2 * 365 * 24 * 60 * 60;
  const subInfo = `upload=${Math.round(cake_upload)}; download=${Math.round(cake_download)}; total=${total_bytes}; expire=${expire_timestamp}`;
  const headers = {
    "Profile-Update-Interval": "8",
    "Subscription-Userinfo": subInfo,
  };
  if (subName) headers["Profile-Title"] = subName;
  return headers;
}
