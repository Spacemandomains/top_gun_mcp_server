import type { VercelRequest, VercelResponse } from "@vercel/node";

const STRIPE_PAYMENT_URL = process.env.STRIPE_PAYMENT_URL ||
  "https://buy.stripe.com/4gMfZh26i5R1dsE1gH9MY05";
const STRIPE_SECRET_KEY  = process.env.STRIPE_SECRET_KEY || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Payment-Token");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method Not Allowed" });

  const query = req.query.query as string;
  if (!query) {
    return res.status(400).json({
      error:   "Missing required parameter: query",
      example: "/api/v1/audit?query=YourBrandName",
    });
  }

  // ── Payment gate ────────────────────────────────────────
  const paymentToken = req.headers["x-payment-token"] as string | undefined;

  if (!paymentToken) {
    return res.status(402).json({
      error:       "Payment Required",
      amount:      1.50,
      payment_url: STRIPE_PAYMENT_URL,
      instructions: [
        "1. Complete payment at the payment_url above",
        "2. Copy the session_id from the redirect URL",
        "3. Retry this request with header: X-Payment-Token: <session_id>",
      ],
    });
  }

  // ── Verify Stripe session (if key is configured) ────────
  if (STRIPE_SECRET_KEY) {
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
