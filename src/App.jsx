import React, { useEffect, useMemo, useState } from "react";

const starterMessages = [
  {
    role: "assistant",
    content: "请让我来帮助你",
    sources: [],
  },
];

const modelOptions = ["gpt-5-mini", "gpt-5", "gpt-4o", "o4-mini"];

function SourceList({ sources }) {
  if (!sources?.length) {
    return null;
  }

  return (
    <div className="sources" aria-label="参考来源">
      <span className="sources-label">参考来源</span>
      <div className="source-links">
        {sources.map((source, index) => (
          <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
            <span>{index + 1}</span>
            {source.title || source.url}
          </a>
        ))}
      </div>
    </div>
  );
}

function Message({ message }) {
  return (
    <article className={`message ${message.role}`}>
      <div className="message-meta">{message.role === "user" ? "你" : "松鼠"}</div>
      <div className="message-body">{message.content}</div>
      <SourceList sources={message.sources} />
    </article>
  );
}

export default function App() {
  const [messages, setMessages] = useState(starterMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    apiKey: "",
    baseUrl: "https://maylily.xyz/v1",
    model: "gpt-5-mini",
    apiKeyPreview: "",
    hasApiKey: false,
  });
  const [settingsMessage, setSettingsMessage] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isTestingSettings, setIsTestingSettings] = useState(false);

  const apiMessages = useMemo(
    () =>
      messages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({ role: message.role, content: message.content })),
    [messages],
  );

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/settings");
        const payload = await response.json();
        if (response.ok) {
          setSettings((current) => ({
            ...current,
            baseUrl: payload.baseUrl || current.baseUrl,
            model: payload.model || current.model,
            apiKeyPreview: payload.apiKeyPreview || "",
            hasApiKey: Boolean(payload.hasApiKey),
          }));
        }
      } catch {
        setSettingsMessage("暂时无法读取本地 API 设置。");
      }
    }

    loadSettings();
  }, []);

  async function handleSettingsSubmit(event) {
    event.preventDefault();
    setSettingsMessage("");
    setIsSavingSettings(true);

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model: settings.model,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "保存失败。");
      }

      setSettings((current) => ({
        ...current,
        apiKey: "",
        baseUrl: payload.baseUrl,
        model: payload.model,
        apiKeyPreview: payload.apiKeyPreview,
        hasApiKey: payload.hasApiKey,
      }));
      setSettingsMessage("API 设置已保存。");
      setIsSettingsOpen(false);
    } catch (caughtError) {
      setSettingsMessage(caughtError.message);
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleTestSettings() {
    setSettingsMessage("");
    setIsTestingSettings(true);

    try {
      const response = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model: settings.model,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "测试失败。");
      }

      setSettingsMessage(`测试成功：${payload.message}`);
    } catch (caughtError) {
      setSettingsMessage(caughtError.message);
    } finally {
      setIsTestingSettings(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const content = draft.trim();

    if (!content || isLoading) {
      return;
    }

    const nextMessages = [...messages, { role: "user", content, sources: [] }];
    setMessages(nextMessages);
    setDraft("");
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...apiMessages, { role: "user", content }],
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "请求失败。");
      }

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: payload.text || "我暂时无法生成回答。",
          sources: payload.sources || [],
        },
      ]);
    } catch (caughtError) {
      setError(caughtError.message);
      setMessages(nextMessages);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="product-shell">
        <header className="topbar">
          <div className="brand-block">
            <div className="brand-mark" aria-hidden="true">
              问
            </div>
            <div>
              <h1>松鼠请回答</h1>
              <p>轻巧、安静、会回答的对话空间</p>
            </div>
          </div>

          <div className="settings-menu">
            <button
              className="settings-trigger"
              type="button"
              aria-expanded={isSettingsOpen}
              onClick={() => setIsSettingsOpen((open) => !open)}
            >
              <span className="status-dot" aria-hidden="true" />
              {settings.hasApiKey ? "连接已就绪" : "连接设置"}
            </button>

            {isSettingsOpen && (
              <form className="settings-popover" onSubmit={handleSettingsSubmit}>
                <div className="section-heading">
                  <h2>连接设置</h2>
                  <p>
                    {settings.hasApiKey
                      ? `当前 key：${settings.apiKeyPreview}，留空继续使用。`
                      : "填写 API key 后即可开始对话。"}
                  </p>
                </div>

                <label>
                  <span>API Key</span>
                  <input
                    type="password"
                    value={settings.apiKey}
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, apiKey: event.target.value }))
                    }
                    placeholder={settings.hasApiKey ? "留空继续使用当前 key" : "请输入 API key"}
                    autoComplete="off"
                  />
                </label>
                <label>
                  <span>接口地址</span>
                  <input
                    value={settings.baseUrl}
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, baseUrl: event.target.value }))
                    }
                    placeholder="https://maylily.xyz/v1"
                  />
                </label>
                <label>
                  <span>模型</span>
                  <input
                    list="model-options"
                    value={settings.model}
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, model: event.target.value }))
                    }
                    placeholder="gpt-5-mini"
                  />
                  <datalist id="model-options">
                    {modelOptions.map((model) => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                </label>

                <div className="settings-actions">
                  <button className="secondary-button" type="button" onClick={handleTestSettings} disabled={isTestingSettings}>
                    {isTestingSettings ? "测试中" : "测试连接"}
                  </button>
                  <button className="primary-button" type="submit" disabled={isSavingSettings}>
                    {isSavingSettings ? "保存中" : "保存设置"}
                  </button>
                </div>

                {settingsMessage && <div className="settings-message">{settingsMessage}</div>}
              </form>
            )}
          </div>
        </header>

        <section className="conversation-panel" aria-label="松鼠请回答聊天">
          <div className="hero-strip">
            <div className="hero-copy">
              <h2>
                <span>把问题交给松鼠</span>
                <span>答案会自己冒出来</span>
              </h2>
            </div>
            <div className="hero-art" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="messages" aria-live="polite">
            {messages.map((message, index) => (
              <Message key={`${message.role}-${index}`} message={message} />
            ))}
            {isLoading && (
              <article className="message assistant pending">
                <div className="message-meta">松鼠</div>
                <div className="message-body">正在搜索并生成回答...</div>
              </article>
            )}
          </div>

          {error && <div className="error-banner">{error}</div>}

          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  handleSubmit(event);
                }
              }}
              placeholder="输入问题，按 Enter 发送，Shift + Enter 换行"
              rows={3}
              aria-label="消息"
            />
            <button className="primary-button" type="submit" disabled={isLoading || !draft.trim()}>
              {isLoading ? "处理中" : "发送"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
