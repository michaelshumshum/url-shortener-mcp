# url-shortener-mcp

![Coverage](https://michaelshumshum.github.io/url-shortener-mcp/badges.svg)

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

Shorten URLs, set expiry times, and manage your links directly from any MCP-compatible LLM client.

> **This server is designed to be deployed remotely.** Short URLs are only useful if they resolve publicly, and MCP clients connect over HTTP — so the server should run on a machine with a public hostname (e.g. a VPS, cloud VM, or PaaS). Set `HOSTNAME` to your public domain and `HTTPS=true` in production. Running it on `localhost` is fine for development, but short links won't be shareable outside your machine.

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

| Flag | Env var |
|------|---------|
| `--port` / `-p` | `PORT` |
| `--database-url` | `DATABASE_URL` |
| `--hostname` | `HOSTNAME` |
| `--https` | `HTTPS` |
| `--enable-api` | `ENABLE_API` |
| `--enable-mcp` | `ENABLE_MCP` |
| `--max-expiry-seconds` | `MAX_EXPIRY_SECONDS` |

Flags take precedence over values set in a `.env` file.

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

## MCP Capabilities

### Tools

| Tool | Description |
|------|-------------|
| `shorten_url` | Create a shortened URL with optional TTL, expiry date, or custom slug. When no slug is provided and the client supports [sampling](#sampling), the connected LLM will suggest one. |
| `bulk_shorten_urls` | Shorten up to 20 URLs in a single call. Returns per-item results so partial failures don't block the rest. |
| `get_url` | Get details and click count for a URL you own |
| `list_urls` | List all your shortened URLs |
| `delete_url` | Delete a shortened URL by slug |
| `delete_all_urls` | Delete all your shortened URLs |

### Resources

| URI | Description |
|-----|-------------|
| `urls://all` | All your shortened URLs as JSON |
| `urls://{slug}` | A single shortened URL by slug |

### Prompts

| Prompt | Args | Description |
|--------|------|-------------|
| `suggest_shorten` | `longUrl` | Injects a user+assistant message pair into the conversation suggesting the user shorten the given URL. Designed to be invoked automatically by clients when a long URL appears in context. |

### Sampling

When a client supports the [MCP sampling](https://modelcontextprotocol.io/docs/concepts/sampling) capability and no `slug` is provided to `shorten_url`, the server asks the connected LLM to suggest a short, memorable slug based on the destination URL. If sampling is not supported or fails, a random slug is generated instead.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DATABASE_URL` | `file:./prisma/dev.db` | SQLite database path |
| `HOSTNAME` | `localhost:3000` | Hostname used when building short URLs |
| `HTTPS` | `false` | Use `https://` scheme in short URLs |
| `MAX_EXPIRY_SECONDS` | `86400` | Maximum allowed TTL (default: 24 hours) |
| `EXPIRY_JOB_CRON` | `* * * * *` | Cron schedule for cleaning up expired URLs |
| `ENABLE_API` | `true` | Enable the REST API (`/urls`) |
| `ENABLE_MCP` | `true` | Enable the MCP server (`/mcp`) |

## Example Use Cases

Once configured, you can ask your LLM assistant:

> "Shorten https://github.com/anthropics/anthropic-sdk-python/blob/main/README.md with a custom slug `anthropic-py` that expires in 12 hours, then list all my active URLs."

The assistant will call `shorten_url` with `longUrl`, `slug`, and `ttl` set appropriately, then call `list_urls` to show you the results — returning something like `http://localhost:3000/anthropic-py`.

If no slug is provided and sampling is supported, the assistant will automatically suggest one:

> "Shorten https://github.com/anthropics/anthropic-sdk-python/blob/main/README.md"

→ The server asks the LLM to suggest a slug (e.g. `anthropic-sdk-py`), then creates the short URL using it.

You can also read your URLs as resources:

> "Show me everything at `urls://all`"

→ The client fetches the `urls://all` resource and the assistant summarises your active links.

## REST API

The server exposes a REST API under `/urls` using the same Bearer token auth. Short URLs resolve via public redirects at `/:slug`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/urls` | List all your shortened URLs. Supports `orderBy` (`createdAt`, `expiresAt`, `clicks`) and `order` (`asc`, `desc`) query params. |
| `POST` | `/urls` | Create a shortened URL. Body: `{ longUrl, slug?, ttl?, expiresAt? }` |
| `POST` | `/urls/bulk` | Shorten up to 20 URLs in one request. Body: `{ urls: [...] }`. Returns **207** with a per-item `{ longUrl, success, data \| error }` array — partial failures don't abort the batch. |
| `GET` | `/urls/:slug` | Get details for a URL you own |
| `DELETE` | `/urls/:slug` | Delete a URL you own |
| `DELETE` | `/urls` | Delete all your URLs |
| `GET` | `/:slug` | Redirect to the original URL (public, increments click count) |

## Development

```bash
pnpm test           # run tests
pnpm test:coverage  # coverage report
pnpm check          # lint + format
pnpm db:studio      # open Prisma Studio
```
