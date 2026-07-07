const maxSearchResults = 5;
const freshInfoPattern =
  /今天|今晚|明天|昨天|本周|现在|最新|实时|刚刚|比赛|比分|赛程|赛果|新闻|天气|价格|股价|汇率|政策|公告|上映|发布|更新/i;

export function shouldSearchWeb(text) {
  return freshInfoPattern.test(String(text || ""));
}

export async function searchWeb(query, fetchImpl = fetch) {
  const errors = [];
  const searches = [
    {
      url: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
      parse: parseBingResults,
    },
    {
      url: `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
      parse: parseDuckDuckGoLiteResults,
    },
  ];

  for (const search of searches) {
    try {
      const response = await fetchSearchPage(search.url, fetchImpl);
      const results = search.parse(response);

      if (results.length > 0) {
        return results.slice(0, maxSearchResults);
      }

      errors.push(`${new URL(search.url).hostname}: 没有解析到结果`);
    } catch (error) {
      errors.push(`${new URL(search.url).hostname}: ${error.message}`);
    }
  }

  throw new Error(`联网搜索失败：${errors.join("；")}`);
}

async function fetchSearchPage(searchUrl, fetchImpl) {
  const response = await fetchImpl(searchUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 SongshuAssistant/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`联网搜索失败：HTTP ${response.status}`);
  }

  return response.text();
}

export function buildSearchContext(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return "";
  }

  const lines = results.map((result, index) => {
    const snippet = result.snippet ? `\n摘要：${result.snippet}` : "";
    return `[${index + 1}] ${result.title}\n链接：${result.url}${snippet}`;
  });

  return [
    "联网搜索结果如下。回答涉及实时信息时，优先依据这些结果；如果结果不足以确认，请直接说明没有查到可靠信息。",
    "不要把 [1]、[2] 写成内部引用标记，也不要输出 turn0search。",
    ...lines,
  ].join("\n\n");
}

export function parseDuckDuckGoLiteResults(html) {
  const decodedHtml = decodeHtml(String(html || ""));
  const anchorPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetPattern = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
  const snippets = [...decodedHtml.matchAll(snippetPattern)].map((match) => stripTags(match[1]));
  const results = [];
  let match;

  while ((match = anchorPattern.exec(decodedHtml)) && results.length < maxSearchResults) {
    const url = normalizeDuckDuckGoUrl(match[1]);
    const title = stripTags(match[2]);

    if (!url || !title || url.includes("duckduckgo.com")) {
      continue;
    }

    results.push({
      title,
      url,
      snippet: snippets[results.length] || "",
    });
  }

  return results;
}

export function parseBingResults(html) {
  const decodedHtml = decodeHtml(String(html || ""));
  const blockPattern = /<li[^>]+class="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  const results = [];
  let match;

  while ((match = blockPattern.exec(decodedHtml)) && results.length < maxSearchResults) {
    const block = match[1];
    const link = block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i);

    if (!link) {
      continue;
    }

    const url = decodeHtml(link[1]);
    const title = stripTags(link[2]);
    const snippet = stripTags(block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");

    if (!url.startsWith("http") || !title) {
      continue;
    }

    results.push({ title, url, snippet });
  }

  return results;
}

function normalizeDuckDuckGoUrl(rawUrl) {
  const url = decodeHtml(rawUrl || "");

  if (url.startsWith("//duckduckgo.com/l/?")) {
    const parsed = new URL(`https:${url}`);
    return parsed.searchParams.get("uddg") || "";
  }

  if (url.startsWith("/l/?")) {
    const parsed = new URL(`https://duckduckgo.com${url}`);
    return parsed.searchParams.get("uddg") || "";
  }

  return url.startsWith("http") ? url : "";
}

function stripTags(html) {
  return decodeHtml(String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
