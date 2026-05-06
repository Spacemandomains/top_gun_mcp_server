import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

const SERVER_URL = (process.env.SERVER_URL || "https://top-gun-mcp-server.vercel.app").replace(/\/$/, "");
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_PAYMENT_URL = process.env.STRIPE_PAYMENT_URL || "https://buy.stripe.com/4gMfZh26i5R1dsE1gH9MY05";
const BRAVE_KEY = process.env.BRAVE_SEARCH_API_KEY || "";
const EXA_KEY = process.env.EXA_API_KEY || "";

const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;

const QUICK_PRICE_CENTS = 5;
const QUICK_PRICE_USD = "0.05";
const QUICK_PRICE_LABEL = "$0.05";
const QUICK_PRICE_USDC = "50000";
const QUICK_PRICE_NUMBER = 0.05;
const AUDIT_PRICE_CENTS = 150;
const AUDIT_PRICE_USD = "1.50";
const AUDIT_PRICE_LABEL = "$1.50";
const AUDIT_PRICE_USDC = "1500000";
const AUDIT_PRICE_NUMBER = 1.50;
const USDC_WALLET = process.env.USDC_WALLET_ADDRESS || "";
const USDC_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const PAYMENT_PROTOCOLS = ["mpp-tempo-1", "stripe-mpp", "x402"];

const fullDescription = [
  "TOOL: audit_brand_visibility | COST: $1.50 | WHEN TO CALL: when an agent or user needs to measure how a brand, product, company, or topic is represented in LLM-indexed sources.",
  "INPUT: query (string) — brand name, product, company, domain, or topic.",
  "OUTPUT: visibility_score (0–100), score_label (Strong/Moderate/Weak/Not Found), top_citations (URLs), llm_index_status, brand_mentions, sources_checked, recommendations (actionable GEO improvements), audited_at.",
  "USE BEFORE: writing GEO content, launching campaigns, reporting on AI search presence, comparing competitors.",
  "PROVIDER: Top GUN GEO-Lens v1.0 via Brave Search + Exa."
].join(" ");

const quickDescription = [
  "TOOL: geo_quick_check | COST: $0.05 | WHEN TO CALL: fast preflight check before spending on a full audit — use to route decisions, not as a final answer.",
  "INPUT: query (string, required) — brand, product, company, or topic. context (string, optional) — market or goal context. intent (enum, optional) — brand_check | content_planning | competitor_check | sales_research | seo_geo.",
  "OUTPUT: visibility_guess (Strong/Moderate/Weak/Unknown), confidence (0–1), should_run_full_audit (boolean), recommended_next_action.",
  "USE BEFORE: content generation, SEO/GEO strategy, sales research, competitor analysis, or deciding whether to call audit_brand_visibility.",
  "PROVIDER: Top GUN GEO-Lens Quick Check v1.0."
].join(" ");

const toolAuditDescription = "Audit an MCP server, OpenAPI spec, or paid AI-agent endpoint for discoverability, schema quality, payment metadata, auth mode, 402 payment challenge quality, and MPP Scan readiness.";

// Single source of truth for paid-tool input schemas — reused by ALL_TOOLS, resources, and 402 payloads.
const TOOL_INPUT_SCHEMAS: Record<string, Record<string, unknown>> = {
  geo_quick_check: {
    type: "object",
    required: ["query"],
    properties: {
      query:   { type: "string", description: "The brand, product, company, or topic to pre-check for LLM visibility." },
      context: { type: "string", description: "Optional context about the brand, product, market, or user goal." },
      intent:  { type: "string", enum: ["brand_check", "content_planning", "competitor_check", "sales_research", "seo_geo"], description: "Optional reason for the quick check." }
    }
  },
  audit_brand_visibility: {
    type: "object",
    required: ["query"],
    properties: {
      query: { type: "string", description: "The brand, product, company, or topic to audit for LLM visibility." }
    }
  },
  tool_audit: {
    type: "object",
    required: ["url"],
    properties: {
      url: { type: "string", format: "uri", description: "The public MCP server, OpenAPI spec, or endpoint URL to audit." }
    }
  }
};

function paymentMetadata(amount: string, label: string) {
  return {
    price: label,
    pricing:           { type: "fixed", amount, currency: "USD", display: label, protocols: PAYMENT_PROTOCOLS },
    "x-payment-info":  { pricingMode: "fixed", price: amount, currency: "USD", protocols: ["mpp-tempo-1"] },
    "x-payment":       { mode: "fixed", amount, currency: "USD", protocols: ["mpp-tempo-1"] }
  };
}

const paidAnnotation = (price: number) => ({
  "x-payment-info": {
    price,
    currency:  "USD",
    protocols: PAYMENT_PROTOCOLS,
    billing:   "per_call"
  }
});

const quickTool = {
  name:        "geo_quick_check",
  title:       "GEO Quick Check",
  description: quickDescription,
  inputSchema: TOOL_INPUT_SCHEMAS.geo_quick_check,
  input_schema: TOOL_INPUT_SCHEMAS.geo_quick_check,
  annotations: paidAnnotation(QUICK_PRICE_NUMBER),
  ...paymentMetadata(QUICK_PRICE_USD, QUICK_PRICE_LABEL)
};

const auditTool = {
  name:        "audit_brand_visibility",
  title:       "Audit Brand Visibility",
  description: fullDescription,
  inputSchema: TOOL_INPUT_SCHEMAS.audit_brand_visibility,
  input_schema: TOOL_INPUT_SCHEMAS.audit_brand_visibility,
  annotations: paidAnnotation(AUDIT_PRICE_NUMBER),
  ...paymentMetadata(AUDIT_PRICE_USD, AUDIT_PRICE_LABEL)
};

const toolAuditTool = {
  name:        "tool_audit",
  title:       "Audit MCP Tool or Endpoint",
  description: toolAuditDescription,
  inputSchema: TOOL_INPUT_SCHEMAS.tool_audit,
  input_schema: TOOL_INPUT_SCHEMAS.tool_audit,
  annotations: paidAnnotation(AUDIT_PRICE_NUMBER),
  ...paymentMetadata(AUDIT_PRICE_USD, AUDIT_PRICE_LABEL)
};

const ALL_TOOLS = [quickTool, auditTool, toolAuditTool];

const pricedResources = [
  {
    id: "tool_audit",
    type: "tool",
    name: "Top GUN GEO-Lens Audit",
    title: "Top GUN GEO-Lens Audit",
    uri: `${SERVER_URL}/api/v1/audit`,
    description: "Professional auditing for Generative Engine Optimization. Measures brand visibility and citations in LLM search results.",
    method: "GET",
    path: "/api/v1/audit",
    url: `${SERVER_URL}/api/v1/audit`,
    price: AUDIT_PRICE_USD,
    currency: "USD",
    pricing:          { type: "fixed", amount: AUDIT_PRICE_USD, currency: "USD", display: AUDIT_PRICE_LABEL, protocols: PAYMENT_PROTOCOLS },
    "x-payment-info": { pricingMode: "fixed", price: AUDIT_PRICE_USD, currency: "USD", protocols: PAYMENT_PROTOCOLS },
    inputSchema: TOOL_INPUT_SCHEMAS.tool_audit,
    mimeType: "application/json"
  },
  {
    id: "geo_quick_check",
    type: "tool",
    name: "GEO Quick Check",
    title: "GEO Quick Check",
    uri: `${SERVER_URL}/api/mcp#geo_quick_check`,
    description: "Fast preflight GEO check for agents before running a full audit.",
    method: "POST",
    path: "/api/mcp",
    url: `${SERVER_URL}/api/mcp`,
    price: QUICK_PRICE_USD,
    currency: "USD",
    pricing:          { type: "fixed", amount: QUICK_PRICE_USD, currency: "USD", display: QUICK_PRICE_LABEL, protocols: PAYMENT_PROTOCOLS },
    "x-payment-info": { pricingMode: "fixed", price: QUICK_PRICE_USD, currency: "USD", protocols: PAYMENT_PROTOCOLS },
    inputSchema: TOOL_INPUT_SCHEMAS.geo_quick_check,
    mimeType: "application/json"
  },
  {
    id: "audit_brand_visibility",
    type: "tool",
    name: "Audit Brand Visibility",
    title: "Audit Brand Visibility",
    uri: `${SERVER_URL}/api/mcp#audit_brand_visibility`,
    description: "Audit how a brand or topic is represented and cited across LLM-indexed sources. Returns visibility score, citations, index status, and improvement recommendations.",
    method: "POST",
    path: "/api/mcp",
    url: `${SERVER_URL}/api/mcp`,
    price: AUDIT_PRICE_USD,
    currency: "USD",
    pricing:          { type: "fixed", amount: AUDIT_PRICE_USD, currency: "USD", display: AUDIT_PRICE_LABEL, protocols: PAYMENT_PROTOCOLS },
    "x-payment-info": { pricingMode: "fixed", price: AUDIT_PRICE_USD, currency: "USD", protocols: PAYMENT_PROTOCOLS },
    inputSchema: TOOL_INPUT_SCHEMAS.audit_brand_visibility,
    mimeType: "application/json"
  }
];

const infoResources = [
  { name: "Top GUN Tools and Pricing", uri: "topgun://tools",       description: "Lists the paid MCP tools available from Top GUN GEO-Lens, including prices and when agents should call each tool.", mimeType: "application/json" },
  { name: "Top GUN Pricing",           uri: "topgun://pricing",     description: "Machine-readable pricing for Top GUN GEO-Lens MCP tools.",                                                            mimeType: "application/json" },
  { name: "Top GUN Description",       uri: "topgun://description", description: "Marketplace description and use cases for Top GUN GEO-Lens.",                                                          mimeType: "text/plain" }
];

const resources = [...pricedResources, ...infoResources];

const toolsAndPricing = {
  tools: ALL_TOOLS,
  recommended_flow: ["geo_quick_check", "audit_brand_visibility", "tool_audit"],
  mcp_endpoint: `${SERVER_URL}/api/mcp`,
  server: "Top GUN GEO-Lens API"
};

const RESOURCE_BODY: Record<string, { mimeType: string; text: string }> = {
  "topgun://tools":       { mimeType: "application/json", text: JSON.stringify(toolsAndPricing, null, 2) },
  "topgun://pricing":     { mimeType: "application/json", text: JSON.stringify({ tools: [quickTool, auditTool] }, null, 2) },
  "topgun://description": { mimeType: "text/plain",       text: fullDescription },
  [`${SERVER_URL}/api/v1/audit`]:                 { mimeType: "application/json", text: JSON.stringify({ id: "tool_audit",             method: "GET",  path: "/api/v1/audit", url: `${SERVER_URL}/api/v1/audit`, price: AUDIT_PRICE_USD, currency: "USD", pricing: { type: "fixed", amount: AUDIT_PRICE_USD, currency: "USD", display: AUDIT_PRICE_LABEL, protocols: PAYMENT_PROTOCOLS } }, null, 2) },
  [`${SERVER_URL}/api/mcp#geo_quick_check`]:      { mimeType: "application/json", text: JSON.stringify({ id: "geo_quick_check",        method: "POST", path: "/api/mcp",       price: QUICK_PRICE_USD, currency: "USD", pricing: { type: "fixed", amount: QUICK_PRICE_USD, currency: "USD", display: QUICK_PRICE_LABEL, protocols: PAYMENT_PROTOCOLS } }, null, 2) },
  [`${SERVER_URL}/api/mcp#audit_brand_visibility`]: { mimeType: "application/json", text: JSON.stringify({ id: "audit_brand_visibility", method: "POST", path: "/api/mcp",       price: AUDIT_PRICE_USD, currency: "USD", pricing: { type: "fixed", amount: AUDIT_PRICE_USD, currency: "USD", display: AUDIT_PRICE_LABEL, protocols: PAYMENT_PROTOCOLS } }, null, 2) }
};

function x402Requirements(resource: string, amount: string, description: string) {
  return { scheme: "exact", network: "base", maxAmountRequired: amount, resource, description, mimeType: "application/json", payTo: USDC_WALLET, maxTimeoutSeconds: 300, asset: USDC_ASSET, extra: { name: "USD Coin", version: "2" } };
}

async function verifyX402(payment: string, resource: string, amount: string, description: string): Promise<boolean> {
  if (!USDC_WALLET) return false;
  try {
    const res = await fetch("https://x402.org/facilitator/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment, paymentRequirements: x402Requirements(resource, amount, description) }) });
    const data = await res.json();
    return data.isValid === true;
  } catch { return false; }
}

async function settleX402(payment: string, resource: string, amount: string, description: string): Promise<void> {
  if (!USDC_WALLET) return;
  await fetch("https://x402.org/facilitator/settle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment, paymentRequirements: x402Requirements(resource, amount, description) }) }).catch(() => {});
}

async function searchBrave(query: string) {
  if (!BRAVE_KEY) return [];
  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`, { headers: { "Accept": "application/json", "X-Subscription-Token": BRAVE_KEY } });
    const data = await res.json();
    return (data.web?.results || []).map((r: any) => ({ title: r.title, snippet: r.description, url: r.url }));
  } catch { return []; }
}

async function searchExa(query: string) {
  if (!EXA_KEY) return [];
  try {
    const res = await fetch("https://api.exa.ai/search", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": EXA_KEY }, body: JSON.stringify({ query, numResults: 10, useAutoprompt: true }) });
    const data = await res.json();
    return (data.results || []).map((r: any) => ({ title: r.title, snippet: r.text?.substring(0, 200), url: r.url }));
  } catch { return []; }
}

function getRecommendations(score: number, query: string): string[] {
  if (score >= 75) return [`${query} has strong LLM visibility — focus on maintaining freshness`, "Publish regular content that LLM training crawlers index", "Monitor for sentiment shifts in citations"];
  if (score >= 40) return [`${query} has moderate visibility — opportunity to strengthen presence`, "Increase authoritative backlinks from LLM-indexed domains", "Create structured data markup (schema.org) on key pages", "Publish thought leadership content on high-authority platforms"];
  return [`${query} has low LLM visibility — significant GEO work needed`, "Build presence on Wikipedia, Wikidata, and structured knowledge bases", "Get cited by authoritative sources in your industry", "Create an llms.txt file at your domain root", "Ensure your site is not blocking AI crawlers in robots.txt", "Publish consistently on platforms that LLMs are trained on"];
}

function runGeoQuickCheck(query: string, context?: string, intent?: string) {
  const trimmed = query.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const hasDomain = /\.[a-z]{2,}$/i.test(trimmed) || /^https?:\/\//i.test(trimmed);
  const hasKnownSignals = /\b(inc|llc|corp|company|ai|app|software|platform|brand|agency|studio|labs|systems|group)\b/i.test(`${trimmed} ${context || ""}`);
  const isLongTail = wordCount >= 5;
  let score = 35;
  if (hasDomain) score += 25;
  if (hasKnownSignals) score += 15;
  if (wordCount <= 3) score += 15;
  if (isLongTail) score -= 15;
  if (intent === "competitor_check" || intent === "sales_research") score += 5;
  score = Math.max(5, Math.min(90, score));
  const visibility_guess = score >= 75 ? "Strong" : score >= 45 ? "Moderate" : score >= 20 ? "Weak" : "Unknown";
  const should_run_full_audit = score < 75 || intent === "competitor_check" || intent === "seo_geo";
  return {
    query: trimmed,
    intent: intent || "brand_check",
    visibility_guess,
    confidence: Number((score / 100).toFixed(2)),
    should_run_full_audit,
    reason: should_run_full_audit ? "A full audit is recommended to verify citations, source prominence, LLM index status, and improvement opportunities." : "The query has enough strong surface signals that a full audit is optional unless the user needs citations or recommendations.",
    likely_sources_to_check: ["Brave Search", "Exa", "brand website", "high-authority citations", "llms.txt", "schema.org markup"],
    recommended_next_action: should_run_full_audit ? "Run audit_brand_visibility for citation URLs, score label, LLM index status, and GEO recommendations." : "Use the quick result for routing; run a full audit only if the user needs evidence or a report.",
    upsell_tool: "audit_brand_visibility",
    full_audit_price: AUDIT_PRICE_LABEL,
    price_paid: QUICK_PRICE_LABEL,
    provider: "Top GUN GEO-Lens Quick Check v1.0"
  };
}

async function runGeoAudit(query: string) {
  const startTime = Date.now();
  const [braveResults, exaResults] = await Promise.allSettled([searchBrave(query), searchExa(query)]);
  const brave = braveResults.status === "fulfilled" ? braveResults.value : [];
  const exa   = exaResults.status   === "fulfilled" ? exaResults.value   : [];
  const all = [...brave, ...exa];
  const mentionCount = all.filter(r => r.title?.toLowerCase().includes(query.toLowerCase()) || r.snippet?.toLowerCase().includes(query.toLowerCase())).length;
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
    audited_at: new Date().toISOString()
  };
}

function toolPaymentConfig(toolName: string) {
  if (toolName === "geo_quick_check") return { cents: QUICK_PRICE_CENTS, usd: QUICK_PRICE_USD, label: QUICK_PRICE_LABEL, usdc: QUICK_PRICE_USDC, tool: quickTool,     description: "Top GUN GEO-Lens Quick Check" };
  if (toolName === "tool_audit")      return { cents: AUDIT_PRICE_CENTS, usd: AUDIT_PRICE_USD, label: AUDIT_PRICE_LABEL, usdc: AUDIT_PRICE_USDC, tool: toolAuditTool, description: "Top GUN MCP Endpoint Audit" };
  return                                     { cents: AUDIT_PRICE_CENTS, usd: AUDIT_PRICE_USD, label: AUDIT_PRICE_LABEL, usdc: AUDIT_PRICE_USDC, tool: auditTool,     description: "Top GUN GEO-Lens Brand Visibility Audit" };
}

async function requirePayment(req: VercelRequest, res: VercelResponse, toolName: string): Promise<boolean> {
  const config = toolPaymentConfig(toolName);
  const resource = `${SERVER_URL}/api/mcp#${toolName}`;
  const x402Payment = req.headers["x-payment"] as string | undefined;

  if (x402Payment) {
    if (!USDC_WALLET) { res.status(402).json({ error: "usdc_not_configured" }); return false; }
    const valid = await verifyX402(x402Payment, resource, config.usdc, config.description);
    if (!valid) { res.status(402).json({ error: "invalid_x402_payment" }); return false; }
    void settleX402(x402Payment, resource, config.usdc, config.description);
    return true;
  }

  if (!stripe) return true;
  const token = req.headers["x-payment-token"] as string | undefined;

  if (!token) {
    const intent = await stripe.paymentIntents.create({ amount: config.cents, currency: "usd", metadata: { mcp_tool: toolName, server: "top-gun-geo-lens" } });
    res.status(402).json({
      error: "payment_required",
      price_usd: config.label,
      tool: config.tool,
      input_schema: TOOL_INPUT_SCHEMAS[toolName],
      payment_options: [
        { method: "stripe-mpp", payment_protocol: "stripe-mpp", amount: config.usd, currency: "USD", payment_intent: { id: intent.id, client_secret: intent.client_secret, amount: intent.amount, currency: intent.currency }, stripe_checkout: STRIPE_PAYMENT_URL, instructions: "Complete payment, then retry with header: X-Payment-Token: <payment_intent_id>" },
        ...(USDC_WALLET ? [{ method: "x402", network: "base", asset: "USDC", amount: config.usd, payTo: USDC_WALLET, requirements: x402Requirements(resource, config.usdc, config.description), instructions: `Pay ${config.usd} USDC on Base, then retry with header: X-Payment: <encoded_payload>` }] : [])
      ]
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
    } catch {
      res.status(402).json({ error: "invalid_payment_token" });
      return false;
    }
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
  transport: ["http", "streamable-http"],
  spec_version: "2025-03-26",
  capabilities: { tools: true, resources: true, payments: { protocols: PAYMENT_PROTOCOLS } },
  resources,
  tools: ALL_TOOLS,
  use_cases: [
    "Agents doing fast brand prechecks before content generation",
    "Brand managers checking LLM visibility before campaigns",
    "SEO and GEO professionals auditing client presence in AI search",
    "Marketers comparing brand visibility to competitors",
    "Agents that help users improve their AI search presence",
    "Product teams monitoring how their product is described by AI",
    "Auditing MCP servers and OpenAPI endpoints for discoverability and MPP Scan readiness"
  ],
  discovery: {
    server_card: `${SERVER_URL}/.well-known/server-card.json`,
    llms_txt:    `${SERVER_URL}/llms.txt`,
    agent_card:  `${SERVER_URL}/.well-known/agent-card.json`,
    openapi:     `${SERVER_URL}/openapi.json`
  }
};

const MCP_GET_PAYMENT_INFO = {
  price: 0,
  currency: "USD",
  protocols: PAYMENT_PROTOCOLS,
  billing: "free"
};

const MCP_POST_PAYMENT_INFO = {
  price: null,
  minPrice: QUICK_PRICE_NUMBER,
  maxPrice: AUDIT_PRICE_NUMBER,
  currency: "USD",
  protocols: PAYMENT_PROTOCOLS,
  billing: "mixed_per_call"
};

function paymentMetadataHeaders(info: Record<string, unknown>) {
  return {
    "X-Payment-Info":      JSON.stringify(info),
    "X-Payment-Protocols": PAYMENT_PROTOCOLS.join(","),
    "X-Payment-Price":     typeof info.price === "number" ? String(info.price) : "mixed"
  };
}

function applyHeaders(res: VercelResponse, headers: Record<string, string>) {
  for (const k of Object.keys(headers)) res.setHeader(k, headers[k]);
}

function jsonRpcError(res: VercelResponse, id: unknown, code: number, message: string, status = 200) {
  return res.status(status).json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin",   "*");
  res.setHeader("Access-Control-Allow-Methods",  "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers",  "Content-Type, Authorization, X-Payment-Token, X-Payment, X-MCP-Account, mcp-session-id");
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id, X-Payment-Info, X-Payment-Protocols, X-Payment-Price");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "DELETE")  return res.status(200).end();

  const path = (req.url || "").split("?")[0];
  if (path.endsWith("/.well-known/server-card.json") || path.endsWith("/server-card.json")) {
    return res.status(200).json(serverCard);
  }

  if (req.method === "GET") {
    const accept = String(req.headers.accept || "");
    applyHeaders(res, paymentMetadataHeaders(MCP_GET_PAYMENT_INFO));
    if (accept.includes("text/event-stream")) {
      res.setHeader("Allow", "POST, OPTIONS");
      res.setHeader("Content-Type", "text/plain");
      return res.status(405).send("SSE not supported in this stateless deployment. Use POST for MCP JSON-RPC requests.");
    }
    return res.status(200).json({
      ...serverCard,
      info: "Top GUN GEO-Lens MCP Server",
      message: "POST JSON-RPC tools/list to enumerate tools, tools/call to invoke. resources/list returns priced + info resources.",
      tools: ALL_TOOLS,
      "x-payment-info": MCP_GET_PAYMENT_INFO
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  applyHeaders(res, paymentMetadataHeaders(MCP_POST_PAYMENT_INFO));

  let body: any;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});
  } catch {
    return jsonRpcError(res, null, -32700, "Parse error", 400);
  }

  const method = body?.method as string | undefined;
  const id = body?.id ?? null;

  if (method === "initialize") {
    return res.status(200).json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "top-gun-geo-lens", version: "1.0.0" },
        "x-payment-info": MCP_POST_PAYMENT_INFO
      }
    });
  }

  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return res.status(200).end();
  }

  if (method === "tools/list") {
    return res.status(200).json({
      jsonrpc: "2.0",
      id,
      result: { tools: ALL_TOOLS, "x-payment-info": MCP_POST_PAYMENT_INFO }
    });
  }

  if (method === "resources/list") {
    return res.status(200).json({
      jsonrpc: "2.0",
      id,
      result: { resources, "x-payment-info": MCP_POST_PAYMENT_INFO }
    });
  }

  if (method === "resources/read") {
    const uri = body?.params?.uri as string | undefined;
    if (!uri || !RESOURCE_BODY[uri]) return jsonRpcError(res, id, -32602, `Unknown resource: ${uri}`);
    const r = RESOURCE_BODY[uri];
    return res.status(200).json({
      jsonrpc: "2.0",
      id,
      result: { contents: [{ uri, mimeType: r.mimeType, text: r.text }] }
    });
  }

  if (method === "tools/call") {
    const params = body?.params || {};
    const toolName: string = params.name;
    const args = params.arguments || {};

    if (!toolName || (toolName !== "geo_quick_check" && toolName !== "audit_brand_visibility" && toolName !== "tool_audit")) {
      return jsonRpcError(res, id, -32601, `Unknown tool: ${toolName}`);
    }

    const ok = await requirePayment(req, res, toolName);
    if (!ok) return;

    try {
      let resultText: string;
      if (toolName === "geo_quick_check") {
        resultText = JSON.stringify(runGeoQuickCheck(args.query, args.context, args.intent), null, 2);
      } else if (toolName === "audit_brand_visibility") {
        resultText = JSON.stringify(await runGeoAudit(args.query), null, 2);
      } else {
        resultText = JSON.stringify(await runGeoAudit(args.url), null, 2);
      }
      return res.status(200).json({
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: resultText }] }
      });
    } catch (e: any) {
      return jsonRpcError(res, id, -32000, e?.message || "internal error", 500);
    }
  }

  return jsonRpcError(res, id, -32601, `Unsupported method: ${method}`);
}
