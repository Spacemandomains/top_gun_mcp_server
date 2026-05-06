import type { VercelRequest, VercelResponse } from "@vercel/node";

const STRIPE_PAYMENT_URL = process.env.STRIPE_PAYMENT_URL ||
  "https://buy.stripe.com/4gMfZh26i5R1dsE1gH9MY05";
const STRIPE_SECRET_KEY  = process.env.STRIPE_SECRET_KEY || "";
const USDC_WALLET        = process.env.USDC_WALLET_ADDRESS || "";
const USDC_ASSET         = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
const USDC_AMOUNT        = "1500000"; // $1.50 — USDC has 6 decimals
const SERVER_URL         = (process.env.SERVER_URL || "https://top-gun-mcp-server.vercel.app").replace(/\/$/, "");

function x402Requirements(resource: string) {
  return {
    scheme:            "exact",
    network:           "base",
    maxAmountRequired: USDC_AMOUNT,
    resource,
    description:       "Top GUN GEO-Lens Brand Visibility Audit",
    mimeType:          "application/json",
    payTo:             USDC_WALLET,
    maxTimeoutSeconds: 300,
    asset:             USDC_ASSET,
    extra:             { name: "USD Coin", version: "2" },
  };
}

async function verifyX402(payment: string, resource: string): Promise<boolean> {
  if (!USDC_WALLET) return false;
  try {
    const res  = await fetch("https://x402.org/facilitator/verify", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ payment, paymentRequirements: x402Requirements(resource) }),
    });
    const data = await res.json();
    return data.isValid === true;
  } catch { return false; }
}

async function settleX402(payment: string, resource: string): Promise<void> {
  if (!USDC_WALLET) return;
  await fetch("https://x402.org/facilitator/settle", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ payment, paymentRequirements: x402Requirements(resource) }),
  }).catch(() => {});
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Payment-Token, X-Payment");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method Not Allowed" });

  const query = (req.query.url || req.query.query) as string;
  if (!query) {
    return res.status(400).json({
      error:   "Missing required parameter: url",
      example: "/api/v1/audit?url=https://example.com",
    });
  }

  // ── Payment gate ────────────────────────────────────────
  const resource     = `${SERVER_URL}/api/v1/audit`;
  const x402Payment  = req.headers["x-payment"] as string | undefined;
  const paymentToken = req.headers["x-payment-token"] as string | undefined;

  // x402 USDC path
  if (x402Payment) {
    if (!USDC_WALLET) {
      return res.status(402).json({ error: "usdc_not_configured" });
    }
    const valid = await verifyX402(x402Payment, resource);
    if (!valid) {
      return res.status(402).json({ error: "invalid_x402_payment" });
    }
    void settleX402(x402Payment, resource);
  } else if (!paymentToken) {
    return res.status(402).json({
      error:     "Payment Required",
      price_usd: "$1.50",
      payment_options: [
        {
          method:       "stripe-mpp",
          payment_url:  STRIPE_PAYMENT_URL,
          instructions: [
            "1. Complete payment at payment_url",
            "2. Copy the session_id from the redirect URL",
            "3. Retry with header: X-Payment-Token: <session_id>",
          ],
        },
        ...(USDC_WALLET ? [{
          method:       "x402",
          network:      "base",
          asset:        "USDC",
          amount:       "1.50",
          payTo:        USDC_WALLET,
          requirements: x402Requirements(resource),
          instructions: "Pay 1.50 USDC on Base, then retry with header: X-Payment: <encoded_payload>",
        }] : []),
      ],
    });
  } else if (STRIPE_SECRET_KEY) {
    // ── Verify Stripe session ──────────────────
    try {
      const Stripe  = (await import("stripe")).default;
      const stripe  = new Stripe(STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.retrieve(paymentToken);
      if (session.payment_status !== "paid") {
        return res.status(402).json({
          error:          "Payment not completed",
          payment_status: session.payment_status,
        });
      }
    } catch {
      return res.status(402).json({ error: "Invalid or expired payment token" });
    }
  }

  // ── Run the GEO audit ───────────────────────────────────
  try {
    const audit = await runGeoAudit(query);
    return res.status(200).json(audit);
  } catch (e) {
    return res.status(500).json({ error: "Audit failed", details: String(e) });
  }
}

// ─────────────────────────────────────────────────────────
//  GEO AUDIT ENGINE
//  Queries multiple LLM search endpoints and measures
//  how prominently the brand/topic is mentioned.
// ─────────────────────────────────────────────────────────
async function runGeoAudit(query: string) {
  const startTime = Date.now();

  // Query sources — Brave Search and Exa for LLM-indexed content
  const [braveResults, exaResults] = await Promise.allSettled([
    searchBrave(query),
    searchExa(query),
  ]);

  const brave = braveResults.status === "fulfilled" ? braveResults.value : [];
  const exa   = exaResults.status   === "fulfilled" ? exaResults.value   : [];

  const allResults = [...brave, ...exa];

  // Score: how many of the top results mention the query brand
  const mentionCount = allResults.filter(r =>
    r.title?.toLowerCase().includes(query.toLowerCase()) ||
    r.snippet?.toLowerCase().includes(query.toLowerCase())
  ).length;

  const totalResults    = allResults.length;
  const visibilityScore = totalResults > 0
    ? Math.round((mentionCount / totalResults) * 100)
    : 0;

  const scoreLabel =
    visibilityScore >= 75 ? "Strong"  :
    visibilityScore >= 40 ? "Moderate":
    visibilityScore >= 15 ? "Weak"    : "Not Found";

  const topCitations = allResults
    .slice(0, 5)
    .map(r => r.url)
    .filter(Boolean) as string[];

  const llmIndexStatus =
    visibilityScore >= 40
      ? "Indexed — brand appears in LLM-cited sources"
      : visibilityScore > 0
      ? "Partial — limited presence in LLM-cited sources"
      : "Not indexed — brand not found in LLM search results";

  return {
    query,
    visibility_score:  `${visibilityScore}/100 (${scoreLabel})`,
    score_raw:         visibilityScore,
    score_label:       scoreLabel,
    top_citations:     topCitations,
    llm_index_status:  llmIndexStatus,
    sources_checked:   totalResults,
    brand_mentions:    mentionCount,
    audit_time_ms:     Date.now() - startTime,
    provider:          "Top GUN GEO-Lens v1.0",
    recommendations:   getRecommendations(visibilityScore, query),
    audited_at:        new Date().toISOString(),
  };
}

async function searchBrave(query: string): Promise<Array<{ title?: string; snippet?: string; url?: string }>> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return [];
  try {
    const res  = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
      { headers: { "Accept": "application/json", "X-Subscription-Token": key } }
    );
    const data = await res.json();
    return (data.web?.results || []).map((r: any) => ({
      title:   r.title,
      snippet: r.description,
      url:     r.url,
    }));
  } catch { return []; }
}

async function searchExa(query: string): Promise<Array<{ title?: string; snippet?: string; url?: string }>> {
  const key = process.env.EXA_API_KEY;
  if (!key) return [];
  try {
    const res  = await fetch("https://api.exa.ai/search", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body:    JSON.stringify({ query, numResults: 10, useAutoprompt: true }),
    });
    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      title:   r.title,
      snippet: r.text?.substring(0, 200),
      url:     r.url,
    }));
  } catch { return []; }
}

function getRecommendations(score: number, query: string): string[] {
  if (score >= 75) return [
    `${query} has strong LLM visibility — focus on maintaining freshness`,
    "Publish regular content that LLM training crawlers index",
    "Monitor for sentiment shifts in citations",
  ];
  if (score >= 40) return [
    `${query} has moderate visibility — opportunity to strengthen presence`,
    "Increase authoritative backlinks from LLM-indexed domains",
    "Create structured data markup (schema.org) on key pages",
    "Publish thought leadership content on high-authority platforms",
  ];
  return [
    `${query} has low LLM visibility — significant GEO work needed`,
    "Build presence on Wikipedia, Wikidata, and structured knowledge bases",
    "Get cited by authoritative sources in your industry",
    "Create an llms.txt file at your domain root",
    "Ensure your site is crawlable and not blocked by robots.txt for AI crawlers",
    "Publish consistently on platforms that LLMs are trained on",
  ];
}
