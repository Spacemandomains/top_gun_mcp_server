import type { VercelRequest, VercelResponse } from "@vercel/node";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "TOP GUN GEO-Lens",
    version: "1.0.0",
    description:
      "Top Gun GEO Lens helps AI agents, founders, marketers, and SEO teams audit how visible a brand is inside AI search, AI agents, and answer-engine recommendations. " +
      "Use quick-check to scan a URL, company, product, or topic and return a concise visibility report with ranking signals, content gaps, and recommendations for improving agent discoverability.",
    "x-guidance":
      "Use GET /api/v1/quick-check?query=<brand|url|topic> to run a fast GEO visibility audit. " +
      "Returns a visibility score, ranking signals, content gaps, and recommendations. " +
      "Requires an X-PAYMENT (x402) or X-Payment-Token (Stripe) header.",
  },
  paths: {
    "/api/v1/quick-check": {
      get: {
        operationId: "quickCheck",
        summary: "Run a fast GEO visibility audit to test whether a brand, website, product, or topic is visible to AI agents and answer engines.",
        tags: ["Visibility"],
        "x-payment-info": {
          price: {
            mode: "fixed",
            currency: "USD",
            amount: "0.500000",
          },
          protocols: [
            {
              x402: {
                scheme: "exact",
                network: "base",
                asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                maxAmountRequired: "500000",
              },
            },
            {
              tempo: {
                method: "tempo",
                intent: "charge",
                realm: "top-gun-mcp-server.vercel.app",
              },
            },
          ],
        },
        parameters: [
          {
            name: "query",
            in: "query",
            required: true,
            description: "Brand name, company, or product to check",
            schema: { type: "string", minLength: 1 },
          },
          {
            name: "X-PAYMENT",
            in: "header",
            description: "x402 payment proof (base64-encoded)",
            schema: { type: "string" },
          },
          {
            name: "X-Payment-Token",
            in: "header",
            description: "Stripe checkout session ID from a completed $0.50 USDC payment",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Visibility quick-check result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["query", "score", "label", "topCitations", "quickTips", "checkedAt"],
                  properties: {
                    query: { type: "string" },
                    score: { type: "number", minimum: 0, maximum: 100 },
                    label: {
                      type: "string",
                      enum: ["Strong", "Moderate", "Weak", "Not Found"],
                    },
                    topCitations: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Citation" },
                    },
                    quickTips: { type: "array", items: { type: "string" } },
                    checkedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "402": {
            description: "Payment required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PaymentRequired" },
              },
            },
          },
        },
      },
    },
    "/api/v1/audit": {
      get: {
        operationId: "fullAudit",
        summary: "Full Audit — deep brand visibility analysis with citations, LLM index status, and recommendations.",
        tags: ["Visibility"],
        "x-payment-info": {
          price: {
            mode: "fixed",
            currency: "USD",
            amount: "1.500000",
          },
          protocols: [
            {
              x402: {
                scheme: "exact",
                network: "base",
                asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                maxAmountRequired: "1500000",
              },
            },
            {
              tempo: {
                method: "tempo",
                intent: "charge",
                realm: "top-gun-mcp-server.vercel.app",
              },
            },
          ],
        },
        parameters: [
          {
            name: "query",
            in: "query",
            required: true,
            description: "Brand name, company, or product to audit",
            schema: { type: "string", minLength: 1 },
          },
          {
            name: "X-PAYMENT",
            in: "header",
            description: "x402 payment proof (base64-encoded)",
            schema: { type: "string" },
          },
          {
            name: "X-Payment-Token",
            in: "header",
            description: "Stripe checkout session ID from a completed $1.50 USDC payment",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Full audit result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["query", "score", "label", "citations", "llmIndexStatus", "recommendations", "searchedAt"],
                  properties: {
                    query: { type: "string" },
                    score: { type: "number", minimum: 0, maximum: 100 },
                    label: {
                      type: "string",
                      enum: ["Strong", "Moderate", "Weak", "Not Found"],
                    },
                    citations: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Citation" },
                    },
                    llmIndexStatus: { $ref: "#/components/schemas/LLMIndexStatus" },
                    recommendations: { type: "array", items: { type: "string" } },
                    searchedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "402": {
            description: "Payment required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PaymentRequired" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Citation: {
        type: "object",
        required: ["url", "title", "snippet", "source", "position"],
        properties: {
          url: { type: "string", format: "uri" },
          title: { type: "string" },
          snippet: { type: "string" },
          source: { type: "string", enum: ["brave", "exa"] },
          position: { type: "integer", minimum: 1 },
        },
      },
      LLMIndexStatus: {
        type: "object",
        required: ["braveIndexed", "exaIndexed", "estimatedReach"],
        properties: {
          braveIndexed: { type: "boolean" },
          exaIndexed: { type: "boolean" },
          estimatedReach: {
            type: "string",
            enum: ["High", "Medium", "Low", "Unknown"],
          },
        },
      },
      PaymentRequired: {
        type: "object",
        properties: {
          x402Version: { type: "number" },
          error: { type: "string" },
          accepts: { type: "array", items: { type: "object" } },
          payment_options: { type: "array", items: { type: "object" } },
          challenges: { type: "array", items: { type: "object" } },
        },
      },
    },
  },
};

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(200).json(spec);
}
