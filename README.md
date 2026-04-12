# TOP GUN — GEO-Lens Audit API

Brand visibility auditing across Large Language Models.

Audit how your brand, product, or company is being surfaced
and cited by AI systems — and get recommendations to improve it.

**$1.50 per audit** via Stripe.

---

## What it does

Searches LLM-indexed sources (via Brave Search and Exa) for your brand or query,
measures how prominently it appears, and returns:

- Visibility score (0–100)
- Score label: Strong / Moderate / Weak / Not Found
- Top citation URLs
- LLM index status
- Actionable GEO recommendations

---

## API

```
GET /api/v1/audit?query=YourBrand
```

**Without payment** → returns HTTP 402 with Stripe payment URL

**With payment** → add header `X-Payment-Token: <stripe_session_id>`

---

## Deploy

```bash
npm i -g vercel
vercel
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_PAYMENT_URL
vercel env add BRAVE_SEARCH_API_KEY   # optional
vercel env add EXA_API_KEY            # optional
vercel --prod
```

---

## Discovery files

| URL | Purpose |
|-----|---------|
| `/ai-agents.json` | AI agent discovery |
| `/openapi.json`   | OpenAPI 3.1 spec  |

---

## Built by

Wilfred L. Lee Jr. — 2026
