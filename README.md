# TOP GUN GEO-Lens — MCP Brand Visibility Auditor

[![Publish to MCP Registry](https://github.com/Spacemandomains/top_gun_mcp_server/actions/workflows/publish-mcp.yml/badge.svg)](https://github.com/Spacemandomains/top_gun_mcp_server/actions/workflows/publish-mcp.yml)

> **For AI Agents:** This is an MCP server. Connect it, call its tools, and instantly know whether any brand shows up in AI search, answer engines, and LLM-style recommendations — or stays invisible while competitors get cited.

---

## What This Does

TOP GUN GEO-Lens measures how visible a brand is across the sources that power AI answers: Brave AI Search, Exa, and other engines behind ChatGPT, Perplexity, and Claude.

- **Brand visibility audit** — How often a brand appears when people ask questions in its category
- **Quick visibility check** — A fast signal in seconds, before committing to the full audit
- **Competitor benchmarking** — How the brand stacks up against rivals in AI answers
- **LLM index status** — Whether the brand's content is indexed and reachable by AI systems
- **Citations & evidence** — Real URLs and snippets showing exactly where the brand appears (or doesn't)
- **Recommendations** — Concrete steps to improve AI visibility

### Score bands

| Score | Label |
|------:|-------|
| 0–100 | Strong (≥ 70) / Moderate (40–69) / Weak (1–39) / Not Visible (0) |

## MCP Tools

### `geo_audit` — $1.50 USDC

The full audit. Provide a `brand`, a `query` (or category), and optional `competitors`.

Returns: visibility score, citations, competitor comparison, LLM index status, recommendations.

### `geo_quick_check` — $0.50 USDC

A fast, cheaper signal. Provide a `brand` and `query`.

Returns: score, label, top citations, quick tips.

## Usage

Connect this MCP server to Claude Desktop, Cursor, or any MCP-compatible client.

```json
{
  "mcpServers": {
    "top-gun-geo-lens": {
      "command": "npx",
      "args": ["-y", "top-gun-mcp"]
    }
  }
}
```

## Pricing

Each tool call is a paid x402 call on Base mainnet (USDC):

| Tool | Price |
|------|-------|
| `geo_quick_check` | $0.50 USDC |
| `geo_audit` | $1.50 USDC |

Pay-per-call: the agent sends an x402 payment with the request. No subscription, no API key needed to call the tools.

## Local Development

```bash
npm install
npm run build
npm start
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BRAVE_SEARCH_API_KEY` | Brave Search API key (at least one search key required) |
| `EXA_API_KEY` | Exa API key |
| `STRIPE_SECRET_KEY` | Stripe secret key (for payment verification) |
| `STRIPE_PAYMENT_URL` | Payment link for full audit ($1.50 USDC) |
| `STRIPE_QUICK_CHECK_PAYMENT_URL` | Payment link for quick check ($0.50 USDC) |
| `USDC_WALLET_ADDRESS` | USDC wallet address for on-chain payment display |
| `TOP_GUN_API_URL` | Base URL of the deployed API |

> **Payment model:** A paid call is verified before the tool runs (x402) or via a Stripe payment token (`x-payment-token` header). The user pays $0.50 or $1.50 USDC per call, depending on the tool.

## Architecture

```
┌─────────────┐     MCP      ┌──────────────┐
│   Claude /  │ ───────────▶ │  TOP GUN MCP │
│   Cursor /  │              │    Server    │
│  AI Agent   │ ◀─────────── │  (this repo) │
└─────────────┘  JSON-RPC    └──────┬───────┘
                                    │
                     ┌──────────────┼──────────────┐
                     ▼              ▼              ▼
              Brave Search     Exa Search     Stripe / x402
              (AI answers)   (neural)      (payments)
```

## License

MIT
