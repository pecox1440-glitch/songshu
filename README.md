# 松鼠请回答

A local chatbox that sends questions to an LLM, enables web search, and displays source citations returned by the model.

## Setup

Install dependencies:

```bash
pnpm install
```

Set your API key:

```bash
copy .env.example .env
```

Then edit `.env` or export the variables in your shell:

```bash
OPENAI_API_KEY=sk-your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5-mini
HOST=0.0.0.0
PORT=5173
```

## Run

```bash
pnpm dev
```

Open `http://localhost:5173`.

## Use From Other Machines

Build once, then start the web server:

```bash
pnpm build
pnpm start
```

On the host machine, find its LAN IP address. On Windows:

```powershell
ipconfig
```

Then open this URL from another machine on the same network:

```text
http://<host-lan-ip>:5173
```

For example:

```text
http://192.168.1.23:5173
```

Keep `HOST=0.0.0.0` in `.env` so the server listens on the network instead of only localhost. If the page cannot be reached, allow TCP port `5173` through the host firewall.

## Deploy To The Internet

This app can be deployed as a public website on a Node.js host or with Docker. Keep the API key on the server as an environment variable; do not put it in frontend code.

For a fixed URL without buying a domain, deploy to Render:

1. Push this folder to a GitHub repository.
2. In Render, choose **New +** -> **Blueprint**.
3. Select the repository and use `render.yaml`.
4. Fill `OPENAI_API_KEY` when Render asks for the secret value.
5. Deploy. Render will give you a fixed `onrender.com` URL.

See [docs/deployment.md](docs/deployment.md) for Render, Docker, hosted Node platform, domain, and HTTPS notes.

## Test

```bash
pnpm test
pnpm build
```

## How Citations Work

The server calls the OpenAI Responses API with the `web_search_preview` tool enabled. When the model returns `url_citation` annotations, the backend normalizes them into a `sources` array and the UI renders them under the assistant response.

To use an OpenAI-compatible third-party gateway, set `OPENAI_BASE_URL` in `.env`, for example `https://maylily.xyz/v1`.
