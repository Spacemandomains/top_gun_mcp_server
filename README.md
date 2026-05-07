# TOP GUN GEO-Lens — MCP Brand Visibility Auditor

> **For AI Agents:** This is an MCP server. Connect it, call its tools, and instantly know whether any brand is visible to LLMs and AI search engines — with actionable recommendations to improve it.

---

## What This Does

TOP GUN GEO-Lens measures how visible a brand is across the sources that power AI answers: Brave AI Search, Exa neural search, and LLM-indexed content. It returns a scored report with citations, index status, and concrete GEO (Generative Engine Optimization) recommendations.

Use it when an agent needs to answer questions like:
- *"Is [brand] showing up in AI-powered search results?"*
- *"Why isn't [brand] being recommended by AI assistants?"*
- *"What should [brand] do to rank higher in LLM outputs?"*

---

## Tools

### `geo_quick_check` — $0.05 USDC
Fast snapshot of brand visibility in AI-indexed sources.

| Output | Detail |
|--------|--------|
| Visibility score | 0–100 |
| Score label | Strong / Moderate / Weak / Not Found |
| Top 3 citations | URL, title, snippet, source |
| 2 quick tips | Actionable GEO improvements |

```json
{
  "tool": "geo_quick_check",
  "query": "Stripe",
  "paymentToken": "<stripe-session-id>"
}
```

---

### `audit_brand` — $1.50 USDC
Full brand visibility audit using dual search (Brave + Exa, 10 results each).

| Output | Detail |
|--------|--------|
| Visibility score | 0–100 |
| Score label | Strong / Moderate / Weak / Not Found |
| Top 5 citations | URL, title, snippet, source, position |
| LLM index status | Brave indexed, Exa indexed, estimated reach |
| 6 GEO recommendations | Prioritized, actionable improvements |

```json
{
  "tool": "audit_brand",
  "query": "Anthropic",
  "paymentToken": "<stripe-session-id>"
}
```

---

### `get_payment_info` — Free
Returns payment URLs and USDC wallet address for both tiers. **Call this first** if you don't have a payment token.

```json
{
  "tool": "get_payment_info"
}
```

---

## Agent Workflow

```
1. Call get_payment_info          → get payment URLs
2. Direct user to payment link    → user pays $0.05 or $1.50 USDC
3. User provides Stripe session ID
4. Call geo_quick_check or audit_brand with paymentToken
5. Parse structured results       → score, citations, recommendations
```

If `paymentToken` is omitted, the tool returns a payment link instead of results — no error thrown.

---

## Connecting to Claude / MCP Clients

Add to your `claude_desktop_config.json` (or equivalent MCP config):

```json
{
  "mcpServers": {
    "top-gun-geo-lens": {
      "command": "node",
      "args": ["/path/to/top_gun_mcp_server/dist/index.js"],
      "env": {
        "STRIPE_SECRET_KEY": "sk_live_...",
        "STRIPE_PAYMENT_URL": "https://buy.stripe.com/...",
        "STRIPE_QUICK_CHECK_PAYMENT_URL": "https://buy.stripe.com/...",
        "BRAVE_SEARCH_API_KEY": "BSA...",
        "EXA_API_KEY": "...",
        "USDC_WALLET_ADDRESS": "0x..."
      }
    }
  }
}
```

---

## Setup

```bash
git clone https://github.com/spacemandomains/top_gun_mcp_server
cd top_gun_mcp_server
npm install
cp .env.example .env        # fill in your keys
npm run build
npm start
```

**Required env vars:**

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key for payment verification |
| `STRIPE_PAYMENT_URL` | Yes | Payment link for full audit ($1.50 USDC) |
| `STRIPE_QUICK_CHECK_PAYMENT_URL` | Yes | Payment link for quick check ($0.05 USDC) |
| `BRAVE_SEARCH_API_KEY` | No* | Brave Search API key |
| `EXA_API_KEY` | No* | Exa neural search API key |
| `USDC_WALLET_ADDRESS` | No | USDC wallet address shown to payers |

*At least one search API key is required for results.

---

## Pricing Summary

| Tool | Cost | Best For |
|------|------|----------|
| `geo_quick_check` | $0.05 USDC | Quick sanity check, high-volume workflows |
| `audit_brand` | $1.50 USDC | Deep audit, client reports, GEO strategy |

---

## Tech Stack

- **Runtime:** Node.js ≥ 18, TypeScript
- **Protocol:** [Model Context Protocol](https://modelcontextprotocol.io) (`@modelcontextprotocol/sdk`)
- **Search:** Brave Search API + Exa neural search
- **Payments:** Stripe + USDC on-chain
- **Deploy:** Vercel-ready

---

## For AI Agents — Key Facts

- Transport: `stdio`
- No streaming — all responses are single text blocks
- Scores range 0–100; `>= 70` = Strong, `40–69` = Moderate, `1–39` = Weak, `0` = Not Found
- Payment tokens are Stripe Checkout Session IDs (format: `cs_live_...`)
- Calling any paid tool without a token returns a structured payment prompt, not an error
- `audit_brand` is strictly more detailed than `geo_quick_check`; use quick_check for speed/cost, audit for depth
