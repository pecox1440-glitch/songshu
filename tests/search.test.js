import { describe, expect, test } from "vitest";
import { buildSearchContext, parseBingResults, parseDuckDuckGoLiteResults, shouldSearchWeb } from "../server/search.js";

describe("shouldSearchWeb", () => {
  test("requires search for current match questions", () => {
    expect(shouldSearchWeb("今天美国和比利时比分")).toBe(true);
    expect(shouldSearchWeb("今晚有什么比赛")).toBe(true);
  });

  test("does not require search for stable casual questions", () => {
    expect(shouldSearchWeb("写一首关于秋天的小诗")).toBe(false);
  });
});

describe("parseDuckDuckGoLiteResults", () => {
  test("extracts titles, urls, and snippets from lite html", () => {
    const html = `
      <a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fmatch&amp;rut=abc">Match report</a>
      <td class="result-snippet">Final score and schedule details</td>
    `;

    expect(parseDuckDuckGoLiteResults(html)).toEqual([
      {
        title: "Match report",
        url: "https://example.com/match",
        snippet: "Final score and schedule details",
      },
    ]);
  });
});

describe("parseBingResults", () => {
  test("extracts titles, urls, and snippets from Bing html", () => {
    const html = `
      <li class="b_algo">
        <h2><a href="https://example.com/match">Match report</a></h2>
        <p>Final score and schedule details</p>
      </li>
    `;

    expect(parseBingResults(html)).toEqual([
      {
        title: "Match report",
        url: "https://example.com/match",
        snippet: "Final score and schedule details",
      },
    ]);
  });
});

describe("buildSearchContext", () => {
  test("formats search results for the model", () => {
    const context = buildSearchContext([
      {
        title: "Match report",
        url: "https://example.com/match",
        snippet: "Final score and schedule details",
      },
    ]);

    expect(context).toContain("联网搜索结果");
    expect(context).toContain("Match report");
    expect(context).toContain("https://example.com/match");
  });
});
