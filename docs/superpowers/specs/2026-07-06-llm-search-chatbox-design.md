# LLM Search Chatbox Design

## Goal

Build a local interactive chatbox that sends user questions to an LLM, lets the model use web search, and displays answer citations/sources in the UI.

## Assumptions

- The project starts as an empty repository.
- The app can use an `OPENAI_API_KEY` environment variable on the server.
- The first version should be minimal and local-first: no auth, persistence, accounts, deployment, or multi-provider abstraction.
- The backend uses OpenAI Responses API with the built-in web search tool and extracts `url_citation` annotations when present.

## Approach

Use a React + Vite frontend and a Node + Express backend. The frontend posts chat messages to `/api/chat`. The backend calls the OpenAI Responses API with `web_search_preview`, then returns normalized assistant text plus source objects. The frontend renders the conversation, loading/error states, and a compact source list under assistant messages.

## Components

- `server/index.js`: Express API server, static production hosting, OpenAI request handling.
- `server/citations.js`: Pure helper that extracts text and citation metadata from Responses API output.
- `src/App.jsx`: Chat UI, message state, submit flow, and source rendering.
- `src/App.css`: Responsive application styling.
- `tests/citations.test.js`: Unit coverage for response normalization and citation extraction.

## Error Handling

- Missing `OPENAI_API_KEY` returns a clear server error.
- Empty user input is rejected by the client.
- API failures return a friendly message without exposing stack traces.
- If the model answers without citations, the UI explicitly shows no source list rather than inventing one.

## Verification

- Unit tests cover citation extraction from a representative Responses API shape.
- Build verification confirms frontend compilation.
- A local server can be started with `npm run dev` after dependencies are installed.
