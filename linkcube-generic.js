// 国内常开代理：域名优先、明确直连、最后才解析未分类目标的中国 IP。
// 只填域名，不填协议、路径、端口。强制代理优先于同域名的强制直连。
const CUSTOM_DIRECT_DOMAINS = [];
const CUSTOM_PROXY_DOMAINS = [];
// DNS 分流由脚本维护；Merge 只提供启用/监听/Fake-IP 等基础设置。
const LOCAL_DNS = [
  "https://223.5.5.5/dns-query#DIRECT",
  "https://doh.pub/dns-query#DIRECT",
];
const REMOTE_DNS = ["https://1.1.1.1/dns-query", "https://8.8.8.8/dns-query"];
const AI_GEOSITES = ["openai", "google-gemini", "anthropic", "xai"];
const LAN_DOMAINS = ["localhost", "lan", "local", "home.arpa"];
const BT_PROCESSES = [
  "qbittorrent", "qbittorrent.exe", "Transmission", "Transmission.exe",
  "transmission-daemon", "transmission-qt", "transmission-qt.exe",
  "uTorrent", "uTorrent.exe", "BitComet", "BitComet.exe", "BitComet_x64.exe",
];
const TEST_URL = "https://cp.cloudflare.com/generate_204";
const GROUP = {
  Proxies: "🚀 Proxies",
  AI: "🤖 AI",
  Streaming: "🎬 Streaming",
  TikTok: "🎵 TikTok",
  Spotify: "🎧 Spotify",
  YouTube: "📺 YouTube",
  Telegram: "✈️ Telegram",
  Google: "🔎 Google",
  GitHub: "🐙 GitHub",
  Steam: "🎮 Steam",
  Bilibili: "📺 Bilibili",
  Bahamut: "🎞️ Bahamut",
  Microsoft: "🪟 Microsoft",
  Apple: "🍎 Apple",
  PayPal: "💳 PayPal",
  Final: "🔚 Final",
  Auto: "⚡ Auto",
  Fallback: "🔁 Fallback",
  Manual: "🧭 Manual",
  HK: "🇭🇰 HK",
  JP: "🇯🇵 JP",
  SG: "🇸🇬 SG",
  TW: "🇹🇼 TW",
  US: "🇺🇸 US",
};
const COUNTRIES = [
  ["HK", /香港|🇭🇰|(?:^|[^a-z])(?:hkg?|hong[\s-]*kong)(?=$|[^a-z])/i],
  ["JP", /日本|🇯🇵|(?:^|[^a-z])(?:jpn?|japan)(?=$|[^a-z])/i],
  ["SG", /新加坡|狮城|獅城|🇸🇬|(?:^|[^a-z])(?:sgp?|singapore)(?=$|[^a-z])/i],
  ["TW", /台湾|台灣|🇹🇼|(?:^|[^a-z])(?:twn?|taiwan)(?=$|[^a-z])/i],
  ["US", /美国|美國|🇺🇸|(?:^|[^a-z])(?:usa?|united[\s-]+states)(?=$|[^a-z])/i],
];
const BLACKMATRIX7_RULESETS = [
  "PrivateTracker",
  "Global",
  "Abema",
  "DMM",
  "HuluJP",
  "Niconico",
  "TVer",
  "YouTube",
  "Disney",
  "HBO",
  "TikTok",
  "Spotify",
  "Telegram",
  "Google",
  "GitHub",
  "Microsoft",
  "Apple",
  "PayPal",
  "BiliBili",
  "Bahamut",
  "Steam",
  "SteamCN",
];
const JAPAN_RULESETS = [
  "Abema",
  "DMM",
  "HuluJP",
  "Niconico",
  "TVer",
];
const JAPAN_GEOSITES = ["unext", "radiko", "nhk", "dlsite"];
const JAPAN_SITE_DOMAINS = [
  // 日本国内向け動画、电视、广播服务；未被 Geosite 类别完整覆盖的保留。
  "lemino.docomo.ne.jp",
  "fod.fujitv.co.jp",
  "telasa.jp",
  "wowow.co.jp",
  "animestore.docomo.ne.jp",

  // 日本成人内容与数字商店；无对应维护类别的保留。
  "fanza.com",
  "dmmgames.com",
  "duga.jp",
  "mgstage.com",
  "sod.co.jp",
  "sodprime.com",
  "prestige-av.com",
  "s1s1s1.com",
  "moodyz.com",
  "ideapocket.com",
  "madonna-av.com",
  "getchu.com",
  "gyutto.com",
  "digiket.com",
];

function buildRuleProviders() {
  const providers = {};
  for (const name of BLACKMATRIX7_RULESETS) {
    // 这些项目的基础文件并非完整 classical；其余沿用原有维护源。
    const file = ["Apple", "Global"].indexOf(name) >= 0
      ? `${name}_Classical` : name;
    providers[name] = {
      type: "http",
      behavior: "classical",
      format: "yaml",
      url: `https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/${name}/${file}.yaml`,
      path: `./ruleset/blackmatrix7/${file}.yaml`,
      interval: 86400,
      proxy: GROUP.Proxies,
    };
  }
  // 域名名单避免将共享 AWS 区域、CDN 整个后缀归入流媒体。
  for (const [name, category] of [["Netflix", "netflix"], ["AmazonPrimeVideo", "primevideo"]]) {
    providers[name] = {
      type: "http", behavior: "domain", format: "yaml",
      url: `https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/${category}.yaml`,
      path: `./ruleset/metacubex/${category}.yaml`,
      interval: 86400, proxy: GROUP.Proxies,
    };
  }
  // Sukka maintains a dedicated game-content CDN list, including Steam depots.
  providers.GameDownload = {
    type: "http",
    behavior: "domain",
    format: "text",
    url: "https://ruleset.skk.moe/Clash/domainset/game-download.txt",
    path: "./ruleset/sukkaw/GameDownload.txt",
    interval: 43200,
    proxy: GROUP.Proxies,
  };
  // This separate list contains Steam store and community hosts, not game depots.
  providers.SteamWeb = {
    type: "http",
    behavior: "classical",
    format: "yaml",
    url: "https://raw.githubusercontent.com/caserangle/clash-rule/main/steamstore.yaml",
    path: "./ruleset/caserangle/SteamWeb.yaml",
    interval: 86400,
    proxy: GROUP.Proxies,
  };
  return providers;
}

function isRealNode(name) {
  return typeof name === "string" && !!name.trim()
    && !/(?:traffic|expire|expiration|remaining|reset)\s*[:：]|剩[余餘]流量|(?:套餐|订阅|訂閱)?到期(?:时间|時間)?|有效期|距离下次重置|距離下次重置|流量重置|(?:官网|官網|官方网站|官方網站)\s*[:：]/i.test(name);
}

function classify(nodes, pattern) {
  return nodes.filter((name) => pattern.test(name));
}

function group(name, type, proxies, interval, tolerance, testUrl) {
  const data = { name, type, proxies };
  if (type === "url-test" || type === "fallback") {
    data.url = testUrl || TEST_URL;
    data.interval = interval == null ? 600 : interval;
    data.lazy = true;
    if (type === "url-test") data.tolerance = tolerance == null ? 50 : tolerance;
  }
  return data;
}

function existing(byCountry, names) {
  return names.filter((name) => Object.prototype.hasOwnProperty.call(byCountry, name));
}

function domainList(values) {
  return Array.from(new Set(values.map((value) => {
    if (typeof value !== "string") throw new Error("自定义域名必须是字符串");
    const domain = value.trim().toLowerCase();
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(domain)
        || domain.length > 253 || domain.split(".").some((label) => label.length > 63)) {
      throw new Error("自定义域名不能包含协议、路径、端口或规则分隔符；国际化域名请用 punycode");
    }
    return domain;
  })));
}

function customRules() {
  const targets = Object.create(null);
  for (const domain of domainList(CUSTOM_DIRECT_DOMAINS)) targets[domain] = "DIRECT";
  for (const domain of domainList(CUSTOM_PROXY_DOMAINS)) targets[domain] = GROUP.Proxies;
  // 与 DNS 后缀匹配一致：更具体的域名优先；相同域名代理优先。
  return Object.keys(targets).sort((a, b) => b.length - a.length || a.localeCompare(b))
    .map((domain) => `DOMAIN-SUFFIX,${domain},${targets[domain]}`);
}

function ruleSet(name, target) {
  // Classical 内可能混有 IP/ASN；防止它们提前触发 DNS，已有 IP 仍可匹配。
  return `RULE-SET,${name},${target},no-resolve`;
}

function buildRules(japanTarget) {
  const localIPs = [
    "127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
    "100.64.0.0/10", "169.254.0.0/16", "224.0.0.0/4", "255.255.255.255/32",
  ];
  const rules = localIPs.map((ip) => `IP-CIDR,${ip},DIRECT,no-resolve`).concat(
    ["::1/128", "fc00::/7", "fe80::/10", "ff00::/8"].map((ip) => `IP-CIDR6,${ip},DIRECT,no-resolve`),
    LAN_DOMAINS.map((domain) => `DOMAIN-SUFFIX,${domain},DIRECT`),
    ["GEOSITE,private,DIRECT"],
    customRules(),
    JAPAN_RULESETS.map((name) => ruleSet(name, japanTarget)),
    JAPAN_GEOSITES.map((name) => `GEOSITE,${name},${japanTarget}`),
    JAPAN_SITE_DOMAINS.map((domain) => `DOMAIN-SUFFIX,${domain},${japanTarget}`)
  );
  return rules.concat([
    // Steam Web 中有 steamusercontent 的精确例外，应先于 SteamCN 的大后缀。
    ruleSet("SteamWeb", GROUP.Steam),
    `DOMAIN-KEYWORD,steamcloud,${GROUP.Steam}`,
    `DOMAIN,steamstore-a.akamaihd.net,${GROUP.Steam}`,
    `DOMAIN,steamcommunity-a.akamaihd.net,${GROUP.Steam}`,
    `DOMAIN-SUFFIX,steam-chat.com,${GROUP.Steam}`,
    ruleSet("SteamCN", "DIRECT"),
    ruleSet("GameDownload", "DIRECT"),
    // AI 仅使用四个平台的完整 MetaCubeX geosite 分类。
  ], AI_GEOSITES.map((name) => `GEOSITE,${name},${GROUP.AI}`), [
    // 地区国内服务/游戏 CDN 优先，不跟随整个平台的代理选择。
    "GEOSITE,microsoft@cn,DIRECT",
    "GEOSITE,apple-cn,DIRECT",
    "GEOSITE,category-games@cn,DIRECT",
    ruleSet("YouTube", GROUP.YouTube),
    ruleSet("AmazonPrimeVideo", GROUP.Streaming),
    ruleSet("Netflix", GROUP.Streaming),
    ruleSet("Disney", GROUP.Streaming),
    ruleSet("HBO", GROUP.Streaming),
    ruleSet("TikTok", GROUP.TikTok),
    ruleSet("Spotify", GROUP.Spotify),
    ruleSet("Telegram", GROUP.Telegram),
    ruleSet("Google", GROUP.Google),
    ruleSet("GitHub", GROUP.GitHub),
    ruleSet("BiliBili", GROUP.Bilibili),
    ruleSet("Bahamut", GROUP.Bahamut),
    ruleSet("Microsoft", GROUP.Microsoft),
    ruleSet("Apple", GROUP.Apple),
    ruleSet("PayPal", GROUP.PayPal),
    ruleSet("PrivateTracker", "DIRECT"),
    // 只把已知游戏下载域名直连，不把整个 Steam/aria2/FDM 进程强制直连。
    ruleSet("Steam", GROUP.Steam),
    "GEOSITE,cn,DIRECT",
  ], BT_PROCESSES.map((name) => `PROCESS-NAME,${name},DIRECT`), [
    ruleSet("Global", GROUP.Proxies),
    // 未分类域名此时才解析：先接住解析到内网的 NAS/自建域名，再判断中国 IP。
    // lan 是 Mihomo 内置判断，不依赖 GeoIP 数据库是否包含 private 分类。
    "GEOIP,lan,DIRECT",
    "IP-CIDR,100.64.0.0/10,DIRECT,no-resolve",
    "GEOIP,CN,DIRECT",
    `MATCH,${GROUP.Final}`,
  ]);
}

function configureDns(config) {
  const dns = config.dns;
  if (!dns || typeof dns !== "object" || Array.isArray(dns) || dns.enable === false) return;
  const local = LOCAL_DNS.slice();
  const remote = REMOTE_DNS.map((url) => `${url}#${GROUP.Proxies}`);
  // 清除会引用已被重建的规则集的旧 selector；保留具体域名/公司内网 DNS 映射。
  const policy = {};
  const previous = dns["nameserver-policy"] || {};
  for (const key of Object.keys(previous)) {
    if (!/^(geosite|rule-set):/i.test(key)) policy[key] = previous[key];
  }
  for (const domain of LAN_DOMAINS) policy[`+.${domain}`] = ["system"];
  for (const domain of domainList(CUSTOM_DIRECT_DOMAINS)) policy[`+.${domain}`] = local;
  for (const domain of domainList(CUSTOM_PROXY_DOMAINS)) policy[`+.${domain}`] = remote;
  // Mihomo 按策略段首次命中；具体域名与自定义例外必须排在分类之前。
  policy["geosite:private"] = ["system"];
  for (const name of AI_GEOSITES) policy[`geosite:${name}`] = remote;
  policy["geosite:cn"] = local;
  policy["geosite:gfw"] = remote;
  policy["rule-set:SteamCN,GameDownload"] = local;
  Object.assign(dns, {
    "respect-rules": false,
    "prefer-h3": false,
    "default-nameserver": ["223.5.5.5", "119.29.29.29"],
    "nameserver": local,
    "proxy-server-nameserver": local,
    "direct-nameserver": local,
    // 保留 LAN / 公司私有域名的 system 或指定内网 DNS，不能一律交给公共 DNS。
    "direct-nameserver-follow-policy": true,
    "nameserver-policy": policy,
    "fallback": remote,
    "fallback-lazy-query": true,
    "fallback-filter": {
      geoip: true, "geoip-code": "CN",
      ipcidr: ["240.0.0.0/4", "0.0.0.0/32", "127.0.0.0/8"],
    },
  });
  if ((dns["enhanced-mode"] || "").toLowerCase() === "fake-ip"
      && (dns["fake-ip-filter-mode"] || "blacklist").toLowerCase() === "blacklist") {
    const current = Array.isArray(dns["fake-ip-filter"]) ? dns["fake-ip-filter"] : [];
    dns["fake-ip-filter"] = Array.from(new Set(current.concat(
      LAN_DOMAINS.map((domain) => `+.${domain}`),
      ["+.weixin.qq.com", "+.wechat.com", "+.weixin.com", "+.wx.qq.com",
       "+.qpic.cn", "+.qlogo.cn", "+.gtimg.com", "+.ntp.org", "time.windows.com"]
    )));
  }
}

function retainDnsDependencies(config, dns, groups, providers) {
  // 内核在 DNS 关闭时也会解析这些引用，依赖检查不能随开关跳过。
  if (!dns || typeof dns !== "object" || Array.isArray(dns)) return;
  const oldGroups = new Set((config["proxy-groups"] || []).map((entry) => entry.name));
  const targets = new Set(groups.map((entry) => entry.name).concat(config.proxies.map((entry) => entry.name)));
  function checkExit(name) {
    if (oldGroups.has(name) && !targets.has(name) && name !== "DIRECT" && name !== "REJECT") {
      throw new Error(`DNS 出口 ${name} 引用将被删除的旧策略组，请先迁移该出口`);
    }
  }
  const needed = new Set();
  for (const field of ["nameserver-policy", "proxy-server-nameserver-policy"]) {
    const policy = dns[field] || {};
    for (const key of Object.keys(policy)) {
      if ((field === "proxy-server-nameserver-policy" || dns.enable === false) && /^rule-set:/i.test(key)) {
        for (const name of key.slice(9).split(",")) needed.add(name);
      }
      const servers = Array.isArray(policy[key]) ? policy[key] : [policy[key]];
      for (const server of servers) {
        if (typeof server !== "string") continue;
        const fragment = server.split("#")[1] || "";
        for (const part of fragment.split("&")) {
          if (part && part.indexOf("=") < 0) checkExit(decodeURIComponent(part));
        }
      }
    }
  }
  if ((dns["enhanced-mode"] || "").toLowerCase() === "fake-ip") {
    for (const rule of dns["fake-ip-filter"] || []) {
      if ((dns["fake-ip-filter-mode"] || "blacklist").toLowerCase() === "rule") {
        const parts = rule.split(",").map((part) => part.trim());
        if (parts[0].toUpperCase() === "RULE-SET") needed.add(parts[1]);
      } else if (/^rule-set:/i.test(rule)) {
        for (const name of rule.slice(9).split(",")) needed.add(name);
      }
    }
  }
  const previous = config["rule-providers"] || {};
  for (const name of needed) {
    if (Object.prototype.hasOwnProperty.call(providers, name)) {
      if (Object.prototype.hasOwnProperty.call(previous, name)
          && (Object.keys(previous[name]).length !== Object.keys(providers[name]).length
            || Object.keys(providers[name]).some((key) => JSON.stringify(previous[name][key]) !== JSON.stringify(providers[name][key])))) {
        throw new Error(`DNS 规则集 ${name} 与内置规则集重名，请先重命名自定义规则集`);
      }
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(previous, name)) {
      throw new Error(`DNS 引用缺失的规则集 ${name}，请先补齐该规则集`);
    }
    if (previous[name].proxy) checkExit(previous[name].proxy);
    providers[name] = previous[name];
  }
}

function main(config) {
  // 空输入、provider-only 和混合订阅不重建，避免丢掉 provider 中的节点。
  if (!config || typeof config !== "object" || !Array.isArray(config.proxies)) return config;
  if (config["proxy-providers"] && Object.keys(config["proxy-providers"]).length) return config;
  const allNames = new Set();
  const reserved = new Set(Object.keys(GROUP).map((key) => GROUP[key]).concat(["DIRECT", "REJECT"]));
  for (const proxy of config.proxies) {
    if (!proxy || typeof proxy.name !== "string" || !proxy.name.trim()) {
      throw new Error("订阅含无效节点名称，请先修复订阅");
    }
    if (allNames.has(proxy.name)) throw new Error("订阅含重名节点，请先修复订阅");
    if (reserved.has(proxy.name)) throw new Error("节点名称与内置策略组冲突，请先重命名节点");
    allNames.add(proxy.name);
  }
  for (const proxy of config.proxies) {
    const parent = proxy["dialer-proxy"];
    if (parent && parent !== "DIRECT" && !allNames.has(parent)) {
      throw new Error("链式节点 dialer-proxy 依赖原订阅策略组，不能安全重建；请保留原配置");
    }
  }
  const nodes = config.proxies.map((proxy) => proxy.name).filter(isRealNode);
  if (!nodes.length) return config;
  // 在修改配置前校验手工规则，避免错误文本生成半成品配置。
  domainList(CUSTOM_DIRECT_DOMAINS);
  domainList(CUSTOM_PROXY_DOMAINS);

  const byCountryNodes = {};
  const byCountryGroups = {};
  const countryGroups = [];
  for (const [code, pattern] of COUNTRIES) {
    const matched = classify(nodes, pattern);
    if (matched.length) {
      byCountryNodes[code] = matched;
      byCountryGroups[code] = GROUP[code];
      countryGroups.push(group(GROUP[code], "url-test", matched));
    }
  }

  const commonRegions = existing(byCountryNodes, ["HK", "JP", "SG", "US", "TW"]);
  let autoNodes = [];
  for (const code of commonRegions) autoNodes = autoNodes.concat(byCountryNodes[code]);
  if (!autoNodes.length) autoNodes = nodes;
  autoNodes = Array.from(new Set(autoNodes));

  // AI 默认美国，提供所有已生成地区、总代理和手选；无美国节点时默认拒绝。
  const aiChoices = [byCountryGroups.US || "REJECT"].concat(
    existing(byCountryGroups, ["HK", "JP", "SG", "TW"]).map((code) => byCountryGroups[code]),
    [GROUP.Proxies, GROUP.Manual]
  );
  const aiGroup = group(GROUP.AI, "select", aiChoices);

  const countryChoices = ["HK", "JP", "SG", "US", "TW"].filter((code) => Object.prototype.hasOwnProperty.call(byCountryGroups, code)).map((code) => byCountryGroups[code]);
  const usDefaultChoices = [byCountryGroups.US || "REJECT"]
    .concat(countryChoices.filter((name) => name !== GROUP.US), [GROUP.Proxies, GROUP.Manual]);
  const proxyChoices = [GROUP.Auto, GROUP.Fallback].concat(countryChoices, [GROUP.Manual, "DIRECT"]);
  const groups = [
    group(GROUP.Proxies, "select", proxyChoices),
    aiGroup,
    group(GROUP.TikTok, "select", usDefaultChoices.slice()),
    group(GROUP.Spotify, "select", usDefaultChoices.slice()),
    group(GROUP.Streaming, "select", existing(byCountryGroups, ["SG", "US", "HK", "JP", "TW"]).map((code) => byCountryGroups[code]).concat([GROUP.Proxies, GROUP.Manual])),
    group(GROUP.YouTube, "select", [GROUP.Proxies].concat(existing(byCountryGroups, ["HK", "SG", "JP", "US", "TW"]).map((code) => byCountryGroups[code]), [GROUP.Manual])),
    group(GROUP.Telegram, "select", [GROUP.Proxies].concat(existing(byCountryGroups, ["HK", "SG", "JP", "US"]).map((code) => byCountryGroups[code]), [GROUP.Manual])),
    group(GROUP.Google, "select", [GROUP.Proxies].concat(existing(byCountryGroups, ["HK", "SG", "JP", "US", "TW"]).map((code) => byCountryGroups[code]), [GROUP.Manual])),
    group(GROUP.GitHub, "select", [GROUP.Proxies].concat(existing(byCountryGroups, ["HK", "JP", "SG", "US"]).map((code) => byCountryGroups[code]), [GROUP.Manual, "DIRECT"])),
    group(GROUP.Steam, "select", [GROUP.Proxies, "DIRECT"].concat(existing(byCountryGroups, ["HK", "JP", "US", "SG"]).map((code) => byCountryGroups[code]), [GROUP.Manual])),
    group(GROUP.Bilibili, "select", ["DIRECT"].concat(existing(byCountryGroups, ["TW", "HK"]).map((code) => byCountryGroups[code]), [GROUP.Proxies])),
    group(GROUP.Bahamut, "select", existing(byCountryGroups, ["TW", "HK", "JP"]).map((code) => byCountryGroups[code]).concat([GROUP.Proxies, GROUP.Manual])),
    group(GROUP.Microsoft, "select", ["DIRECT", GROUP.Proxies].concat(existing(byCountryGroups, ["HK", "JP", "SG", "US"]).map((code) => byCountryGroups[code]))),
    group(GROUP.Apple, "select", ["DIRECT", GROUP.Proxies].concat(existing(byCountryGroups, ["HK", "JP", "SG", "US"]).map((code) => byCountryGroups[code]))),
    group(GROUP.PayPal, "select", ["DIRECT", GROUP.Proxies].concat(existing(byCountryGroups, ["HK", "US", "SG"]).map((code) => byCountryGroups[code]))),
    group(GROUP.Final, "select", [GROUP.Proxies, "DIRECT", GROUP.Manual]),
    group(GROUP.Auto, "url-test", autoNodes, 300, 80),
    group(GROUP.Fallback, "fallback", autoNodes, 300),
    group(GROUP.Manual, "select", nodes),
  ].concat(countryGroups);

  const providers = buildRuleProviders();
  const dnsConfig = { dns: config.dns && typeof config.dns === "object" && !Array.isArray(config.dns)
    ? Object.assign({}, config.dns) : config.dns };
  configureDns(dnsConfig);
  // 先检查保留字段的依赖，错误输入不能留下已修改一半的配置。
  retainDnsDependencies(config, dnsConfig.dns, groups, providers);
  config["proxy-groups"] = groups;
  config["rule-providers"] = providers;
  // 缺少日本节点时改走总代理，避免引用不存在的地区组。
  config.rules = buildRules(byCountryGroups.JP || GROUP.Proxies);
  if (config.dns) config.dns = dnsConfig.dns;
  return config;
}
