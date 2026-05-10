import type { VercelRequest, VercelResponse } from "@vercel/node";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { handleAuditTool } from "../src/tools/audit.js";
import { handleQuickCheckTool } from "../src/tools/quick-check.js";

function createMcpServer(): McpServer {
  const server = new McpServer({ name: "top-gun-geo-lens", version: "1.0.0" });

  server.tool(
    "geo_quick_check",
    "Quick brand visibility snapshot across LLM-indexed sources. " +
      "Returns a score (0–100), top 3 citation URLs, and 2 quick improvement tips. " +
      "Single-source search (5 results). Costs $0.05 USDC. " +
      "For full citations, LLM index status, and 6 GEO recommendations use audit_brand ($1.50).",
    {
      query: z
        .string()
        .min(1)
        .describe("Brand name, company, or product to check (e.g. 'Stripe', 'Notion', 'Acme')"),
      paymentToken: z
        .string()
        .optional()
        .describe(
          "Stripe checkout session ID from a completed $0.05 USDC payment. " +
            "If omitted, the tool returns a payment link."
        ),
    },
    async ({ query, paymentToken }) => {
      const text = await handleQuickCheckTool({ query, paymentToken });
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "audit_brand",
    "Full brand visibility audit across LLM-indexed sources (Brave + Exa, 10 results). " +
      "Returns a visibility score (0–100), score label, top 5 citation URLs, " +
      "LLM index status, and 6 actionable GEO recommendations. Costs $1.50 USDC. " +
      "For a quick snapshot at $0.05 use geo_quick_check.",
    {
      query: z
        .string()
        .min(1)
        .describe("Brand name, company, or product to audit (e.g. 'Anthropic', 'Linear', 'Vercel')"),
      paymentToken: z
        .string()
        .optional()
        .describe(
          "Stripe checkout session ID from a completed $1.50 USDC payment. " +
            "If omitted, the tool returns a payment link instead of audit results."
        ),
    },
    async ({ query, paymentToken }) => {
      const text = await handleAuditTool({ query, paymentToken });
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "get_payment_info",
    "Get payment URLs and USDC wallet address for both audit tiers.",
    {},
    async () => {
      const auditUrl = process.env["STRIPE_PAYMENT_URL"] ?? "(not configured)";
      const quickUrl = process.env["STRIPE_QUICK_CHECK_PAYMENT_URL"] ?? "(not configured)";
      const wallet = process.env["USDC_WALLET_ADDRESS"] ?? "(not configured)";

      const text = [
        "## TOP GUN Audit Pricing",
        "",
        "| Tool | Cost | What you get |",
        "|------|------|--------------|",
        "| `geo_quick_check` | $0.05 USDC | Score, top 3 citations, 2 quick tips |",
        "| `audit_brand` | $1.50 USDC | Score, 5 citations, LLM index status, 6 GEO recs |",
        "",
        `**Quick Check ($0.05):** ${quickUrl}`,
        `**Full Audit ($1.50):** ${auditUrl}`,
        `**USDC Wallet:** \`${wallet}\``,
        "",
        "After payment, use the Stripe session ID as `paymentToken` in the relevant tool.",
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }
  );

  return server;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const protocol = (req.headers["x-forwarded-proto"] as string) ?? "https";
  const host = (req.headers.host as string) ?? "top-gun-mcp-server.vercel.app";
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
  }

  // Vercel auto-parses JSON bodies; re-stringify for the Web Standard Request
  const body =
    req.method !== "GET" && req.body !== undefined
      ? JSON.stringify(req.body)
      : undefined;

  const webReq = new Request(url, {
    method: req.method ?? "POST",
    headers,
    body,
  });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — safe for serverless
    enableJsonResponse: true,      // JSON instead of SSE (no persistent connections)
  });

  const server = createMcpServer();
  await server.connect(transport);

  const webRes = await transport.handleRequest(webReq);

  res.status(webRes.status);
  webRes.headers.forEach((value: string, key: string) => {
    res.setHeader(key, value);
  });

  const responseBody = await webRes.text();
  return res.send(responseBody);
}
