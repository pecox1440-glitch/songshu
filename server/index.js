import express from "express";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractAssistantResponse } from "./citations.js";
import { buildChatInstructions } from "./prompt.js";
import { buildSearchContext, searchWeb, shouldSearchWeb } from "./search.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const defaultModel = "gpt-5-mini";

loadEnvFile(path.join(rootDir, ".env"));

const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "0.0.0.0";
const distIndexPath = path.join(rootDir, "dist", "index.html");

const app = express();
app.get("/healthz", (_req, res) => {
  res.status(200).send("ok");
});
app.use(requireAccessPassword);
app.use(express.json({ limit: "1mb" }));

app.get("/api/settings", (_req, res) => {
  const settings = getSettings();
  res.json({
    baseUrl: settings.baseUrl,
    model: settings.model,
    hasApiKey: Boolean(settings.apiKey),
    apiKeyPreview: maskApiKey(settings.apiKey),
  });
});

app.post("/api/settings", (req, res) => {
  const current = getSettings();
  const next = resolveSubmittedSettings(req.body, current);

  if (!next.apiKey) {
    return res.status(400).json({ error: "请输入 API key。" });
  }

  if (!/^https?:\/\//.test(next.baseUrl)) {
    return res.status(400).json({ error: "接口地址必须以 http:// 或 https:// 开头。" });
  }

  saveSettings(next);
  res.json({
    baseUrl: next.baseUrl,
    model: next.model,
    hasApiKey: true,
    apiKeyPreview: maskApiKey(next.apiKey),
  });
});

app.post("/api/settings/test", async (req, res) => {
  const settings = resolveSubmittedSettings(req.body, getSettings());

  if (!settings.apiKey) {
    return res.status(400).json({ error: "请先填写或保存 API key。" });
  }

  try {
    const payload = await requestOpenAI(
      {
        model: settings.model,
        instructions: "你是一个中文助手。请只用一句话回答连接测试。",
        input: [{ role: "user", content: "请回复：连接成功。" }],
      },
      settings,
    );
    const extracted = extractAssistantResponse(payload);

    res.json({
      ok: Boolean(extracted.text),
      message: extracted.text || "模型返回成功，但没有文本内容。",
    });
  } catch (error) {
    res.status(502).json({ error: error.message || "连接测试失败。" });
  }
});

app.post("/api/chat", async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const input = messages
    .filter((message) => ["user", "assistant"].includes(message.role))
    .map((message) => ({
      role: message.role,
      content: String(message.content || "").trim(),
    }))
    .filter((message) => message.content.length > 0);

  if (input.length === 0) {
    return res.status(400).json({ error: "请至少发送一条消息。" });
  }

  const settings = getSettings();

  if (!settings.apiKey) {
    return res.status(500).json({
      error: "未设置 OPENAI_API_KEY。请添加到环境变量或 .env 文件后重启服务。",
    });
  }

  try {
    const searchResults = shouldSearchWeb(input.at(-1)?.content) ? await searchWeb(input.at(-1).content) : [];
    const instructions = [buildChatInstructions(), buildSearchContext(searchResults)].filter(Boolean).join("\n\n");
    const payload = await requestOpenAI(
      {
        model: settings.model,
        instructions,
        input,
        tools: [{ type: "web_search_preview" }],
      },
      settings,
    );

    const extracted = extractAssistantResponse(payload);
    res.json({
      ...extracted,
      sources: mergeSources(extracted.sources, searchResults),
    });
  } catch (error) {
    res.status(502).json({
      error: error.message || "无法连接模型服务。请检查网络和 API key。",
    });
  }
});

if (process.env.NODE_ENV === "production" || fs.existsSync(distIndexPath)) {
  app.use(express.static(path.join(rootDir, "dist")));
  app.get("*", (_req, res) => {
    res.sendFile(distIndexPath);
  });
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root: rootDir,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

function mergeSources(modelSources, searchResults) {
  const merged = [];
  const seenUrls = new Set();

  for (const source of [...modelSources, ...searchResults]) {
    if (!source?.url || seenUrls.has(source.url)) {
      continue;
    }

    seenUrls.add(source.url);
    merged.push({
      title: source.title || source.url,
      url: source.url,
    });
  }

  return merged;
}

app.listen(port, host, () => {
  console.log(`松鼠请回答 running at http://${host}:${port}`);
});

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function getSettings() {
  return {
    apiKey: process.env.OPENAI_API_KEY || "",
    baseUrl: normalizeBaseUrl(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"),
    model: normalizeModel(process.env.OPENAI_MODEL || defaultModel),
  };
}

function resolveSubmittedSettings(body, current) {
  return {
    apiKey: String(body?.apiKey || "").trim() || current.apiKey,
    baseUrl: normalizeBaseUrl(String(body?.baseUrl || "").trim() || current.baseUrl),
    model: normalizeModel(String(body?.model || "").trim() || current.model),
  };
}

function normalizeBaseUrl(baseUrl) {
  const normalized = String(baseUrl || "").trim().replace(/\/+$/, "");

  if (normalized === "https://maylily.xyz" || normalized === "http://maylily.xyz") {
    return `${normalized}/v1`;
  }

  return normalized;
}

function normalizeModel(model) {
  const normalized = String(model || "").trim();

  if (!normalized || normalized === "gpt-4.1-mini") {
    return defaultModel;
  }

  return normalized;
}

function saveSettings(settings) {
  process.env.OPENAI_API_KEY = settings.apiKey;
  process.env.OPENAI_BASE_URL = settings.baseUrl;
  process.env.OPENAI_MODEL = settings.model;

  const envContent = [
    `OPENAI_API_KEY=${settings.apiKey}`,
    `OPENAI_BASE_URL=${settings.baseUrl}`,
    `OPENAI_MODEL=${normalizeModel(settings.model)}`,
    `HOST=${host}`,
    `PORT=${port}`,
    ...(process.env.ACCESS_USERNAME ? [`ACCESS_USERNAME=${process.env.ACCESS_USERNAME}`] : []),
    ...(process.env.ACCESS_PASSWORD ? [`ACCESS_PASSWORD=${process.env.ACCESS_PASSWORD}`] : []),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(rootDir, ".env"), envContent, "utf8");
}

function requireAccessPassword(req, res, next) {
  const expectedPassword = process.env.ACCESS_PASSWORD;

  if (!expectedPassword) {
    next();
    return;
  }

  const expectedUsername = process.env.ACCESS_USERNAME || "";
  const credentials = parseBasicAuth(req.headers.authorization);
  const usernameMatches = !expectedUsername || safeEqual(credentials.username, expectedUsername);
  const passwordMatches = safeEqual(credentials.password, expectedPassword);

  if (usernameMatches && passwordMatches) {
    next();
    return;
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="Songshu Assistant"');
  res.status(401).send("需要访问密码。");
}

function parseBasicAuth(authorization) {
  const [scheme, encoded] = String(authorization || "").split(" ");

  if (scheme !== "Basic" || !encoded) {
    return { username: "", password: "" };
  }

  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");

  if (separatorIndex < 0) {
    return { username: decoded, password: "" };
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

function safeEqual(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || ""));
  const expectedBuffer = Buffer.from(String(expected || ""));

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function maskApiKey(apiKey) {
  if (!apiKey) {
    return "";
  }

  if (apiKey.length <= 10) {
    return "已配置";
  }

  return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
}

async function requestOpenAI(body, settings) {
  const chatBody = {
    model: body.model,
    stream: false,
    messages: [
      { role: "system", content: body.instructions },
      ...body.input,
    ],
  };
  const attempts = getRequestAttempts(settings, body, chatBody);
  const errors = [];

  for (const attempt of attempts) {
    const result = await requestJsonWithFetch(attempt.url, attempt.body, settings);

    if (result.ok) {
      return result.payload;
    }

    errors.push(`${attempt.label}: ${result.error}`);
  }

  if (process.platform === "win32" && errors.some((error) => error.includes("网络连接失败"))) {
    try {
      return await requestOpenAIWithPowerShell(attempts, settings);
    } catch (error) {
      errors.push(error.message);
    }
  }

  throw new Error(errors.join("；") || "模型请求失败。");
}

function getRequestAttempts(settings, responseBody, chatBody) {
  const isOfficialOpenAI = settings.baseUrl.includes("api.openai.com");
  const responsesAttempt = {
    label: "Responses API",
    url: `${settings.baseUrl}/responses`,
    body: responseBody,
  };
  const chatAttempt = {
    label: "Chat Completions API",
    url: `${settings.baseUrl}/chat/completions`,
    body: chatBody,
  };

  if (isOfficialOpenAI) {
    return [responsesAttempt, chatAttempt];
  }

  return [chatAttempt];
}

async function requestJsonWithFetch(url, body, settings) {
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    const payload = parseResponseText(text);

    if (!upstream.ok || !payload) {
      return {
        ok: false,
        error: payload?.error?.message || summarizeRawResponse(text),
      };
    }

    return { ok: true, payload };
  } catch (error) {
    return {
      ok: false,
      error: `网络连接失败：${error.cause?.code || error.message}`,
    };
  }
}

function requestOpenAIWithPowerShell(attempts, settings) {
  const script = `
$ErrorActionPreference = "Stop"
$headers = @{
  Accept = "application/json"
  Authorization = "Bearer $env:OPENAI_API_KEY"
  "Content-Type" = "application/json"
}
function Invoke-JsonRequest($uri, $body) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $uri -Headers $headers -Body $body -ContentType "application/json" -TimeoutSec 60 -ErrorAction Stop
    [Console]::Out.Write($response.Content)
    exit 0
  } catch {
    if ($_.ErrorDetails.Message) {
      [Console]::Error.WriteLine($_.ErrorDetails.Message)
    } elseif ($_.Exception.Response -and $_.Exception.Response.GetResponseStream()) {
      $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
      [Console]::Error.WriteLine($reader.ReadToEnd())
    } else {
      [Console]::Error.WriteLine($_.Exception.Message)
    }
    exit 1
  }
}

try {
  Invoke-JsonRequest $env:OPENAI_REQUEST_URL $env:OPENAI_REQUEST_BODY
} catch {
  exit 1
}
`;

  return runPowerShellAttempts(script, attempts, settings);
}

async function runPowerShellAttempts(script, attempts, settings) {
  const errors = [];

  for (const attempt of attempts) {
    const result = await runPowerShellRequest(script, {
      ...process.env,
      OPENAI_API_KEY: settings.apiKey,
      OPENAI_REQUEST_BODY: JSON.stringify(attempt.body),
      OPENAI_REQUEST_URL: attempt.url,
    });

    if (result.ok) {
      return result.payload;
    }

    errors.push(`${attempt.label}: ${result.error}`);
  }

  throw new Error(errors.find(Boolean) || "模型请求失败。");
}

function runPowerShellRequest(script, env) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "-"], {
      env: {
        ...env,
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      const payload = parseResponseText(stdout);

      if (code !== 0) {
        resolve({
          ok: false,
          error: parseOpenAIError(stderr) || parseOpenAIError(stdout) || "模型请求失败。",
        });
        return;
      }

      resolve({
        ok: Boolean(payload),
        payload,
        error: payload ? "" : summarizeRawResponse(stdout),
      });
    });

    child.stdin.end(script);
  });
}

function parseJsonText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseResponseText(text) {
  const json = parseJsonText(text);

  if (json) {
    return json;
  }

  const dataLines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter((line) => line && line !== "[DONE]");

  for (const line of dataLines.reverse()) {
    const parsed = parseJsonText(line);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function summarizeRawResponse(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();

  if (!clean) {
    return "模型服务返回了空响应。";
  }

  return `模型服务返回了无法解析的响应：${clean.slice(0, 180)}`;
}

function parseOpenAIError(stderr) {
  const text = stderr.trim();
  if (!text) {
    return "";
  }

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  const jsonText = jsonStart >= 0 && jsonEnd > jsonStart ? text.slice(jsonStart, jsonEnd + 1) : text;

  try {
    return JSON.parse(jsonText)?.error?.message || text;
  } catch {
    return text;
  }
}
