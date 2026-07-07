export function extractAssistantResponse(response) {
  const textParts = [];
  const sources = [];
  const seenUrls = new Set();

  const addCitation = (annotation) => {
    if (!annotation || annotation.type !== "url_citation" || !annotation.url) {
      return;
    }

    if (seenUrls.has(annotation.url)) {
      return;
    }

    seenUrls.add(annotation.url);
    sources.push({
      title: annotation.title || annotation.url,
      url: annotation.url,
    });
  };

  for (const item of response?.output || []) {
    if (item?.type !== "message" || item?.role !== "assistant") {
      continue;
    }

    for (const content of item.content || []) {
      if (content?.type !== "output_text") {
        continue;
      }

      if (content.text) {
        textParts.push(content.text);
      }

      for (const annotation of content.annotations || []) {
        addCitation(annotation);
      }
    }
  }

  const rawText = textParts.join("\n\n").trim() || response?.output_text || extractChatCompletionText(response);

  return {
    text: cleanAssistantText(rawText),
    sources,
  };
}

export function cleanAssistantText(text) {
  return String(text || "")
    .replace(/\*\*([^*\r\n]+)\*\*/g, "$1")
    .replace(/(?:^|[ \t])(?:cite[ \t]+)?turn\d+search\d+\b/gi, "")
    .replace(/[ \t]+([。！？；，、])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractChatCompletionText(response) {
  const content = response?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        return part?.text || "";
      })
      .filter(Boolean)
      .join("\n\n");
  }

  return "";
}
