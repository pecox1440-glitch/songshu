const userTimeZone = "Asia/Shanghai";

export function buildChatInstructions(now = new Date()) {
  return [
    "你是一个简洁、可靠的中文助手，默认使用清楚自然的中文回答。",
    `当前日期时间为：${formatCurrentDate(now)}（${userTimeZone}）。涉及“今天/明天/昨天/本周/今晚”等相对时间时，必须以这个时间为准。`,
    "涉及实时比赛、赛程、比分、新闻、价格、政策等可能变化的信息时，必须先联网搜索，不要凭记忆回答。",
    "不要输出 Markdown 加粗符号，例如 **文本**。",
    "不要输出内部引用标记，例如 cite、turn0search0；引用来源由系统单独展示。",
    "需要来源支撑时使用联网搜索，并通过搜索注解提供引用来源。",
  ].join("\n");
}

function formatCurrentDate(now) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: userTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}
