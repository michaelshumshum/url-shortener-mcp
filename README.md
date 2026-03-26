# url-shortener-mcp

A URL shortener exposed as an [MCP](https://modelcontextprotocol.io/) server. Built with Express, Prisma, TypeScript, and SQLite.

Shorten URLs, set expiry times, and manage your links directly from any MCP-compatible LLM client.

## Getting Started

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
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer <your-api-key>"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `shorten_url` | Create a shortened URL with optional TTL, expiry date, or custom slug |
| `get_url` | Get details and click count for a URL you own |
| `list_urls` | List all your shortened URLs |
| `delete_url` | Delete a shortened URL by slug |
| `delete_all_urls` | Delete all your shortened URLs |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DATABASE_URL` | `file:./prisma/dev.db` | SQLite database path |
| `HOSTNAME` | `localhost:3000` | Hostname used when building short URLs |
| `HTTPS` | `false` | Use `https://` scheme in short URLs |
| `MAX_EXPIRY_SECONDS` | `86400` | Maximum allowed TTL (default: 24 hours) |
| `EXPIRY_JOB_CRON` | `* * * * *` | Cron schedule for cleaning up expired URLs |

## Example Use Case

Once configured, you can ask your LLM assistant:

> "Shorten https://github.com/anthropics/anthropic-sdk-python/blob/main/README.md with a custom slug `anthropic-py` that expires in 12 hours, then list all my active URLs."

The assistant will call `shorten_url` with `longUrl`, `slug`, and `ttl` set appropriately, then call `list_urls` to show you the results — returning something like `http://localhost:3000/anthropic-py`.

## REST API

The server also exposes a traditional REST API under `/urls` using the same Bearer token auth, and redirects short URLs at `/:slug`.

## Development

```bash
pnpm test           # run tests
pnpm test:coverage  # coverage report
pnpm check          # lint + format
pnpm db:studio      # open Prisma Studio
```
