import type { VercelRequest, VercelResponse } from "@vercel/node";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import Stripe from "stripe";

// ─────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────
const SERVER_URL        = (process.env.SERVER_URL || "https://top-gun-mcp-server.vercel.app").replace(/\/$/, "");
const STRIPE_KEY        = process.env.STRIPE_SECRET_KEY  || "";
const STRIPE_PAYMENT_URL= process.env.STRIPE_PAYMENT_URL || "https://buy.stripe.com/4gMfZh26i5R1dsE1gH9MY05";
const BRAVE_KEY         = process.env.BRAVE_SEARCH_API_KEY || "";
const EXA_KEY           = process.env.EXA_API_KEY          || "";

const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;

const AUDIT_PRICE_CENTS = 150;
const AUDIT_PRICE_USD   = "1.50";
const AUDIT_PRICE_LABEL = "$1.50";
const AUDIT_PRICE_USDC  = "1500000";

const USDC_WALLET = process.env.USDC_WALLET_ADDRESS || "";
const USDC_ASSET  = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const fullDescription = [
  "Brand visibility auditing across Large Language Models.",
  "Audit how your brand, product, or company is being surfaced and cited by AI systems — and get recommendations to improve it.",
  "Searches LLM-indexed sources via Brave Search and Exa for your brand or query, measures how prominently it appears, and returns a visibility score from 0–100, score label Strong / Moderate / Weak / Not Found, top citation URLs, LLM index status, and actionable GEO recommendations."
].join(" ");

const pricedTool = {
  name: "audit_brand_visibility",
  title: "Audit Brand Visibility",
  description: fullDescription,
  inputSchema: {
    type: "object",
    required: ["query"],
    properties: {
      query: {
        type: "string",
        description: "The brand, product, company, or topic to audit for LLM visibility."
      }
    }
  },
  price: AUDIT_PRICE_LABEL,
  pricing: {
    type: "fixed",
    amount: AUDIT_PRICE_USD,
    currency: "USD",
    display: AUDIT_PRICE_LABEL,
    protocols: ["mpp-tempo-1", "stripe-mpp", "x402"]
  },
  "x-payment-info": {
    pricingMode: "fixed",
    price: AUDIT_PRICE_USD,
    currency: "USD",
    protocols: ["mpp-tempo-1"]
  },
  "x-payment": {
    mode: "fixed",
    amount: AUDIT_PRICE_USD,
    currency: "USD",
    protocols: ["mpp-tempo-1"]
  }
};

function x402Requirements(resource: string) {
  return {
    scheme: "exact",
    network: "base",
    maxAmountRequired: AUDIT_PRICE_USDC,
    resource,
    description: "Top GUN GEO-Lens Brand Visibility Audit",
    mimeType: "application/json",
    payTo: USDC_WALLET,
    maxTimeoutSeconds: 300,
    asset: USDC_ASSET,
    extra: { name: "USD Coin", version: "2" },
  };
}

async function verifyX402(payment: string, resource: string): Promise<boolean> {
  if (!USDC_WALLET) return false;
  try {
    const res = await fetch("https://x402.org/facilitator/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment, paymentRequirements: x402Requirements(resource) }),
    });
    const data = await res.json();
    return data.isValid === true;
  } catch { return false; }
}

async function settleX402(payment: string, resource: string): Promise<void> {
  if (!USDC_WALLET) return;
  await fetch("https://x402.org/facilitator/settle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payment, paymentRequirements: x402Requirements(resource) }),
  }).catch(() => {});
}

async function searchBrave(query: string) {
  if (!BRAVE_KEY) return [];
  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`, {
      headers: { "Accept": "application/json", "X-Subscription-Token": BRAVE_KEY }
    });
    const data = await res.json();
    return (data.web?.results || []).map((r: any) => ({ title: r.title, snippet: r.description, url: r.url }));
  } catch { return []; }
}

async function searchExa(query: string) {
  if (!EXA_KEY) return [];
  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": EXA_KEY },
      body: JSON.stringify({ query, numResults: 10, useAutoprompt: true }),
    });
    const data = await res.json();
    return (data.results || []).map((r: any) => ({ title: r.title, snippet: r.text?.substring(0, 200), url: r.url }));
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
  const [braveResults, exaResults] = await Promise.allSettled([searchBrave(query), searchExa(query)]);
  const brave = braveResults.status === "fulfilled" ? braveResults.value : [];
  const exa = exaResults.status === "fulfilled" ? exaResults.value : [];
  const all = [...brave, ...exa];
  const mentionCount = all.filter(r =>
    r.title?.toLowerCase().includes(query.toLowerCase()) ||
    r.snippet?.toLowerCase().includes(query.toLowerCase())
  ).length;
  const totalResults = all.length;
  const visibilityScore = totalResults > 0 ? Math.round((mentionCount / totalResults) * 100) : 0;
  const scoreLabel = visibilityScore >= 75 ? "Strong" : visibilityScore >= 40 ? "Moderate" : visibilityScore >= 15 ? "Weak" : "Not Found";
  const topCitations = all.slice(0, 5).map(r => r.url).filter(Boolean) as string[];
  const llmIndexStatus = visibilityScore >= 40 ? "Indexed — brand appears in LLM-cited sources" : visibilityScore > 0 ? "Partial — limited presence in LLM-cited sources" : "Not indexed — brand not found in LLM search results";
  return {
    query,
    visibility_score: `${visibilityScore}/100 (${scoreLabel})`,
    score_raw: visibilityScore,
    score_label: scoreLabel,
    top_citations: topCitations,
    llm_index_status: llmIndexStatus,
    sources_checked: totalResults,
    brand_mentions: mentionCount,
    audit_time_ms: Date.now() - startTime,
    provider: "Top GUN GEO-Lens v1.0",
    recommendations: getRecommendations(visibilityScore, query),
    audited_at: new Date().toISOString(),
  };
}

async function requirePayment(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  const resource = `${SERVER_URL}/api/mcp`;
  const x402Payment = req.headers["x-payment"] as string | undefined;
  if (x402Payment) {
    if (!USDC_WALLET) { res.status(402).json({ error: "usdc_not_configured" }); return false; }
    const valid = await verifyX402(x402Payment, resource);
    if (!valid) { res.status(402).json({ error: "invalid_x402_payment" }); return false; }
    void settleX402(x402Payment, resource);
    return true;
  }
  if (!stripe) return true;
  const token = req.headers["x-payment-token"] as string | undefined;
  if (!token) {
    const intent = await stripe.paymentIntents.create({
      amount: AUDIT_PRICE_CENTS,
      currency: "usd",
      metadata: { mcp_tool: "audit_brand_visibility", server: "top-gun-geo-lens" },
    });
    res.status(402).json({
      error: "payment_required",
      price_usd: AUDIT_PRICE_LABEL,
      tool: pricedTool,
      payment_options: [
        {
          method: "stripe-mpp",
          payment_protocol: "stripe-mpp",
          amount: AUDIT_PRICE_USD,
          currency: "USD",
          payment_intent: { id: intent.id, client_secret: intent.client_secret, amount: intent.amount, currency: intent.currency },
          stripe_checkout: STRIPE_PAYMENT_URL,
          instructions: "Complete payment, then retry with header: X-Payment-Token: <payment_intent_id>",
        },
        ...(USDC_WALLET ? [{ method: "x402", network: "base", asset: "USDC", amount: AUDIT_PRICE_USD, payTo: USDC_WALLET, requirements: x402Requirements(resource), instructions: "Pay 1.50 USDC on Base, then retry with header: X-Payment: <encoded_payload>" }] : []),
      ],
    });
    return false;
  }
  try {
    const intent = await stripe.paymentIntents.retrieve(token);
    if (intent.status !== "succeeded") { res.status(402).json({ error: "payment_not_completed", status: intent.status }); return false; }
    return true;
  } catch {
    try {
      const session = await stripe.checkout.sessions.retrieve(token);
      if (session.payment_status !== "paid") { res.status(402).json({ error: "payment_not_completed" }); return false; }
      return true;
    } catch { res.status(402).json({ error: "invalid_payment_token" }); return false; }
  }
}

const serverCard = {
  name: "Top GUN GEO-Lens API",
  description: fullDescription,
  version: "1.0.0",
  url: SERVER_URL,
  icon: `${SERVER_URL}/top-gun-favicon.png`,
  logo: `${SERVER_URL}/top-gun-favicon.png`,
  mcp_endpoint: `${SERVER_URL}/api/mcp`,
  transport: ["streamable-http"],
  spec_version: "2025-03-26",
  capabilities: { tools: true, resources: false, payments: { protocols: ["mpp-tempo-1", "stripe-mpp", "x402"] } },
  resources: [],
  tools: [pricedTool],
  use_cases: [
    "Brand managers checking LLM visibility before campaigns",
    "SEO and GEO professionals auditing client presence in AI search",
    "Marketers comparing brand visibility to competitors",
    "Agents that help users improve their AI search presence",
    "Product teams monitoring how their product is described by AI",
  ],
  discovery: {
    server_card: `${SERVER_URL}/.well-known/server-card.json`,
    llms_txt: `${SERVER_URL}/llms.txt`,
    agent_card: `${SERVER_URL}/.well-known/agent-card.json`,
    openapi: `${SERVER_URL}/openapi.json`
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Payment-Token, X-Payment, mcp-session-id");
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "DELETE") return res.status(200).end();

  const path = (req.url || "").split("?")[0];
  if (path.endsWith("/.well-known/server-card.json") || path.endsWith("/server-card.json")) {
    return res.status(200).json(serverCard);
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ...serverCard,
      info: "Top GUN GEO-Lens MCP Server",
      message: "Use POST /api/mcp for MCP Streamable HTTP. Use tools/list to discover priced tools.",
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const toolName: string | undefined = req.body?.method === "tools/call" ? req.body?.params?.name : undefined;
  if (toolName === "audit_brand_visibility") {
    const ok = await requirePayment(req, res);
    if (!ok) return;
  }

  const mcp = new McpServer({
    name: "top-gun-geo-lens",
    version: "1.0.0",
    description: fullDescription,
    icons: [{ src: `${SERVER_URL}/top-gun-favicon.png`, type: "image/png", sizes: "512x512" }],
  });

  mcp.tool(
    "audit_brand_visibility",
    `${fullDescription} Cost: ${AUDIT_PRICE_LABEL} per audit via Stripe MPP/x402.`,
    {
      query: z.string().describe("The brand name, product, company, or topic to audit for LLM visibility. Examples: 'Nike', 'Notion', 'Claude AI', 'Hawaii surf schools'")
    },
    async ({ query }) => ({ content: [{ type: "text", text: JSON.stringify(await runGeoAudit(query), null, 2) }] })
  );

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await mcp.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
