# LLM Search Chatbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local chatbox UI backed by an LLM that can use web search and show citations.

**Architecture:** A React/Vite client posts chat history to an Express API. The API calls OpenAI Responses API with web search enabled, normalizes answer text and `url_citation` annotations, and returns a small JSON payload to the client.

**Tech Stack:** Node.js, Express, React, Vite, Vitest, OpenAI Responses API via `fetch`.

---

### File Structure

- Create `package.json`: scripts and dependencies.
- Create `index.html`, `src/main.jsx`, `src/App.jsx`, `src/App.css`: frontend app.
- Create `server/index.js`: API server and OpenAI integration.
- Create `server/citations.js`: pure citation extraction helper.
- Create `tests/citations.test.js`: unit tests for citation extraction.
- Create `.env.example`: required environment variables.
- Create `README.md`: run instructions and behavior summary.

### Task 1: Citation Extraction

**Files:**
- Create: `server/citations.js`
- Create: `tests/citations.test.js`
- Modify: `package.json`

- [ ] Write tests for extracting assistant text and unique citations from Responses API output.
- [ ] Run `npm test -- tests/citations.test.js` and verify the test fails because the helper does not exist yet.
- [ ] Implement `extractAssistantResponse(response)` with no network or UI dependencies.
- [ ] Re-run `npm test -- tests/citations.test.js` and verify it passes.

### Task 2: Server API

**Files:**
- Create: `server/index.js`
- Create: `.env.example`

- [ ] Add `POST /api/chat` that validates non-empty `messages`.
- [ ] Call `https://api.openai.com/v1/responses` with `model`, `input`, and `tools: [{ type: "web_search_preview" }]`.
- [ ] Use `extractAssistantResponse` to return `{ text, sources }`.
- [ ] Return clear JSON errors for missing API key and upstream API failures.

### Task 3: Chat UI

**Files:**
- Create: `index.html`
- Create: `src/main.jsx`
- Create: `src/App.jsx`
- Create: `src/App.css`

- [ ] Build a single-screen chat layout with message history, input composer, loading state, and error state.
- [ ] Render sources as clickable links below each assistant answer.
- [ ] Keep UI responsive for desktop and mobile without adding unrelated features.

### Task 4: Docs And Verification

**Files:**
- Create: `README.md`

- [ ] Document install, `OPENAI_API_KEY`, dev server, and test commands.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Start the dev server if possible and report the local URL.
