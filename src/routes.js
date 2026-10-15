import {
  buildLink,
  safeFetch,
  isInIgnoredRange,
  pick,
  CONST,
  SENS,
  buildMainDomains,
  buildSubscriptionHeaders,
  buildSettingsUrl,
  fetchZizifnProxyPool,
} from "./core.js";
import panelB64 from "./panel.b64";

let cachedPanelHtml = null;
function getPanelHtml() {
  if (!cachedPanelHtml) {
    try {
      if (typeof panelB64 === "string" && panelB64.trim().length > 0) {
        const panelBytes = Uint8Array.from(atob(panelB64.trim()), (c) => c.charCodeAt(0));
        cachedPanelHtml = new TextDecoder("utf-8").decode(panelBytes);
      } else {
        cachedPanelHtml = "<h1>Panel Template Not Found</h1><p>Please build src/panel.b64 before deploying.</p>";
      }
    } catch (e) {
      console.error("Failed to decode panel.b64:", e);
      cachedPanelHtml = `<h1>Panel Decode Error</h1><p>${e.message}</p>`;
    }
  }
  return cachedPanelHtml;
}

export async function handleIpSubscription(request, core, userID, hostName, ctx, enhanced = false) {
  const url = new URL(request.url);
  const subName = url.searchParams.get("name");

  const mainDomains = buildMainDomains(hostName);

  const httpsPorts = [443, 8443, 2053, 2083, 2087, 2096];
  const httpPorts = [80, 8080, 8880, 2052, 2082, 2086, 2095];
  let links = [];
  const isPagesDeployment = hostName.endsWith(".pages.dev");
  const includeTcp = (core === "sb" || (core === "xray" && enhanced)) && !isPagesDeployment;

  mainDomains.forEach((domain, i) => {
    links.push(
      buildLink({
        core,
        proto: "tls",
        userID,
        hostName,
        address: domain,
        port: pick(httpsPorts),
        tag: `Domain${i + 1}`,
        enhanced,
      }),
    );
  });

  try {
    const cache = caches.default;
    const cacheKey = new Request("https://cf-ip-cache.local");
    let response = await cache.match(cacheKey);
    if (!response) {
      const r = await safeFetch(
        "https://raw.githubusercontent.com/NiREvil/vless/refs/heads/main/Cloudflare-IPs.json",
        {},
        4000,
      );
      if (r.ok) {
        response = new Response(await r.text(), {
          headers: { "Cache-Control": "public, max-age=86400" },
        });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }
    }
    if (response) {
      const json = await response.json();
      const ips = [...(json.ipv4 || []), ...(json.ipv6 || [])]
        .map((x) => x.ip)
        .filter((ip) => !isInIgnoredRange(ip))
        .slice(0, 20);
      ips.forEach((ip, i) => {
        const formattedAddress = ip.includes(":") ? `[${ip}]` : ip;
        links.push(
          buildLink({
            core,
            proto: "tls",
            userID,
            hostName,
            address: formattedAddress,
            port: pick(httpsPorts),
            tag: `IP${i + 1}`,
            enhanced,
          }),
        );
        if (includeTcp) {
          links.push(
            buildLink({
              core,
              proto: "tcp",
              userID,
              hostName,
              address: formattedAddress,
              port: pick(httpPorts),
              tag: `IP${i + 1}`,
              enhanced,
            }),
          );
        }
      });
    }
  } catch (e) {
    console.error("Cached IP fetch failed", e);
  }

  const headers = {
    "Content-Type": "text/plain;charset=utf-8",
    ...buildSubscriptionHeaders(subName),
  };
  return new Response(btoa(links.join("\n")), { headers });
}

export async function handleMyConnection(request, env, ctx) {
  const clientIP = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
  const cf = request.cf || {};
  let threatScore = 0;
  let risk = "Low";

  try {
    const harmonicaRes = await safeFetch(
      `https://api-serpents.pages.dev/${clientIP}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
      },
      4000,
    );
    if (harmonicaRes.ok) {
      const data = await harmonicaRes.json();
      if (data) {
        const targetObj = data.info || data;
        threatScore = targetObj.score ?? targetObj.fraud_score ?? targetObj.threatScore ?? 0;
        if (targetObj.risk) risk = targetObj.risk.charAt(0).toUpperCase() + targetObj.risk.slice(1);
      }
    }
  } catch (e) {}

  return new Response(
    JSON.stringify({
      ip: clientIP,
      country: cf.country || "N/A",
      city: cf.city || "",
      isp: cf.asOrganization || "N/A",
      threatScore,
      risk,
    }),
    { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
  );
}

export async function handleResolveDomain(request) {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain");
  if (!domain)
    return new Response(JSON.stringify({ error: "Missing domain" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });

  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(domain)) {
    return new Response(JSON.stringify({ ip: domain }), { headers });
  }

  try {
    const dnsRes = await safeFetch(
      `https://1.1.1.1/dns-query?name=${encodeURIComponent(domain)}&type=A`,
      { headers: { accept: "application/dns-json" } },
      4000,
    );
    const dnsData = await dnsRes.json();
    const ipAnswer = dnsData.Answer?.find((a) => a.type === 1);
    return new Response(JSON.stringify({ ip: ipAnswer ? ipAnswer.data : null }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ ip: null, error: error.toString() }), { headers });
  }
}


const proxyPoolJsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function proxyPoolJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: proxyPoolJsonHeaders,
  });
}

export async function handleProxyIpPool(request, ctx) {
  if (request.method !== "GET") {
    return proxyPoolJson({ error: "Method not allowed" }, 405);
  }

  try {
    const pool = await fetchZizifnProxyPool(ctx);
    const url = new URL(request.url);
    const country = (url.searchParams.get("country") || "").toUpperCase();

    if (country && !/^[A-Z]{2}$/.test(country)) {
      return proxyPoolJson({ error: "Invalid country code" }, 400);
    }

    if (country) {
      const proxies = pool.proxies
        .filter((proxy) => proxy.country === country)
        .map((proxy) => ({
          ip: proxy.ip,
          port: proxy.port,
          isp: proxy.isp || "Unknown",
          city: proxy.city || "",
          score: proxy.score ?? null,
          risk: proxy.risk || "unknown",
        }));

      return proxyPoolJson({
        country,
        count: proxies.length,
        proxies,
      });
    }

    const counts = new Map();

    for (const proxy of pool.proxies) {
      counts.set(proxy.country, (counts.get(proxy.country) || 0) + 1);
    }

    const countries = [...counts.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => a.code.localeCompare(b.code));

    return proxyPoolJson({
      updated_at: pool.updated_at,
      total: pool.proxies.length,
      countries,
    });
  } catch (error) {
    console.error("ProxyIP pool endpoint failed:", error);
    return proxyPoolJson({ error: "ProxyIP dataset unavailable" }, 503);
  }
}

export async function handleProxyIpConfigs(request, userID, hostName, ctx) {
  if (request.method !== "POST") {
    return proxyPoolJson({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await request.json();

    if (!body || !Array.isArray(body.selected) || body.selected.length < 1) {
      return proxyPoolJson({ error: "Select at least one ProxyIP" }, 400);
    }

    if (body.selected.length > 10) {
      return proxyPoolJson({ error: "Select no more than 10 ProxyIPs" }, 400);
    }

    const selected = [...new Set(body.selected)];

    if (selected.length !== body.selected.length) {
      return proxyPoolJson({ error: "Duplicate ProxyIP selection" }, 400);
    }

    if (
      selected.some(
        (value) =>
          typeof value !== "string" ||
          value.length > 100 ||
          !/^[\da-f:.]+:\d{1,5}$/i.test(value),
      )
    ) {
      return proxyPoolJson({ error: "Invalid ProxyIP selection" }, 400);
    }

    const pool = await fetchZizifnProxyPool(ctx);
    const available = new Map(
      pool.proxies.map((proxy) => [
        `${proxy.ip}:${proxy.port}`,
        proxy,
      ]),
    );

    const proxies = selected.map((value) => {
      const proxy = available.get(value);

      if (!proxy) {
        throw new Error("A selected ProxyIP is not in the current dataset");
      }

      return proxy;
    });

    const configs = proxies.map((proxy) => {
      const proxyIP = `${proxy.ip}:${proxy.port}`;

      return {
        proxyIP,
        country: proxy.country,
        isp: proxy.isp || "Unknown",
        config: buildLink({
          core: "xray",
          proto: "tls",
          userID,
          hostName,
          address: hostName,
          port: 443,
          tag: `ProxyIP-${proxy.country}-${proxy.ip}`,
          proxyIP,
        }),
      };
    });

    return proxyPoolJson({ count: configs.length, configs });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return proxyPoolJson({ error: "Invalid JSON body" }, 400);
    }

    if (error.message === "A selected ProxyIP is not in the current dataset") {
      return proxyPoolJson({ error: error.message }, 400);
    }

    console.error("ProxyIP config generation failed:", error);
    return proxyPoolJson({ error: "Unable to generate ProxyIP configs" }, 503);
  }
}

export async function handleConfigPage(userID, hostName, proxyAddress, workerName, nat64 = true) {
  return new Response("A");
}
