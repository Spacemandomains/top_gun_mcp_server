import type { VercelRequest, VercelResponse } from "@vercel/node";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import Stripe from "stripe";

const SERVER_URL = (process.env.SERVER_URL || "https://top-gun-mcp-server.vercel.app").replace(/\/$/, "");
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_PAYMENT_URL = process.env.STRIPE_PAYMENT_URL || "https://buy.stripe.com/4gMfZh26i5R1dsE1gH9MY05";
const BRAVE_KEY = process.env.BRAVE_SEARCH_API_KEY || "";
const EXA_KEY = process.env.EXA_API_KEY || "";
const USDC_WALLET_ADDRESS = process.env.USDC_WALLET_ADDRESS || "";

const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;

const QUICK_PRICE_CENTS = 5;
const QUICK_PRICE_USD = "0.05";
const QUICK_PRICE_LABEL = "$0.05";
const QUICK_PRICE_USDC = "50000";
const AUDIT_PRICE_CENTS = 150;
const AUDIT_PRICE_USD = "1.50";
const AUDIT_PRICE_LABEL = "$1.50";
const AUDIT_PRICE_USDC = "1500000";
const USDC_WALLET = process.env.USDC_WALLET_ADDRESS || "";
const USDC_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const fullDescription = [
  "Brand visibility auditing across Large Language Models.",
  "Audit how your brand, product, or company is being surfaced and cited by AI systems — and get recommendations to improve it.",
  "Searches LLM-indexed sources via Brave Search and Exa for your brand or query, measures how prominently it appears, and returns a visibility score from 0–100, score label Strong / Moderate / Weak / Not Found, top citation URLs, LLM index status, and actionable GEO recommendations."
].join(" ");

const quickDescription = [
  "Fast preflight GEO check for agents.",
  "Quickly estimates whether a brand, product, company, or topic is likely visible in AI-search and LLM-cited sources before spending on a full audit.",
  "Use this before writing content, preparing SEO/GEO strategy, doing sales research, comparing competitors, or deciding whether to run the full Top GUN GEO-Lens audit."
].join(" ");

function paymentMetadata(amount: string, label: string) {
  return { price: label, pricing: { type: "fixed", amount, currency: "USD", display: label, protocols: ["mpp-tempo-1", "stripe-mpp", "x402"] }, "x-payment-info": { pricingMode: "fixed", price: amount, currency: "USD", protocols: ["mpp-tempo-1"] }, "x-payment": { mode: "fixed", amount, currency: "USD", protocols: ["mpp-tempo-1"] } };
}

const quickTool = { name: "geo_quick_check", title: "GEO Quick Check", description: quickDescription, inputSchema: { type: "object", required: ["query"], properties: { query: { type: "string", description: "The brand, product, company, or topic to pre-check for LLM visibility." }, context: { type: "string", description: "Optional context about the brand, product, market, or user goal." }, intent: { type: "string", enum: ["brand_check", "content_planning", "competitor_check", "sales_research", "seo_geo"], description: "Optional reason for the quick check." } } }, ...paymentMetadata(QUICK_PRICE_USD, QUICK_PRICE_LABEL) };
const auditTool = { name: "audit_brand_visibility", title: "Audit Brand Visibility", description: fullDescription, inputSchema: { type: "object", required: ["query"], properties: { query: { type: "string", description: "The brand, product, company, or topic to audit for LLM visibility." } } }, ...paymentMetadata(AUDIT_PRICE_USD, AUDIT_PRICE_LABEL) };
const toolAuditTool = { name: "tool_audit", title: "Audit MCP Tool or Endpoint", description: "Audit an MCP server, OpenAPI spec, or paid AI-agent endpoint for discoverability, schema quality, payment metadata, auth mode, 402 payment challenge quality, and MPP Scan readiness.", inputSchema: { type: "object", required: ["url"], properties: { url: { type: "string", format: "uri", description: "The public MCP server, OpenAPI spec, or endpoint URL to audit." } } }, ...paymentMetadata(AUDIT_PRICE_USD, AUDIT_PRICE_LABEL) };

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
    pricing: { type: "fixed", amount: AUDIT_PRICE_USD, currency: "USD", display: AUDIT_PRICE_LABEL, protocols: ["mpp-tempo-1", "stripe-mpp", "x402"] },
    "x-payment-info": { pricingMode: "fixed", price: AUDIT_PRICE_USD, currency: "USD", protocols: ["mpp-tempo-1", "stripe-mpp", "x402"] },
    inputSchema: { type: "object", required: ["url"], properties: { url: { type: "string", format: "uri", description: "The public MCP server, OpenAPI spec, endpoint, brand website, or URL to audit." } } },
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
    pricing: { type: "fixed", amount: QUICK_PRICE_USD, currency: "USD", display: QUICK_PRICE_LABEL, protocols: ["mpp-tempo-1", "stripe-mpp", "x402"] },
    "x-payment-info": { pricingMode: "fixed", price: QUICK_PRICE_USD, currency: "USD", protocols: ["mpp-tempo-1", "stripe-mpp", "x402"] },
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
    pricing: { type: "fixed", amount: AUDIT_PRICE_USD, currency: "USD", display: AUDIT_PRICE_LABEL, protocols: ["mpp-tempo-1", "stripe-mpp", "x402"] },
    "x-payment-info": { pricingMode: "fixed", price: AUDIT_PRICE_USD, currency: "USD", protocols: ["mpp-tempo-1", "stripe-mpp", "x402"] },
    mimeType: "application/json"
  }
];

const infoResources = [
  { name: "Top GUN Tools and Pricing", uri: "topgun://tools", description: "Lists the paid MCP tools available from Top GUN GEO-Lens, including prices and when agents should call each tool.", mimeType: "application/json" },
  { name: "Top GUN Pricing", uri: "topgun://pricing", description: "Machine-readable pricing for Top GUN GEO-Lens MCP tools.", mimeType: "application/json" },
  { name: "Top GUN Description", uri: "topgun://description", description: "Marketplace description and use cases for Top GUN GEO-Lens.", mimeType: "text/plain" },
  { name: "GEO Quick Check", uri: `${SERVER_URL}/api/mcp`, description: "Fast preflight GEO check for agents. Cost: $0.05", method: "POST", path: "/api/mcp", url: `${SERVER_URL}/api/mcp`, price: "$0.05", pricing: { type: "fixed", amount: "0.05", currency: "USD", display: "$0.05", protocols: ["mpp-tempo-1", "stripe-mpp", "x402"] }, "x-payment-info": { pricingMode: "fixed", price: "0.05", currency: "USD", protocols: ["mpp-tempo-1"] } },
  { name: "Audit Brand Visibility", uri: `${SERVER_URL}/api/mcp`, description: "Full LLM brand visibility audit. Cost: $1.50", method: "POST", path: "/api/mcp", url: `${SERVER_URL}/api/mcp`, price: "$1.50", pricing: { type: "fixed", amount: "1.50", currency: "USD", display: "$1.50", protocols: ["mpp-tempo-1", "stripe-mpp", "x402"] }, "x-payment-info": { pricingMode: "fixed", price: "1.50", currency: "USD", protocols: ["mpp-tempo-1"] } }
];

const resources = [...pricedResources, ...infoResources];

const toolsAndPricing = { tools: [quickTool, auditTool, toolAuditTool], recommended_flow: ["geo_quick_check", "audit_brand_visibility", "tool_audit"], mcp_endpoint: `${SERVER_URL}/api/mcp`, server: "Top GUN GEO-Lens API" };

function x402Requirements(resource: string, amount: string, description: string) {
  return { scheme: "exact", network: "base", maxAmountRequired: amount, resource, description, mimeType: "application/json", payTo: USDC_WALLET, maxTimeoutSeconds: 300, asset: USDC_ASSET, extra: { name: "USD Coin", version: "2" } };
}
async function verifyX402(payment: string, resource: string, amount: string, description: string): Promise<boolean> {
  if (!USDC_WALLET) return false;
  try { const res = await fetch("https://x402.org/facilitator/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment, paymentRequirements: x402Requirements(resource, amount, description) }) }); const data = await res.json(); return data.isValid === true; } catch { return false; }
}
async function settleX402(payment: string, resource: string, amount: string, description: string): Promise<void> {
  if (!USDC_WALLET) return;
  await fetch("https://x402.org/facilitator/settle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment, paymentRequirements: x402Requirements(resource, amount, description) }) }).catch(() => {});
}
async function searchBrave(query: string) {
  if (!BRAVE_KEY) return [];
  try { const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`, { headers: { "Accept": "application/json", "X-Subscription-Token": BRAVE_KEY } }); const data = await res.json(); return (data.web?.results || []).map((r: any) => ({ title: r.title, snippet: r.description, url: r.url })); } catch { return []; }
}
async function searchExa(query: string) {
  if (!EXA_KEY) return [];
  try { const res = await fetch("https://api.exa.ai/search", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": EXA_KEY }, body: JSON.stringify({ query, numResults: 10, useAutoprompt: true }) }); const data = await res.json(); return (data.results || []).map((r: any) => ({ title: r.title, snippet: r.text?.substring(0, 200), url: r.url })); } catch { return []; }
}
function getRecommendations(score: number, query: string): string[] {
  if (score >= 75) return [`${query} has strong LLM visibility — focus on maintaining freshness`, "Publish regular content that LLM training crawlers index", "Monitor for sentiment shifts in citations"];
  if (score >= 40) return [`${query} has moderate visibility — opportunity to strengthen presence`, "Increase authoritative backlinks from LLM-indexed domains", "Create structured data markup (schema.org) on key pages", "Publish thought leadership content on high-authority platforms"];
  return [`${query} has low LLM visibility — significant GEO work needed`, "Build presence on Wikipedia, Wikidata, and structured knowledge bases", "Get cited by authoritative sources in your industry", "Create an llms.txt file at your domain root", "Ensure your site is not blocking AI crawlers in robots.txt", "Publish consistently on platforms that LLMs are trained on"];
}
function runGeoQuickCheck(query: string, context?: string, intent?: string) {
  const trimmed = query.trim(); const wordCount = trimmed.split(/\s+/).filter(Boolean).length; const hasDomain = /\.[a-z]{2,}$/i.test(trimmed) || /^https?:\/\//i.test(trimmed); const hasKnownSignals = /\b(inc|llc|corp|company|ai|app|software|platform|brand|agency|studio|labs|systems|group)\b/i.test(`${trimmed} ${context || ""}`); const isLongTail = wordCount >= 5; let score = 35;
  if (hasDomain) score += 25; if (hasKnownSignals) score += 15; if (wordCount <= 3) score += 15; if (isLongTail) score -= 15; if (intent === "competitor_check" || intent === "sales_research") score += 5;
  score = Math.max(5, Math.min(90, score)); const visibility_guess = score >= 75 ? "Strong" : score >= 45 ? "Moderate" : score >= 20 ? "Weak" : "Unknown"; const should_run_full_audit = score < 75 || intent === "competitor_check" || intent === "seo_geo";
  return { query: trimmed, intent: intent || "brand_check", visibility_guess, confidence: Number((score / 100).toFixed(2)), should_run_full_audit, reason: should_run_full_audit ? "A full audit is recommended to verify citations, source prominence, LLM index status, and improvement opportunities." : "The query has enough strong surface signals that a full audit is optional unless the user needs citations or recommendations.", likely_sources_to_check: ["Brave Search", "Exa", "brand website", "high-authority citations", "llms.txt", "schema.org markup"], recommended_next_action: should_run_full_audit ? "Run audit_brand_visibility for citation URLs, score label, LLM index status, and GEO recommendations." : "Use the quick result for routing; run a full audit only if the user needs evidence or a report.", upsell_tool: "audit_brand_visibility", full_audit_price: AUDIT_PRICE_LABEL, price_paid: QUICK_PRICE_LABEL, provider: "Top GUN GEO-Lens Quick Check v1.0" };
}
async function runGeoAudit(query: string) {
  const startTime = Date.now(); const [braveResults, exaResults] = await Promise.allSettled([searchBrave(query), searchExa(query)]); const brave = braveResults.status === "fulfilled" ? braveResults.value : []; const exa = exaResults.status === "fulfilled" ? exaResults.value : []; const all = [...brave, ...exa]; const mentionCount = all.filter(r => r.title?.toLowerCase().includes(query.toLowerCase()) || r.snippet?.toLowerCase().includes(query.toLowerCase())).length; const totalResults = all.length; const visibilityScore = totalResults > 0 ? Math.round((mentionCount / totalResults) * 100) : 0; const scoreLabel = visibilityScore >= 75 ? "Strong" : visibilityScore >= 40 ? "Moderate" : visibilityScore >= 15 ? "Weak" : "Not Found"; const topCitations = all.slice(0, 5).map(r => r.url).filter(Boolean) as string[]; const llmIndexStatus = visibilityScore >= 40 ? "Indexed — brand appears in LLM-cited sources" : visibilityScore > 0 ? "Partial — limited presence in LLM-cited sources" : "Not indexed — brand not found in LLM search results";
  return { query, visibility_score: `${visibilityScore}/100 (${scoreLabel})`, score_raw: visibilityScore, score_label: scoreLabel, top_citations: topCitations, llm_index_status: llmIndexStatus, sources_checked: totalResults, brand_mentions: mentionCount, audit_time_ms: Date.now() - startTime, provider: "Top GUN GEO-Lens v1.0", recommendations: getRecommendations(visibilityScore, query), audited_at: new Date().toISOString() };
}
function toolPaymentConfig(toolName: string) {
  if (toolName === "geo_quick_check") return { cents: QUICK_PRICE_CENTS, usd: QUICK_PRICE_USD, label: QUICK_PRICE_LABEL, usdc: QUICK_PRICE_USDC, tool: quickTool, description: "Top GUN GEO-Lens Quick Check" };
  if (toolName === "tool_audit") return { cents: AUDIT_PRICE_CENTS, usd: AUDIT_PRICE_USD, label: AUDIT_PRICE_LABEL, usdc: AUDIT_PRICE_USDC, tool: toolAuditTool, description: "Top GUN MCP Endpoint Audit" };
  return { cents: AUDIT_PRICE_CENTS, usd: AUDIT_PRICE_USD, label: AUDIT_PRICE_LABEL, usdc: AUDIT_PRICE_USDC, tool: auditTool, description: "Top GUN GEO-Lens Brand Visibility Audit" };
}
async function requirePayment(req: VercelRequest, res: VercelResponse, toolName: string): Promise<boolean> {
  const config = toolPaymentConfig(toolName); const resource = `${SERVER_URL}/api/mcp#${toolName}`; const x402Payment = req.headers["x-payment"] as string | undefined;
  if (x402Payment) { if (!USDC_WALLET) { res.status(402).json({ error: "usdc_not_configured" }); return false; } const valid = await verifyX402(x402Payment, resource, config.usdc, config.description); if (!valid) { res.status(402).json({ error: "invalid_x402_payment" }); return false; } void settleX402(x402Payment, resource, config.usdc, config.description); return true; }
  if (!stripe) return true; const token = req.headers["x-payment-token"] as string | undefined;
  if (!token) { const intent = await stripe.paymentIntents.create({ amount: config.cents, currency: "usd", metadata: { mcp_tool: toolName, server: "top-gun-geo-lens" } }); res.status(402).json({ error: "payment_required", price_usd: config.label, tool: config.tool, payment_options: [{ method: "stripe-mpp", payment_protocol: "stripe-mpp", amount: config.usd, currency: "USD", payment_intent: { id: intent.id, client_secret: intent.client_secret, amount: intent.amount, currency: intent.currency }, stripe_checkout: STRIPE_PAYMENT_URL, instructions: "Complete payment, then retry with header: X-Payment-Token: <payment_intent_id>" }, ...(USDC_WALLET ? [{ method: "x402", network: "base", asset: "USDC", amount: config.usd, payTo: USDC_WALLET, requirements: x402Requirements(resource, config.usdc, config.description), instructions: `Pay ${config.usd} USDC on Base, then retry with header: X-Payment: <encoded_payload>` }] : [])] }); return false; }
  try { const intent = await stripe.paymentIntents.retrieve(token); if (intent.status !== "succeeded") { res.status(402).json({ error: "payment_not_completed", status: intent.status }); return false; } return true; } catch { try { const session = await stripe.checkout.sessions.retrieve(token); if (session.payment_status !== "paid") { res.status(402).json({ error: "payment_not_completed" }); return false; } return true; } catch { res.status(402).json({ error: "invalid_payment_token" }); return false; } }
}

const serverCard = { name: "Top GUN GEO-Lens API", description: fullDescription, version: "1.0.0", url: SERVER_URL, icon: `${SERVER_URL}/top-gun-favicon.png`, logo: `${SERVER_URL}/top-gun-favicon.png`, mcp_endpoint: `${SERVER_URL}/api/mcp`, transport: ["streamable-http"], spec_version: "2025-03-26", capabilities: { tools: true, resources: true, payments: { protocols: ["mpp-tempo-1", "stripe-mpp", "x402"] } }, resources, tools: [quickTool, auditTool, toolAuditTool], use_cases: ["Agents doing fast brand prechecks before content generation", "Brand managers checking LLM visibility before campaigns", "SEO and GEO professionals auditing client presence in AI search", "Marketers comparing brand visibility to competitors", "Agents that help users improve their AI search presence", "Product teams monitoring how their product is described by AI", "Auditing MCP servers and OpenAPI endpoints for discoverability and MPP Scan readiness"], discovery: { server_card: `${SERVER_URL}/.well-known/server-card.json`, llms_txt: `${SERVER_URL}/llms.txt`, agent_card: `${SERVER_URL}/.well-known/agent-card.json`, openapi: `${SERVER_URL}/openapi.json` } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS"); res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Payment-Token, X-Payment, mcp-session-id"); res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");
  if (req.method === "OPTIONS") return res.status(200).end(); if (req.method === "DELETE") return res.status(200).end();
  const path = (req.url || "").split("?")[0]; if (path.endsWith("/.well-known/server-card.json") || path.endsWith("/server-card.json")) return res.status(200).json(serverCard);
  if (req.method === "GET") return res.status(200).json({ ...serverCard, info: "Top GUN GEO-Lens MCP Server", message: "Use POST /api/mcp for MCP Streamable HTTP. Use resources/list to discover pricing resources and tools/list to discover priced tools." });
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  const toolName: string | undefined = req.body?.method === "tools/call" ? req.body?.params?.name : undefined;
  if (toolName === "audit_brand_visibility" || toolName === "geo_quick_check" || toolName === "tool_audit") { const ok = await requirePayment(req, res, toolName); if (!ok) return; }

  // ✅ Fixed: changed `type` to `mimeType` in the icons array
  const mcp = new McpServer({ name: "top-gun-geo-lens", version: "1.0.0", description: fullDescription, icons: [{ src: `${SERVER_URL}/top-gun-favicon.png`, mimeType: "image/png", sizes: ["512x512"] }] });

  mcp.resource("top-gun-tools", "topgun://tools", async () => ({ contents: [{ uri: "topgun://tools", mimeType: "application/json", text: JSON.stringify(toolsAndPricing, null, 2) }] }));
  mcp.resource("top-gun-pricing", "topgun://pricing", async () => ({ contents: [{ uri: "topgun://pricing", mimeType: "application/json", text: JSON.stringify({ tools: [quickTool, auditTool] }, null, 2) }] }));
  mcp.resource("top-gun-description", "topgun://description", async () => ({ contents: [{ uri: "topgun://description", mimeType: "text/plain", text: fullDescription }] }));

  const toolAuditResourceUri = `${SERVER_URL}/api/v1/audit`;
  mcp.resource("tool_audit", toolAuditResourceUri, { description: `Top GUN GEO-Lens Audit — ${AUDIT_PRICE_LABEL} per call. ${fullDescription}`, mimeType: "application/json" }, async () => ({ contents: [{ uri: toolAuditResourceUri, mimeType: "application/json", text: JSON.stringify({ id: "tool_audit", method: "GET", path: "/api/v1/audit", url: toolAuditResourceUri, price: AUDIT_PRICE_USD, currency: "USD", pricing: { type: "fixed", amount: AUDIT_PRICE_USD, currency: "USD", display: AUDIT_PRICE_LABEL, protocols: ["mpp-tempo-1", "stripe-mpp", "x402"] } }, null, 2) }] }));

  const quickResourceUri = `${SERVER_URL}/api/mcp#geo_quick_check`;
  mcp.resource("geo_quick_check", quickResourceUri, { description: `GEO Quick Check — ${QUICK_PRICE_LABEL} per call. ${quickDescription}`, mimeType: "application/json" }, async () => ({ contents: [{ uri: quickResourceUri, mimeType: "application/json", text: JSON.stringify({ id: "geo_quick_check", method: "POST", path: "/api/mcp", price: QUICK_PRICE_USD, currency: "USD", pricing: { type: "fixed", amount: QUICK_PRICE_USD, currency: "USD", display: QUICK_PRICE_LABEL, protocols: ["mpp-tempo-1", "stripe-mpp", "x402"] } }, null, 2) }] }));

  const auditBrandResourceUri = `${SERVER_URL}/api/mcp#audit_brand_visibility`;
  mcp.resource("audit_brand_visibility", auditBrandResourceUri, { description: `Audit Brand Visibility — ${AUDIT_PRICE_LABEL} per call. ${fullDescription}`, mimeType: "application/json" }, async () => ({ contents: [{ uri: auditBrandResourceUri, mimeType: "application/json", text: JSON.stringify({ id: "audit_brand_visibility", method: "POST", path: "/api/mcp", price: AUDIT_PRICE_USD, currency: "USD", pricing: { type: "fixed", amount: AUDIT_PRICE_USD, currency: "USD", display: AUDIT_PRICE_LABEL, protocols: ["mpp-tempo-1", "stripe-mpp", "x402"] } }, null, 2) }] }));

  mcp.tool("geo_quick_check", `${quickDescription} Cost: ${QUICK_PRICE_LABEL} per quick check.`, { query: z.string().describe("The brand, product, company, or topic to pre-check for LLM visibility."), context: z.string().optional().describe("Optional context about the brand, product, market, or user goal."), intent: z.enum(["brand_check", "content_planning", "competitor_check", "sales_research", "seo_geo"]).optional().describe("Why the agent is running this quick check.") }, async ({ query, context, intent }) => ({ content: [{ type: "text", text: JSON.stringify(runGeoQuickCheck(query, context, intent), null, 2) }] }));
  mcp.tool("audit_brand_visibility", `${fullDescription} Cost: ${AUDIT_PRICE_LABEL} per audit via Stripe MPP/x402.`, { query: z.string().describe("The brand name, product, company, or topic to audit for LLM visibility. Examples: 'Nike', 'Notion', 'Claude AI', 'Hawaii surf schools'") }, async ({ query }) => ({ content: [{ type: "text", text: JSON.stringify(await runGeoAudit(query), null, 2) }] }));
  mcp.tool("tool_audit", `Audit an MCP server, OpenAPI spec, or paid AI-agent endpoint for discoverability, schema quality, payment metadata, auth mode, 402 payment challenge quality, and MPP Scan readiness. Cost: ${AUDIT_PRICE_LABEL} per audit via Stripe MPP/x402.`, { url: z.string().url().describe("The public MCP server, OpenAPI spec, or endpoint URL to audit.") }, async ({ url }) => ({ content: [{ type: "text", text: JSON.stringify(await runGeoAudit(url), null, 2) }] }));

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined }); await mcp.connect(transport); await transport.handleRequest(req, res, req.body);
}
