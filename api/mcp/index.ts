import type { VercelRequest, VercelResponse } from "@vercel/node";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import Stripe from "stripe";
import { randomUUID } from "crypto";

// ─────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────
const SERVER_URL        = (process.env.SERVER_URL || "https://top-gun-live.vercel.app").replace(/\/$/, "");
const STRIPE_KEY        = process.env.STRIPE_SECRET_KEY  || "";
const STRIPE_PAYMENT_URL= process.env.STRIPE_PAYMENT_URL || "https://buy.stripe.com/4gMfZh26i5R1dsE1gH9MY05";
const BRAVE_KEY         = process.env.BRAVE_SEARCH_API_KEY || "";
const EXA_KEY           = process.env.EXA_API_KEY          || "";

const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;

// Tool price in cents
const AUDIT_PRICE_CENTS = 150; // $1.50

// ─────────────────────────────────────────────
//  GEO AUDIT ENGINE  (shared with REST endpoint)
// ─────────────────────────────────────────────
async function searchBrave(query: string) {
  if (!BRAVE_KEY) return [];
  try {
    const res  = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
      { headers: { "Accept": "application/json", "X-Subscription-Token": BRAVE_KEY } }
    );
    const data = await res.json();
    return (data.web?.results || []).map((r: any) => ({
      title: r.title, snippet: r.description, url: r.url,
    }));
  } catch { return []; }
}

async function searchExa(query: string) {
  if (!EXA_KEY) return [];
  try {
    const res  = await fetch("https://api.exa.ai/search", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-api-key": EXA_KEY },
      body:    JSON.stringify({ query, numResults: 10, useAutoprompt: true }),
    });
    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      title: r.title, snippet: r.text?.substring(0, 200), url: r.url,
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
    "Ensure your site is not blocking AI crawlers in robots.txt",
    "Publish consistently on platforms that LLMs are trained on",
  ];
}

async function runGeoAudit(query: string) {
  const startTime = Date.now();

  const [braveResults, exaResults] = await Promise.allSettled([
    searchBrave(query),
    searchExa(query),
  ]);

  const brave = braveResults.status === "fulfilled" ? braveResults.value : [];
  const exa   = exaResults.status   === "fulfilled" ? exaResults.value   : [];
  const all   = [...brave, ...exa];

  const mentionCount = all.filter(r =>
    r.title?.toLowerCase().includes(query.toLowerCase()) ||
    r.snippet?.toLowerCase().includes(query.toLowerCase())
  ).length;

  const totalResults    = all.length;
  const visibilityScore = totalResults > 0
    ? Math.round((mentionCount / totalResults) * 100)
    : 0;

  const scoreLabel =
    visibilityScore >= 75 ? "Strong"   :
    visibilityScore >= 40 ? "Moderate" :
    visibilityScore >= 15 ? "Weak"     : "Not Found";

  const topCitations = all.slice(0, 5).map(r => r.url).filter(Boolean) as string[];

  const llmIndexStatus =
    visibilityScore >= 40 ? "Indexed — brand appears in LLM-cited sources"      :
    visibilityScore >  0  ? "Partial — limited presence in LLM-cited sources"    :
                            "Not indexed — brand not found in LLM search results";

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

// ─────────────────────────────────────────────
//  STRIPE MPP PAYMENT GATE
// ─────────────────────────────────────────────
async function requirePayment(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (!stripe) return true; // dev mode — no key configured

  const token = req.headers["x-payment-token"] as string | undefined;

  if (!token) {
    const intent = await stripe.paymentIntents.create({
      amount:   AUDIT_PRICE_CENTS,
      currency: "usd",
      metadata: { mcp_tool: "audit_brand_visibility", server: "top-gun-geo-lens" },
    });
    res.status(402).json({
      error:            "payment_required",
      payment_protocol: "stripe-mpp",
      price_usd:        "$1.50",
      payment_intent: {
        id:            intent.id,
        client_secret: intent.client_secret,
        amount:        intent.amount,
        currency:      intent.currency,
      },
      stripe_checkout: STRIPE_PAYMENT_URL,
      instructions:    "Complete payment, then retry with header: X-Payment-Token: <payment_intent_id>",
    });
    return false;
  }

  try {
    const intent = await stripe.paymentIntents.retrieve(token);
    if (intent.status !== "succeeded") {
      res.status(402).json({ error: "payment_not_completed", status: intent.status });
      return false;
    }
    return true;
  } catch {
    // Also try as a Stripe Checkout session ID (from the web UI flow)
    try {
      const session = await stripe.checkout.sessions.retrieve(token);
      if (session.payment_status !== "paid") {
        res.status(402).json({ error: "payment_not_completed" });
        return false;
      }
      return true;
    } catch {
      res.status(402).json({ error: "invalid_payment_token" });
      return false;
    }
  }
}

// ─────────────────────────────────────────────
//  SERVER CARD  (discovery document)
// ─────────────────────────────────────────────
const serverCard = {
  name:         "Top GUN — GEO-Lens Audit API",
  description:  "Audits brand visibility across Large Language Models. Discover how your brand, product, or company is being surfaced and cited by AI systems. Returns a visibility score, top citation URLs, LLM index status, and actionable GEO recommendations.",
  version:      "1.0.0",
  url:          SERVER_URL,
  mcp_endpoint: `${SERVER_URL}/api/mcp`,
  transport:    ["streamable-http"],
  spec_version: "2025-03-26",
  capabilities: { tools: true, payments: { protocol: "stripe-mpp" } },
  tools: [
    {
      name:        "audit_brand_visibility",
      price:       "$1.50",
      description: "Audit how a brand or topic is represented and cited across LLM-indexed sources. Returns visibility score, citations, index status, and improvement recommendations.",
    },
  ],
  use_cases: [
    "Brand managers checking LLM visibility before campaigns",
    "SEO and GEO professionals auditing client presence in AI search",
    "Marketers comparing brand visibility to competitors",
    "Agents that help users improve their AI search presence",
    "Product teams monitoring how their product is described by AI",
  ],
  discovery: {
    server_card: `${SERVER_URL}/api/mcp/.well-known/server-card.json`,
    llms_txt:    `${SERVER_URL}/llms.txt`,
    agent_card:  `${SERVER_URL}/.well-known/agent-card.json`,
  },
};

// ─────────────────────────────────────────────
//  MCP HANDLER  (Vercel serverless)
// ─────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Payment-Token, mcp-session-id"
  );

  if (req.method === "OPTIONS") return res.status(200).end();

  // ── Serve server card at well-known path ────
  const path = (req.url || "").split("?")[0];
  if (path.endsWith("/.well-known/server-card.json") ||
      path.endsWith("/server-card.json")) {
    return res.status(200).json(serverCard);
  }

  // ── Only POST for MCP ───────────────────────
  if (req.method === "GET") {
    return res.status(200).json({
      info:    "Top GUN GEO-Lens MCP Server",
      connect: `POST ${SERVER_URL}/api/mcp`,
      docs:    `${SERVER_URL}/llms.txt`,
      card:    serverCard,
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // ── Payment gate for audit tool ─────────────
  const toolName: string | undefined =
    req.body?.method === "tools/call" ? req.body?.params?.name : undefined;

  if (toolName === "audit_brand_visibility") {
    const ok = await requirePayment(req, res);
    if (!ok) return;
  }

  // ── Build stateless MCP server ───────────────
  const mcp = new McpServer({ name: "top-gun-geo-lens", version: "1.0.0" });

  mcp.tool(
    "audit_brand_visibility",
    [
      "Audits how a brand, product, or company is represented and cited across Large Language Model search results.",
      "Searches LLM-indexed sources (Brave Search + Exa) and measures how prominently the query appears.",
      "Returns: visibility score out of 100, score label (Strong/Moderate/Weak/Not Found), top citation URLs, LLM index status, sources checked, and actionable GEO recommendations.",
      "Call this when: a user wants to know if their brand appears in AI search results, an agent is auditing a client's LLM presence, comparing brand visibility to a competitor, or checking if a product is being described accurately by AI.",
      "COST: $1.50 via Stripe MPP. Server returns HTTP 402 with payment_intent if X-Payment-Token header is missing.",
    ].join(" "),
    {
      query: z.string().describe(
        "The brand name, product, company, or topic to audit for LLM visibility. Examples: 'Nike', 'Notion', 'Claude AI', 'Hawaii surf schools'"
      ),
    },
    async ({ query }) => ({
      content: [{
        type: "text",
        text: JSON.stringify(await runGeoAudit(query), null, 2),
      }],
    })
  );

  const transport = new StreamableHTTPServerTransport({});

  await mcp.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
