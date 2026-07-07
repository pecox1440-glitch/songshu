import { describe, expect, test } from "vitest";
import { buildChatInstructions } from "../server/prompt.js";

describe("buildChatInstructions", () => {
  test("includes China time context and search rules for current events", () => {
    const instructions = buildChatInstructions(new Date("2026-07-07T02:30:00.000Z"));

    expect(instructions).toContain("Asia/Shanghai");
    expect(instructions).toContain("2026");
    expect(instructions).toContain("今天/明天/昨天/本周/今晚");
    expect(instructions).toContain("实时比赛、赛程、比分、新闻");
    expect(instructions).toContain("必须先联网搜索");
  });
});
