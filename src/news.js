import { createHash } from "node:crypto";
import GoogleNewsDecoder from "google-news-decoder";

const DEFAULT_USER_AGENT =
  "ai-news-top10-mcp/0.1.0 (+https://modelcontextprotocol.io)";

const googleNewsDecoder = new GoogleNewsDecoder();

const GOOGLE_NEWS_CONFIG = {
  zh: {
    hl: "zh-CN",
    gl: "CN",
    ceid: "CN:zh-Hans",
    queries: [
      "AI 人工智能 when:1d",
      "OpenAI ChatGPT when:1d",
      "大模型 LLM when:1d",
      "Claude Anthropic when:1d",
      "Gemini Google AI when:1d",
      "NVIDIA AI when:1d"
    ]
  },
  en: {
    hl: "en-US",
    gl: "US",
    ceid: "US:en",
    queries: [
      "artificial intelligence when:1d",
      "OpenAI OR ChatGPT when:1d",
      "large language model OR LLM when:1d",
      "Anthropic OR Claude when:1d",
      "Google Gemini AI when:1d",
      "NVIDIA AI when:1d"
    ]
  }
};

const DIRECT_FEEDS = [
  {
    name: "OpenAI Blog",
    url: "https://openai.com/news/rss.xml",
    weight: 18
  },
  {
    name: "Google AI Blog",
    url: "https://blog.google/technology/ai/rss/",
    weight: 16
  },
  {
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    weight: 12
  },
  {
    name: "VentureBeat AI",
    url: "https://venturebeat.com/category/ai/feed/",
    weight: 12
  },
  {
    name: "MIT Technology Review AI",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/",
    weight: 12
  },
  {
    name: "The Verge AI",
    url: "https://www.theverge.com/rss/index.xml",
    weight: 12
  },
  {
    name: "Planet AI",
    url: "https://planet-ai.net/rss.xml",
    weight: 10
  }
];

const SOURCE_QUALITY_RULES = [
  {
    tier: "official",
    score: 34,
    hosts: [
      "openai.com",
      "anthropic.com",
      "deepmind.google",
      "blog.google",
      "ai.googleblog.com",
      "microsoft.com",
      "blogs.microsoft.com",
      "nvidia.com",
      "developer.nvidia.com",
      "ai.meta.com"
    ]
  },
  {
    tier: "tier1-tech-media",
    score: 22,
    hosts: [
      "technologyreview.com",
      "techcrunch.com",
      "venturebeat.com",
      "theverge.com",
      "wired.com",
      "arstechnica.com",
      "semianalysis.com",
      "securityweek.com"
    ]
  },
  {
    tier: "ai-vertical-media",
    score: 18,
    hosts: ["jiqizhixin.com", "qbitai.com", "syncedreview.com", "marktechpost.com"]
  },
  {
    tier: "mainstream-cn-tech",
    score: 10,
    hosts: ["36kr.com", "thepaper.cn", "cnbeta.com.tw", "finance.sina.cn", "news.futunn.com"]
  },
  {
    tier: "aggregator",
    score: -8,
    hosts: ["msn.com", "planet-ai.net"]
  },
  {
    tier: "low-quality",
    score: -24,
    hosts: [
      "aithority.com",
      "digitbin.com",
      "digitaltoday.co.kr",
      "foro3d.com",
      "futureparty.com",
      "ghacks.net",
      "kucoin.com",
      "letsdatascience.com",
      "mk.co.kr",
      "techobserver.in"
    ]
  }
];

const EXCLUDED_HOSTS = [
  "blog.csdn.net",
  "sohu.com",
  "m.sohu.com",
  "baijiahao.baidu.com",
  "mbd.baidu.com",
  "toutiao.com",
  "aithority.com",
  "digitbin.com",
  "futureparty.com",
  "kucoin.com",
  "letsdatascience.com",
  "msn.com"
];

const EXCLUDED_TITLE_PATTERNS = [
  /哥布林/u,
  /赛博魅魔/u,
  /震惊/u,
  /突发/u,
  /翻车了/u,
  /偷偷蒸馏/u,
  /广告平台/u,
  /goblin/i,
  /goblins/i
];

const STALE_CONTENT_PATTERNS = [
  /(\d+)\s*个月前/u,
  /(\d+)\s*月前/u,
  /(\d+)\s*weeks?\s+ago/i,
  /(\d+)\s+months?\s+ago/i,
  /last\s+month/i,
  /two\s+months?\s+ago/i,
  /three\s+months?\s+ago/i,
  /\b(?:Jan|January|Feb|February|Mar|March|Apr|April)\s+\d{1,2}\b/i
];

const TITLE_SUFFIX_PATTERNS = [
  /\s*[_｜|]\s*手机新浪网.*$/u,
  /\s*[-—]\s*新浪财经\s*$/u,
  /\s*[-—]\s*手机新浪网\s*$/u,
  /\s*[-—]\s*Sohu\s*$/iu,
  /\s*[-—]\s*blog\.csdn\.net\s*$/iu,
  /\s*[-—]\s*MSN\s*$/iu
];

const KEYWORD_WEIGHTS = [
  ["openai", 10],
  ["chatgpt", 8],
  ["gpt", 6],
  ["anthropic", 10],
  ["claude", 8],
  ["gemini", 8],
  ["deepmind", 8],
  ["nvidia", 8],
  ["agent", 7],
  ["agents", 7],
  ["llm", 7],
  ["大模型", 8],
  ["智能体", 7],
  ["开源", 5],
  ["芯片", 5],
  ["监管", 4],
  ["安全", 4],
  ["融资", 4],
  ["发布", 4],
  ["benchmark", 4],
  ["reasoning", 4],
  ["推理", 4]
];

function googleNewsUrl(query, config) {
  const params = new URLSearchParams({
    q: query,
    hl: config.hl,
    gl: config.gl,
    ceid: config.ceid
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

function buildFeedList(language = "mixed", options = {}) {
  const { includeGoogleNews = true } = options;
  const languages = language === "zh" ? ["zh"] : language === "en" ? ["en"] : ["zh", "en"];
  const googleFeeds = includeGoogleNews ? languages.flatMap((itemLanguage) => {
    const config = GOOGLE_NEWS_CONFIG[itemLanguage];
    return config.queries.map((query) => ({
      name: `Google News ${itemLanguage}: ${query.replace(" when:1d", "")}`,
      url: googleNewsUrl(query, config),
      weight: itemLanguage === "en" ? 11 : 10
    }));
  }) : [];

  return [...googleFeeds, ...DIRECT_FEEDS];
}

function decodeXml(value = "") {
  return value
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function stripHtml(value = "") {
  return decodeXml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getFirstTag(block, tagNames) {
  for (const tag of tagNames) {
    const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    if (match) return decodeXml(match[1]).trim();
  }
  return "";
}

function extractHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function hostMatches(host, candidate) {
  return host === candidate || host.endsWith(`.${candidate}`);
}

function isExcludedHost(host = "") {
  return EXCLUDED_HOSTS.some((blockedHost) => hostMatches(host, blockedHost));
}

function getSourceQuality(host = "") {
  for (const rule of SOURCE_QUALITY_RULES) {
    if (rule.hosts.some((candidate) => hostMatches(host, candidate))) {
      return {
        sourceTier: rule.tier,
        qualityScore: rule.score
      };
    }
  }

  return {
    sourceTier: "unknown",
    qualityScore: -6
  };
}

function cleanNewsTitle(title = "") {
  return TITLE_SUFFIX_PATTERNS.reduce((current, pattern) => current.replace(pattern, ""), title)
    .replace(/\s+/g, " ")
    .trim();
}

function isExcludedTitle(title = "") {
  return EXCLUDED_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

function hasStaleContentSignals(item) {
  const text = `${item.title} ${item.summary}`;
  return STALE_CONTENT_PATTERNS.some((pattern) => {
    const match = text.match(pattern);
    if (!match) return false;
    const value = Number.parseInt(match[1] || "2", 10);
    return Number.isNaN(value) || value >= 1;
  });
}

function getSourceFromRssItem(block) {
  const match = block.match(/<source\b([^>]*)>([\s\S]*?)<\/source>/i);
  if (!match) {
    return { name: "", url: "" };
  }

  const url = match[1].match(/\burl=["']([^"']+)["']/i)?.[1] || "";
  return {
    name: stripHtml(match[2]),
    url: decodeXml(url)
  };
}

function normalizeTitle(title) {
  return cleanNewsTitle(stripHtml(title))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalArticleKey(item) {
  const url = item.link || item.rssLink || item.sourceUrl || "";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const pathname = decodeURIComponent(parsed.pathname)
      .replace(/\/amp\/?$/i, "")
      .replace(/\/index\.html?$/i, "")
      .replace(/\/+$/g, "")
      .toLowerCase();
    return `${host}${pathname || "/"}`;
  } catch {
    return "";
  }
}

function parseFeed(xml, feed) {
  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const entryBlocks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  const blocks = itemBlocks.length > 0 ? itemBlocks : entryBlocks;

  return blocks.map((block) => {
    const rssSource = getSourceFromRssItem(block);
    const rawLink = getFirstTag(block, ["link"]);
    const atomHref = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] || "";
    const rssLink = decodeXml(rawLink || atomHref);
    const sourceUrl = decodeXml(rssSource.url || "");
    const link = rssLink || sourceUrl;
    const title = cleanNewsTitle(stripHtml(getFirstTag(block, ["title"])));
    const summary = stripHtml(getFirstTag(block, ["description", "summary", "content"]));
    const publishedRaw = getFirstTag(block, ["pubDate", "published", "updated", "dc:date"]);
    const publishedAt = publishedRaw ? new Date(publishedRaw) : null;

    return {
      title,
      link,
      rssLink,
      sourceUrl,
      summary,
      publishedAt: publishedAt && !Number.isNaN(publishedAt.valueOf()) ? publishedAt : null,
      rssPublishedAt: publishedAt && !Number.isNaN(publishedAt.valueOf()) ? publishedAt : null,
      source: rssSource.name || feed.name,
      sourceHost: extractHostname(sourceUrl || link),
      sourceWeight: feed.weight || 0,
      duplicateCount: 1
    };
  }).filter((item) => item.title && item.link);
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": DEFAULT_USER_AGENT,
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml"
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchArticleHtml(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": DEFAULT_USER_AGENT,
        accept: "text/html,application/xhtml+xml"
      },
      redirect: "follow"
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }
    return {
      finalUrl: response.url,
      html: await response.text()
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function isWithinWindow(item, now, hoursBack) {
  if (!item.publishedAt) return true;
  const ageHours = (now.getTime() - item.publishedAt.getTime()) / 36e5;
  return ageHours >= -0.5 && ageHours <= hoursBack;
}

function parseDateValue(value, now = new Date()) {
  if (!value) return null;
  const normalized = decodeXml(String(value)).trim();
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.valueOf())) return parsed;

  const cnDate = normalized.match(
    /(20\d{2})\s*[年/-]\s*(\d{1,2})\s*[月/-]\s*(\d{1,2})\s*(?:日)?\s+(\d{1,2})[:：](\d{2})(?::(\d{2}))?/u
  );
  if (cnDate) {
    return new Date(
      Number(cnDate[1]),
      Number(cnDate[2]) - 1,
      Number(cnDate[3]),
      Number(cnDate[4]),
      Number(cnDate[5]),
      Number(cnDate[6] || 0)
    );
  }

  const shortDate = normalized.match(/\b(\d{1,2})[./-](\d{1,2})\s+(\d{1,2})[:：](\d{2})\b/u);
  if (shortDate) {
    return new Date(
      now.getFullYear(),
      Number(shortDate[1]) - 1,
      Number(shortDate[2]),
      Number(shortDate[3]),
      Number(shortDate[4])
    );
  }

  return null;
}

function extractAttr(tag = "", name) {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function extractArticlePublishedAt(html, now = new Date()) {
  const metaMatches = [...html.matchAll(/<meta\b[^>]*>/gi)];
  const dateMetaNames = [
    "article:published_time",
    "og:published_time",
    "datePublished",
    "datepublished",
    "pubdate",
    "publishdate",
    "publish_date",
    "sailthru.date",
    "parsely-pub-date",
    "dc.date",
    "dc.date.issued"
  ];

  for (const match of metaMatches) {
    const tag = match[0];
    const key = (extractAttr(tag, "property") || extractAttr(tag, "name") || extractAttr(tag, "itemprop"))
      .toLowerCase()
      .trim();
    if (!dateMetaNames.includes(key)) continue;
    const date = parseDateValue(extractAttr(tag, "content"), now);
    if (date) return date;
  }

  const jsonDate = html.match(/"datePublished"\s*:\s*"([^"]+)"/i)
    || html.match(/"dateCreated"\s*:\s*"([^"]+)"/i);
  if (jsonDate) {
    const date = parseDateValue(jsonDate[1], now);
    if (date) return date;
  }

  const visibleDate = stripHtml(html).match(
    /(?:发布时间|发表时间|发布于|市场资讯)?\s*(20\d{2}\s*[年/-]\s*\d{1,2}\s*[月/-]\s*\d{1,2}\s*(?:日)?\s+\d{1,2}[:：]\d{2}(?::\d{2})?|\d{1,2}[./-]\d{1,2}\s+\d{1,2}[:：]\d{2})/u
  );
  if (visibleDate) {
    return parseDateValue(visibleDate[1], now);
  }

  return null;
}

async function mapWithConcurrency(items, limit, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await callback(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
  return results;
}

async function enrichArticleDates(items, options = {}) {
  const { now = new Date(), timeoutMs = 6000, decoderTimeoutMs = 5000, concurrency = 4 } = options;
  return mapWithConcurrency(items, concurrency, async (item) => {
    if (!item.link) return item;

    const resolvedLink = await resolveGoogleNewsLink(item.link, decoderTimeoutMs);
    const resolvedHost = extractHostname(resolvedLink);
    const linkResolvedItem = resolvedLink !== item.link
      ? {
          ...item,
          link: resolvedLink,
          sourceHost: resolvedHost || item.sourceHost
        }
      : item;

    const article = await fetchArticleHtml(linkResolvedItem.link, timeoutMs);
    if (!article?.html) return linkResolvedItem;

    const finalHost = extractHostname(article.finalUrl || linkResolvedItem.link);
    const isGoogleLanding = finalHost === "news.google.com";
    if (isGoogleLanding) return linkResolvedItem;

    const articlePublishedAt = extractArticlePublishedAt(article.html, now);
    if (!articlePublishedAt) return linkResolvedItem;

    return {
      ...linkResolvedItem,
      link: article.finalUrl || linkResolvedItem.link,
      sourceHost: finalHost || linkResolvedItem.sourceHost,
      articlePublishedAt,
      publishedAt: articlePublishedAt,
      dateSource: "article"
    };
  });
}

function isGoogleNewsLink(url = "") {
  return /^https:\/\/news\.google\.com\/(?:rss\/)?articles\//i.test(url)
    || /^https:\/\/news\.google\.com\/read\//i.test(url);
}

async function resolveGoogleNewsLink(url, timeoutMs = 5000) {
  if (!isGoogleNewsLink(url)) return url;

  try {
    const result = await withTimeout(
      googleNewsDecoder.decodeGoogleNewsUrl(url),
      timeoutMs,
      { status: false }
    );
    return result?.status && result.decodedUrl ? result.decodedUrl : url;
  } catch {
    return url;
  }
}

function withTimeout(promise, timeoutMs, fallbackValue) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallbackValue), timeoutMs))
  ]);
}

function isLikelyEnglishTitle(title = "") {
  const latinCount = (title.match(/[A-Za-z]/g) || []).length;
  const cjkCount = (title.match(/[\u3400-\u9fff]/g) || []).length;
  return latinCount >= 18 && cjkCount <= 2;
}

async function translateTextToZh(text, timeoutMs) {
  return translateTextToZhWithProviders(text, timeoutMs, ["baidu", "google", "mymemory"]);
}

async function translateTextToZhWithProviders(text, timeoutMs, providers = ["baidu", "google", "mymemory"]) {
  for (const provider of providers) {
    const translatedText = await translateTextWithProvider(text, timeoutMs, provider);
    if (translatedText && translatedText !== text && !isLikelyEnglishTitle(translatedText)) {
      return translatedText;
    }
  }

  return "";
}

async function translateTextWithProvider(text, timeoutMs, provider) {
  if (provider === "baidu") return translateTextWithBaidu(text, timeoutMs);
  if (provider === "mymemory") return translateTextWithMyMemory(text, timeoutMs);
  return translateTextWithGoogle(text, timeoutMs);
}

async function translateTextWithGoogle(text, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const params = new URLSearchParams({
      client: "gtx",
      sl: "en",
      tl: "zh-CN",
      dt: "t",
      q: text
    });
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`, {
      signal: controller.signal,
      headers: {
        "user-agent": DEFAULT_USER_AGENT
      }
    });
    if (!response.ok) return "";
    const payload = await response.json();
    return (payload?.[0] || [])
      .map((part) => part?.[0] || "")
      .join("")
      .trim();
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function translateTextWithBaidu(text, timeoutMs) {
  const appId = process.env.BAIDU_TRANSLATE_APP_ID || process.env.NEWS_BAIDU_TRANSLATE_APP_ID || "";
  const secret = process.env.BAIDU_TRANSLATE_SECRET || process.env.NEWS_BAIDU_TRANSLATE_SECRET || "";
  if (!appId || !secret) return "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const salt = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
    const sign = createHash("md5")
      .update(`${appId}${text}${salt}${secret}`)
      .digest("hex");
    const params = new URLSearchParams({
      q: text,
      from: "en",
      to: "zh",
      appid: appId,
      salt,
      sign
    });
    const response = await fetch(`https://fanyi-api.baidu.com/api/trans/vip/translate?${params}`, {
      signal: controller.signal,
      headers: {
        "user-agent": DEFAULT_USER_AGENT
      }
    });
    if (!response.ok) return "";
    const payload = await response.json();
    return stripHtml((payload?.trans_result || []).map((item) => item?.dst || "").join(" "));
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function translateTextWithMyMemory(text, timeoutMs) {
  if (Buffer.byteLength(text, "utf8") > 500) return "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const params = new URLSearchParams({
      q: text,
      langpair: "en|zh-CN"
    });
    const response = await fetch(`https://api.mymemory.translated.net/get?${params}`, {
      signal: controller.signal,
      headers: {
        "user-agent": DEFAULT_USER_AGENT
      }
    });
    if (!response.ok) return "";
    const payload = await response.json();
    if (payload?.responseStatus && payload.responseStatus !== 200) return "";
    return stripHtml(payload?.responseData?.translatedText || "");
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function addDisplayTitles(items, options = {}) {
  const {
    translateEnglishTitles = true,
    translationTimeoutMs = 5000,
    translationProviders = ["google", "mymemory"]
  } = options;
  if (!translateEnglishTitles) {
    return items.map((item) => ({
      ...item,
      displayTitle: item.title
    }));
  }

  return Promise.all(
    items.map(async (item) => {
      if (!isLikelyEnglishTitle(item.title)) {
        return {
          ...item,
          displayTitle: item.title
        };
      }

      const translatedTitle = await translateTextToZhWithProviders(
        item.title,
        translationTimeoutMs,
        translationProviders
      );
      return {
        ...item,
        originalTitle: item.title,
        translatedTitle,
        displayTitle: translatedTitle || item.title
      };
    })
  );
}

function scoreItem(item, now) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const ageHours = item.publishedAt
    ? Math.max(0, (now.getTime() - item.publishedAt.getTime()) / 36e5)
    : 24;
  const recencyScore = Math.max(0, 36 - ageHours);
  const keywordScore = KEYWORD_WEIGHTS.reduce((score, [keyword, weight]) => {
    return text.includes(keyword.toLowerCase()) ? score + weight : score;
  }, 0);
  const duplicateScore = Math.min(item.duplicateCount - 1, 4) * 6;
  const titlePenalty = getTitlePenalty(item.title);

  return Math.round(
    recencyScore +
      Math.min(keywordScore, 36) +
      item.sourceWeight +
      item.qualityScore +
      duplicateScore -
      titlePenalty
  );
}

function explainImportance(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const matched = KEYWORD_WEIGHTS
    .filter(([keyword]) => text.includes(keyword.toLowerCase()))
    .slice(0, 3)
    .map(([keyword]) => keyword);

  const tierLabel = {
    official: "官方源",
    "tier1-tech-media": "一线科技媒体",
    "ai-vertical-media": "AI 垂直媒体",
    "mainstream-cn-tech": "中文科技/财经媒体",
    aggregator: "聚合源",
    "low-quality": "低权重来源",
    unknown: "普通来源"
  }[item.sourceTier || "unknown"];

  if (matched.length === 0) {
    return `${tierLabel}，发布时间较新，可作为今日行业动态补充观察。`;
  }

  return `${tierLabel}，关键词：${matched.join("、")}。`;
}

function getTitlePenalty(title = "") {
  let penalty = 0;
  if (/[!！]{2,}/u.test(title)) penalty += 6;
  if (/突发|重磅|爆了|炸了/u.test(title)) penalty += 5;
  if (/悄然|偷偷|内幕/u.test(title)) penalty += 4;
  if (title.length > 96) penalty += 4;
  return penalty;
}

function isUsefulCandidate(item) {
  if (isExcludedHost(item.sourceHost)) return false;
  if (isExcludedTitle(item.title)) return false;
  if (hasStaleContentSignals(item)) return false;
  return true;
}

function diversifyItems(items, limit, maxPerHost = 2) {
  const selected = [];
  const hostCounts = new Map();

  for (const item of items) {
    if (selected.some((selectedItem) => areLikelySameStory(selectedItem, item))) continue;
    const host = item.sourceHost || item.source || "unknown";
    const count = hostCounts.get(host) || 0;
    if (count >= maxPerHost) continue;
    selected.push(item);
    hostCounts.set(host, count + 1);
    if (selected.length >= limit) return selected;
  }

  for (const item of items) {
    if (selected.includes(item)) continue;
    if (selected.some((selectedItem) => areLikelySameStory(selectedItem, item))) continue;
    selected.push(item);
    if (selected.length >= limit) return selected;
  }

  return selected;
}

function getStoryTokens(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const tokens = new Set();
  const tokenRules = [
    ["openai", /openai|chatgpt|gpt-\d(?:\.\d)?|gpt\d/gi],
    ["anthropic", /anthropic|claude/gi],
    ["claude-code", /claude\s+code|claude code/gi],
    ["gemini", /gemini|google\s+ai|alphabet/gi],
    ["nvidia", /nvidia|英伟达/gi],
    ["deepseek", /deepseek/gi],
    ["agent", /agent|agents|智能体/gi],
    ["security", /security|cybersecurity|安全|网络安全/gi],
    ["revenue", /revenue|收入|年化/gi],
    ["cost", /cost|成本/gi],
    ["funding", /funding|融资|估值/gi]
  ];

  for (const [token, pattern] of tokenRules) {
    if (pattern.test(text)) tokens.add(token);
  }

  for (const match of text.matchAll(/\b\d+(?:\.\d+)?\b|[\d.]+亿|[\d.]+万/gu)) {
    tokens.add(match[0]);
  }

  return tokens;
}

function getComparableTitleTokens(item) {
  const text = normalizeTitle(`${item.displayTitle || item.title} ${item.originalTitle || ""}`);
  const tokens = new Set();

  for (const match of text.matchAll(/[a-z][a-z0-9-]{2,}/gi)) {
    const token = match[0].toLowerCase();
    if (!TITLE_STOP_WORDS.has(token)) tokens.add(token);
  }

  const cjkParts = text.match(/[\u3400-\u9fff]{2,}/gu) || [];
  for (const part of cjkParts) {
    for (let index = 0; index < part.length - 1; index += 1) {
      tokens.add(part.slice(index, index + 2));
    }
  }

  for (const match of text.matchAll(/\b\d+(?:\.\d+)?\b/gu)) {
    tokens.add(match[0]);
  }

  return tokens;
}

const TITLE_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "over",
  "about",
  "after",
  "before",
  "news",
  "says",
  "said",
  "its",
  "his",
  "her",
  "their",
  "your",
  "openai",
  "chatgpt"
]);

function tokenSimilarity(tokensA, tokensB) {
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  const intersectionSize = [...tokensA].filter((token) => tokensB.has(token)).length;
  const unionSize = new Set([...tokensA, ...tokensB]).size;
  return intersectionSize / unionSize;
}

function areLikelySameStory(a, b) {
  const hostA = a.sourceHost || "";
  const hostB = b.sourceHost || "";
  const sameHost = hostA && hostB && hostA === hostB;
  const articleKeyA = canonicalArticleKey(a);
  const articleKeyB = canonicalArticleKey(b);
  if (articleKeyA && articleKeyB && articleKeyA === articleKeyB) return true;

  const titleSimilarity = tokenSimilarity(getComparableTitleTokens(a), getComparableTitleTokens(b));
  const tokensA = getStoryTokens(a);
  const tokensB = getStoryTokens(b);
  const intersection = [...tokensA].filter((token) => tokensB.has(token));
  const hasSharedNumber = intersection.some((token) => /\d/.test(token));
  const hasSharedEntity = intersection.some((token) =>
    ["openai", "anthropic", "claude-code", "gemini", "nvidia", "deepseek"].includes(token)
  );

  if (sameHost && titleSimilarity >= 0.42) return true;
  if (sameHost && hasSharedEntity && titleSimilarity >= 0.25) return true;
  if (sameHost && intersection.length >= 2) return true;
  return intersection.length >= 3 && hasSharedEntity && hasSharedNumber;
}

function dedupeItems(items) {
  const byKey = new Map();
  for (const item of items) {
    const key = normalizeTitle(item.title);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    existing.duplicateCount += 1;
    existing.sourceWeight = Math.max(existing.sourceWeight, item.sourceWeight);
    if (!existing.summary && item.summary) existing.summary = item.summary;
    if (!existing.publishedAt || (item.publishedAt && item.publishedAt > existing.publishedAt)) {
      existing.publishedAt = item.publishedAt;
    }
  }
  return [...byKey.values()];
}

export async function getDailyAiNewsTop10(options = {}) {
  const {
    language = "mixed",
    limit = 10,
    hoursBack = 24,
    candidateLimit = 50,
    maxPerHost = 2,
    verifyArticleDates = true,
    articleDateCandidateLimit = 30,
    articleFetchTimeoutMs = 6000,
    translateEnglishTitles = true,
    translationTimeoutMs = 5000,
    translationProviders = ["google", "mymemory"],
    includeGoogleNews = true,
    timeoutMs = 8000,
    includeFailedFeeds = false
  } = options;

  const now = new Date();
  const feeds = buildFeedList(language, { includeGoogleNews });
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      try {
        return {
          feed,
          items: parseFeed(await fetchText(feed.url, timeoutMs), feed)
        };
      } catch (error) {
        throw new Error(`${feed.name}: ${error.message} (${feed.url})`);
      }
    })
  );

  const failedFeeds = [];
  const items = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      items.push(...result.value.items);
    } else {
      failedFeeds.push(String(result.reason?.message || result.reason));
    }
  }

  const initialCandidates = dedupeItems(items)
    .filter((item) => isWithinWindow(item, now, hoursBack))
    .map((item) => ({
      ...item,
      ...getSourceQuality(item.sourceHost)
    }))
    .filter(isUsefulCandidate)
    .map((item) => ({
      ...item,
      score: scoreItem(item, now),
      importance: explainImportance(item)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(Math.max(articleDateCandidateLimit, candidateLimit, limit), 120));

  const verifiedCandidates = verifyArticleDates
    ? await enrichArticleDates(initialCandidates, {
        now,
        timeoutMs: articleFetchTimeoutMs
      })
    : initialCandidates;

  const rankedCandidates = verifiedCandidates
    .filter((item) => isWithinWindow(item, now, hoursBack))
    .filter(isUsefulCandidate)
    .map((item) => ({
      ...item,
      ...getSourceQuality(item.sourceHost)
    }))
    .map((item) => ({
      ...item,
      score: scoreItem(item, now),
      importance: explainImportance(item)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(Math.max(candidateLimit, limit), 100));

  const rankedItems = await addDisplayTitles(
    diversifyItems(
      rankedCandidates,
      Math.min(Math.max(limit, 1), 20),
      Math.min(Math.max(maxPerHost, 1), 5)
    ),
    {
      translateEnglishTitles,
      translationTimeoutMs,
      translationProviders
    }
  );

  return {
    generatedAt: now.toISOString(),
    language,
    hoursBack,
    count: rankedItems.length,
    rawCount: items.length,
    candidateCount: rankedCandidates.length,
    items: rankedItems,
    failedFeeds: includeFailedFeeds ? failedFeeds : []
  };
}

export function formatNewsMarkdown(result) {
  const date = new Date(result.generatedAt).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false
  });
  const lines = [
    `# 今日 AI 资讯 Top ${result.count}`,
    "",
    `生成时间：${date}（Asia/Shanghai）`,
    `时间范围：最近 ${result.hoursBack} 小时`,
    ""
  ];

  result.items.forEach((item, index) => {
    const published = item.publishedAt
      ? item.publishedAt.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })
      : "未知";
    const title = item.displayTitle || item.title;
    lines.push(
      `## ${index + 1}. ${title}`,
      "",
      `- 来源：${item.sourceHost || item.source}`,
      `- 发布时间：${published}`,
      `- 热度分：${item.score}`,
      `- 推荐理由：${item.importance}`,
      `- 链接：${item.link}`
    );
    if (item.originalTitle && item.originalTitle !== title) {
      lines.push(`- 英文原题：${item.originalTitle}`);
    }
    if (item.summary) {
      lines.push(`- 摘要：${item.summary.slice(0, 240)}`);
    }
    lines.push("");
  });

  if (result.failedFeeds?.length) {
    lines.push("## 抓取失败的数据源", "", ...result.failedFeeds.map((feed) => `- ${feed}`), "");
  }

  return lines.join("\n");
}

if (process.argv.includes("--markdown")) {
  getDailyAiNewsTop10({ includeFailedFeeds: true })
    .then((result) => {
      process.stdout.write(formatNewsMarkdown(result));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
