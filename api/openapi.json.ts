import type { VercelRequest, VercelResponse } from "@vercel/node";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "TOP GUN GEO-Lens",
    version: "1.0.0",
    description: "Brand visibility auditing across LLM-facing search indexes (Brave + Exa).",
    "x-guidance":
      "Use GET /api/v1/quick-check?query=<brand> for a fast $0.50 USDC visibility snapshot. " +
      "Use GET /api/v1/audit?query=<brand> for a full $1.50 USDC audit with citations, LLM index status, and recommendations. " +
      "Both endpoints require an X-Payment-Token header containing a completed Stripe session ID.",
  },
  paths: {
    "/api/v1/quick-check": {
      get: {
        operationId: "quickCheck",
        summary: "Quick Check — fast brand visibility snapshot",
        tags: ["Visibility"],
        "x-payment-info": {
          price: {
            mode: "fixed",
            currency: "USD",
            amount: "0.500000",
          },
          protocols: [
            { x402: {} },
            {
              mpp: {
                method: "",
                intent: "",
                currency: "",
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
            name: "X-Payment-Token",
            in: "header",
            required: true,
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
            description: "Payment required — complete Stripe checkout and retry with session ID",
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
        summary: "Full Audit — deep brand visibility analysis with recommendations",
        tags: ["Visibility"],
        "x-payment-info": {
          price: {
            mode: "fixed",
            currency: "USD",
            amount: "1.500000",
          },
          protocols: [
            { x402: {} },
            {
              mpp: {
                method: "",
                intent: "",
                currency: "",
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
            name: "X-Payment-Token",
            in: "header",
            required: true,
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
                  required: [
                    "query",
                    "score",
                    "label",
                    "citations",
                    "llmIndexStatus",
                    "recommendations",
                    "searchedAt",
                  ],
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
            description: "Payment required — complete Stripe checkout and retry with session ID",
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
        required: ["error", "message", "amount", "currency", "paymentUrl"],
        properties: {
          error: { type: "string", enum: ["payment_required"] },
          message: { type: "string" },
          amount: { type: "string" },
          currency: { type: "string", enum: ["USDC"] },
          paymentUrl: { type: "string", format: "uri" },
          walletAddress: { type: "string" },
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
