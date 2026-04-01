# url-shortener-mcp

![Coverage](https://michaelshumshum.github.io/url-shortener-mcp/badges.svg)
[![Test](https://github.com/michaelshumshum/url-shortener-mcp/actions/workflows/test.yml/badge.svg)](https://github.com/michaelshumshum/url-shortener-mcp/actions/workflows/test.yml)

[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Zod](https://img.shields.io/badge/Zod-4.x-3E67B1?logo=zod&logoColor=white)](https://zod.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-4.x-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![MCP SDK](https://img.shields.io/badge/MCP-SDK-CC785C?logo=anthropic&logoColor=white)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A URL shortener exposed as an [MCP](https://modelcontextprotocol.io/) server. Built with Express, Prisma, TypeScript, and SQLite.

Shorten URLs, set expiry times, tag them with a purpose note, and manage your links directly from any MCP-compatible LLM client.

> **This server is designed to be deployed remotely.** Short URLs are only useful if they resolve publicly, and MCP clients connect over HTTP — so the server should run on a machine with a public hostname (e.g. a VPS, cloud VM, or PaaS). Set `HOSTNAME` to your public domain and `HTTPS=true` in production. Running it on `localhost` is fine for development, but short links won't be shareable outside your machine.

---

## Table of Contents

- [Quick Start (npx)](#quick-start-npx)
- [Getting Started (from source)](#getting-started-from-source)
- [Docker](#docker)
- [MCP Configuration](#mcp-configuration)
- [MCP Capabilities](#mcp-capabilities)
  - [Tools](#tools)
  - [Resources](#resources)
  - [Prompts](#prompts)
  - [Sampling](#sampling)
- [AI Agent Rules](#ai-agent-rules)
- [REST API](#rest-api)
- [Environment Variables](#environment-variables)
- [Example Use Cases](#example-use-cases)
- [Development](#development)

---

## Quick Start (npx)

The fastest way to get running — no cloning required:

```bash
npx url-shortener-mcp --port 3000 --hostname your-domain.com --https true
```

On first run the server will:

1. Create a fresh SQLite database and apply all migrations automatically
2. Generate an API key and print it once — **save it, it will not be shown again**
3. Start listening

All environment variables can be passed as CLI flags:

```bash
npx url-shortener-mcp \
  --port 3000 \
  --database-url file:/data/urls.db \
  --hostname your-domain.com \
  --https true \
  --enable-api true \
  --enable-mcp true
```

| Flag                   | Env var              |
| ---------------------- | -------------------- |
| `--port` / `-p`        | `PORT`               |
| `--database-url`       | `DATABASE_URL`       |
| `--hostname`           | `HOSTNAME`           |
| `--https`              | `HTTPS`              |
| `--enable-api`         | `ENABLE_API`         |
| `--enable-mcp`         | `ENABLE_MCP`         |
| `--max-expiry-seconds` | `MAX_EXPIRY_SECONDS` |
| `--expiry-job-cron`    | `EXPIRY_JOB_CRON`    |

Flags take precedence over values set in a `.env` file.

### Creating a user

To create a user without starting the server, pass `--create-user`:

```bash
npx url-shortener-mcp --create-user
```

This prints a user ID and API key, then exits. **Store the key securely — it will not be shown again.**

---

## Getting Started (from source)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment

```bash
pnpm init-env
```

This copies `.env.example` to `.env`. Edit `.env` to configure your hostname, port, and other settings.

### 3. Run database migrations

```bash
pnpm db:migrate
```

### 4. Create a user

```bash
pnpm user:create
```

This outputs a user ID and API key. **Store the key securely — it will not be shown again.**

```
User created successfully.

  ID:  clxyz...
  Key: a1b2c3d4...

Store this key securely — it will not be shown again.
```

### 5. Start the server

**Development (with hot reload):**

```bash
pnpm dev
```

**Production:**

```bash
pnpm build && pnpm start
```

The server runs on `http://localhost:3000` by default.

---

## Docker

### Setup

```bash
pnpm init-env
```

Edit `.env` to configure your hostname, port, and other settings.

### Development

Hot reload via nodemon + ts-node:

```bash
docker compose up
```

### Production

Compiles TypeScript and runs the built output:

```bash
docker compose -f docker-compose.prod.yaml up
```

The database is persisted in a named Docker volume (`db_data`).

---

## MCP Configuration

Add this server to your MCP client (e.g. Claude Desktop, Cursor):

```json
{
  "mcpServers": {
    "url-shortener": {
      "url": "https://your-domain.com/mcp",
      "headers": {
        "Authorization": "Bearer <your-api-key>"
      }
    }
  }
}
```

Replace `https://your-domain.com` with the public URL of your deployed server.

---

## MCP Capabilities

### Tools

| Tool                | Description                                                                                                                                                                                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shorten_url`       | Create a shortened URL and return the short URL. Accepts an optional `tag` — a brief note about the URL's purpose (e.g. `"auth API docs"`, `"PR #42"`) — and an optional TTL, expiry date, or custom slug. When no slug is provided and the client supports [sampling](#sampling), the connected LLM will suggest one. |
| `bulk_shorten_urls` | Shorten up to 20 URLs in a single call. Each item accepts a `tag`. Returns per-item results so partial failures don't block the rest.                                                                                                                                                                                  |
| `search_urls`       | Search your URLs by `tag` substring and/or `longUrl` substring. Returns a minimal payload (slug, shortUrl, longUrl, tag, expiresAt) to keep context cost low. At least one filter must be provided.                                                                                                                    |
| `get_url`           | Get the full record and click count for a URL you own.                                                                                                                                                                                                                                                                 |
| `list_urls`         | List all your shortened URLs.                                                                                                                                                                                                                                                                                          |
| `get_stats`         | Return aggregate stats for your active URLs: total count and total `estimatedTokensSaved`. Useful for a quick summary without loading the full URL list.                                                                                                                                                               |
| `delete_url`        | Delete a shortened URL by slug.                                                                                                                                                                                                                                                                                        |
| `delete_all_urls`   | Delete all your shortened URLs.                                                                                                                                                                                                                                                                                        |

#### The `tag` field

`shorten_url` and `bulk_shorten_urls` accept an optional `tag` — a short, agent-written note describing a URL's purpose (e.g. `"stripe webhook docs"`, `"PR #99"`, `"staging deploy"`). Tags are stored alongside the URL and are searchable via `search_urls`. Setting a tag at creation time means you can retrieve any URL later by purpose without keeping the full URL in context.

#### The `estimatedTokensSaved` field

Each URL record includes `estimatedTokensSaved` — an estimate of how many tokens are saved per substitution when using the slug instead of the full URL (computed using a ~4 chars/token heuristic). This is a **per-use delta**, not a cumulative total. Token savings only materialise when the slug is reused across multiple turns; single-use URLs will cost more context overall than pasting the original URL inline. `get_stats` returns the sum across all active URLs.

### Resources

| URI             | Description                     |
| --------------- | ------------------------------- |
| `urls://all`    | All your shortened URLs as JSON |
| `urls://{slug}` | A single shortened URL by slug  |

### Prompts

| Prompt            | Args      | Description                                                                                                                                                                                |
| ----------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `suggest_shorten` | `longUrl` | Injects a user+assistant message pair into the conversation suggesting the user shorten the given URL. Designed to be invoked automatically by clients when a long URL appears in context. |

### Sampling

When a client supports the [MCP sampling](https://modelcontextprotocol.io/docs/concepts/sampling) capability and either `slug` or `tag` is missing from a `shorten_url` call, the server asks the connected LLM to suggest both in a single round-trip — returning a JSON object with a short, memorable slug and a brief purpose tag. If sampling is not supported or fails, a random slug is generated and `tag` is left unset.

---

## AI Agent Rules

Add the following rule to your `CLAUDE.md`, system prompt, or any file your AI client loads as instructions. It tells the agent to automatically load URLs into the shortener during research so they can be retrieved later without bloating the context window.

```
## URL Shortener

This MCP server is available for shortening and tracking URLs.

When you encounter or are given a URL during research, browsing, or tool use:
1. Shorten it immediately using the `shorten_url` tool.
2. Always set a `tag` — a short phrase describing the URL's purpose
   (e.g. "auth API reference", "PR #42", "deployment guide").
3. Use the returned short URL in all subsequent messages and tool calls
   instead of the full URL.

When you need to refer back to a URL:
- Use `search_urls` with a partial `tag` or `longUrl` fragment to find it.
- Do not keep full URLs in your context when a slug exists for them.

Tag examples:
  "stripe webhook docs"   — for https://stripe.com/docs/webhooks
  "main repo"             — for the project's GitHub URL
  "PR #99"                — for a specific pull request
  "staging deploy"        — for a deployment URL you need to revisit
```

This rule is particularly effective in long research sessions where many URLs appear — tagging at creation time means you can retrieve any link later with a natural-language search rather than scrolling back through the conversation.

---

## REST API

The server exposes a REST API under `/urls` using the same Bearer token auth. Short URLs resolve via public redirects at `/:slug`.

| Method   | Path           | Description                                                                                                                                                                          |
| -------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/urls`        | List all your shortened URLs. Supports `orderBy` (`createdAt`, `expiresAt`, `clicks`) and `order` (`asc`, `desc`) query params.                                                      |
| `POST`   | `/urls`        | Create a shortened URL. Body: `{ longUrl, slug?, ttl?, expiresAt?, tag? }`                                                                                                           |
| `POST`   | `/urls/bulk`   | Shorten up to 20 URLs in one request. Body: `{ urls: [...] }`. Returns **207** with a per-item `{ longUrl, success, data \| error }` array — partial failures don't abort the batch. |
| `GET`    | `/urls/search` | Search your URLs by `tag` substring and/or `longUrl` substring. At least one query param required. Returns a minimal payload (slug, shortUrl, longUrl, tag, expiresAt).              |
| `GET`    | `/urls/:slug`  | Get the full record for a URL you own.                                                                                                                                               |
| `DELETE` | `/urls/:slug`  | Delete a URL you own.                                                                                                                                                                |
| `DELETE` | `/urls`        | Delete all your URLs.                                                                                                                                                                |
| `GET`    | `/:slug`       | Redirect to the original URL (public, increments click count).                                                                                                                       |

---

## Environment Variables

| Variable                       | Default                | Description                                                                                                      |
| ------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `PORT`                         | `3000`                 | Server port                                                                                                      |
| `NODE_ENV`                     | `development`          | Node environment. Set to `production` in production deployments — the prod Docker image sets this automatically. |
| `DATABASE_URL`                 | `file:./prisma/dev.db` | SQLite database path                                                                                             |
| `HOSTNAME`                     | `localhost:3000`       | Hostname used when building short URLs                                                                           |
| `HTTPS`                        | `false`                | Use `https://` scheme in short URLs                                                                              |
| `MAX_EXPIRY_SECONDS`           | `86400`                | Maximum allowed TTL (default: 24 hours)                                                                          |
| `EXPIRY_JOB_CRON`              | `* * * * *`            | Cron schedule for cleaning up expired URLs                                                                       |
| `INACTIVE_USER_CUTOFF_SECONDS` | `86400`                | Automatically delete users inactive longer than this (default: 1 week)                                           |
| `INACTIVE_USER_JOB_CRON`       | `0 * * * *`            | Cron schedule for cleaning up inactive users (default: hourly)                                                   |
| `ENABLE_API`                   | `true`                 | Enable the REST API (`/urls`)                                                                                    |
| `ENABLE_MCP`                   | `true`                 | Enable the MCP server (`/mcp`)                                                                                   |

---

## Example Use Cases

Once configured, you can ask your LLM assistant:

> "Shorten https://github.com/anthropics/anthropic-sdk-python/blob/main/README.md with a custom slug `anthropic-py` that expires in 12 hours, then list all my active URLs."

The assistant will call `shorten_url` with `longUrl`, `slug`, and `ttl` set appropriately, then call `list_urls` to show you the results — returning something like `http://localhost:3000/anthropic-py`.

If no slug or tag is provided and sampling is supported, the assistant will automatically suggest both:

> "Shorten https://github.com/anthropics/anthropic-sdk-python/blob/main/README.md"

→ The server asks the LLM to suggest a slug (e.g. `anthropic-sdk-py`) and a tag (e.g. `anthropic python SDK readme`), then creates the short URL with both set.

You can retrieve a URL later by the tag you set at creation time:

> "Find the URL I saved for the Anthropic SDK docs."

→ The assistant calls `search_urls` with `tag: "anthropic"` and returns the matching short URL — no need to keep the full URL in context.

You can also check your overall usage:

> "How many URLs have I shortened and what's my total estimated token savings?"

→ The assistant calls `get_stats` and reports the aggregate count and `totalEstimatedTokensSaved` across all active URLs.

You can also read your URLs as resources:

> "Show me everything at `urls://all`"

→ The client fetches the `urls://all` resource and the assistant summarises your active links.

---

## Development

```bash
pnpm test           # run tests
pnpm test:coverage  # coverage report
pnpm check          # lint + format
pnpm db:studio      # open Prisma Studio
```
