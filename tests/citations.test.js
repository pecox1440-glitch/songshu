import { describe, expect, test } from "vitest";
import { extractAssistantResponse } from "../server/citations.js";

describe("extractAssistantResponse", () => {
  test("extracts assistant text and unique URL citations", () => {
    const response = {
      output: [
        {
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: "The project should use the Responses API with web search.",
              annotations: [
                {
                  type: "url_citation",
                  title: "Web search guide",
                  url: "https://platform.openai.com/docs/guides/tools-web-search",
                },
                {
                  type: "url_citation",
                  title: "Duplicate guide",
                  url: "https://platform.openai.com/docs/guides/tools-web-search",
                },
              ],
            },
          ],
        },
      ],
    };

    expect(extractAssistantResponse(response)).toEqual({
      text: "The project should use the Responses API with web search.",
      sources: [
        {
          title: "Web search guide",
          url: "https://platform.openai.com/docs/guides/tools-web-search",
        },
      ],
    });
  });

  test("falls back to output_text and an empty source list", () => {
    const response = {
      output_text: "A plain response without annotations.",
    };

    expect(extractAssistantResponse(response)).toEqual({
      text: "A plain response without annotations.",
      sources: [],
    });
  });

  test("extracts text from chat completions responses", () => {
    const response = {
      choices: [
        {
          message: {
            role: "assistant",
            content: "这是 chat completions 的回答。",
          },
        },
      ],
    };

    expect(extractAssistantResponse(response)).toEqual({
      text: "这是 chat completions 的回答。",
      sources: [],
    });
  });

  test("removes markdown bold markers from assistant text", () => {
    const response = {
      choices: [
        {
          message: {
            role: "assistant",
            content: "**今天的比赛**需要看最新赛程。",
          },
        },
      ],
    };

    expect(extractAssistantResponse(response).text).toBe("今天的比赛需要看最新赛程。");
  });

  test("removes internal citation artifacts from assistant text", () => {
    const response = {
      choices: [
        {
          message: {
            role: "assistant",
            content: "根据最新赛程，今晚有比赛。 cite turn0search0\n\n更多信息见 turn0search5。",
          },
        },
      ],
    };

    expect(extractAssistantResponse(response).text).toBe("根据最新赛程，今晚有比赛。\n\n更多信息见。");
  });

  test("removes standalone citation artifact lines", () => {
    const response = {
      choices: [
        {
          message: {
            role: "assistant",
            content: "今天没有正式比分。\n\ncite   turn0search0   turn0search5\n\n可以查询历史交锋。",
          },
        },
      ],
    };

    expect(extractAssistantResponse(response).text).toBe("今天没有正式比分。\n\n可以查询历史交锋。");
  });
});
