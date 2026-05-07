import type { VercelRequest, VercelResponse } from "@vercel/node";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "TOP GUN — GEO-Lens | Brand Visibility Auditing for LLMs",
    version: "1.0.0",
    description:
      "TOP GUN GEO-Lens audits how brands appear across LLMs, AI search, answer engines, and recommendation systems. " +
      "Use Quick Check for a fast visibility snapshot, or Full Audit for a deep multi-query brand intelligence report.",
    "x-guidance":
      "All endpoints require payment via x402 (X-PAYMENT header) or Stripe (X-Payment-Token header). " +
      "Unpaid requests return HTTP 402 with a valid x402 accepts array. " +
      "Quick Check: GET /api/v1/quick-check?query=<brand>. Full Audit: GET /api/v1/audit?query=<brand>.",
  },
  tags: [
    { name: "brand-visibility", description: "Brand visibility scoring and reporting" },
    { name: "geo", description: "Generative Engine Optimization — visibility in LLM-generated answers" },
    { name: "ai-search", description: "AI search and answer engine indexing analysis" },
    { name: "llm", description: "Large Language Model recommendation and citation tracking" },
    { name: "mcp", description: "Model Context Protocol server" },
    { name: "ai-servers", description: "AI Servers" },
  ],
  paths: {
    "/api/v1/quick-check": {
      post: {
        operationId: "geo_quick_check",
        summary: "Run a quick GEO visibility check — $0.50 USDC",
        description: "Checks how visible a brand is for a specific AI search query. Price: $0.50 USDC.",
        tags: ["brand-visibility", "geo", "ai-search", "llm", "mcp", "ai-servers"],
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
                resource: "https://top-gun-mcp-server.vercel.app/api/v1/quick-check",
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
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["brand", "query"],
                properties: {
                  brand: { type: "string", description: "The company or brand name" },
                  query: { type: "string", description: "The search prompt to test visibility against" },
                  competitors: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional competing brands to compare against",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "GEO quick check result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["score", "label", "topCitations", "quickTips", "checkedAt"],
                  properties: {
                    score: { type: "number", minimum: 0, maximum: 100, description: "Visibility score (0–100)." },
                    label: { type: "string", enum: ["Strong", "Moderate", "Weak", "Not Found"] },
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
      get: {
        operationId: "geo_quick_check",
        summary: "Fast GEO-Lens visibility check showing whether a brand appears in AI search, answer engines, and LLM-style recommendations. Price: $0.50 USDC.",
        tags: ["brand-visibility", "geo", "ai-search", "llm", "mcp", "ai-servers"],
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
                resource: "https://top-gun-mcp-server.vercel.app/api/v1/quick-check",
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
            name: "brand",
            in: "query",
            required: true,
            description: "Brand or company name to check",
            schema: { type: "string", minLength: 1 },
          },
          {
            name: "query",
            in: "query",
            required: true,
            description: "Search or prompt category to test visibility against",
            schema: { type: "string", minLength: 1 },
          },
          {
            name: "competitors",
            in: "query",
            description: "Optional comma-separated competitor brand names to compare against",
            schema: { type: "string" },
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
            description: "Stripe checkout session ID from a completed $0.50 payment",
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
                  required: ["score", "label", "topCitations", "quickTips", "checkedAt"],
                  properties: {
                    score: { type: "number", minimum: 0, maximum: 100, description: "Visibility score (0–100)." },
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
      post: {
        operationId: "audit_brand",
        summary: "Run a full GEO brand audit — $1.50 USDC",
        description: "Audits brand visibility across AI discovery and search surfaces. Price: $1.50 USDC.",
        tags: ["brand-visibility", "geo", "ai-search", "llm", "mcp", "ai-servers"],
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
                resource: "https://top-gun-mcp-server.vercel.app/api/v1/audit",
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
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["brand", "query"],
                properties: {
                  brand: { type: "string", description: "The company or brand name" },
                  query: { type: "string", description: "The AI search prompt or discovery category" },
                  competitors: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional competing brands to compare against",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Full GEO brand audit result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["score", "label", "citations", "llmIndexStatus", "recommendations", "searchedAt"],
                  properties: {
                    score: { type: "number", minimum: 0, maximum: 100, description: "Visibility score (0–100)." },
                    label: { type: "string", enum: ["Strong", "Moderate", "Weak", "Not Found"] },
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
      get: {
        operationId: "audit_brand",
        summary: "Full TOP GUN GEO-Lens brand visibility audit measuring brand visibility, competitor presence, answer-engine positioning, and LLM recommendation strength. Price: $1.50 USDC.",
        tags: ["brand-visibility", "geo", "ai-search", "llm", "mcp", "ai-servers"],
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
                resource: "https://top-gun-mcp-server.vercel.app/api/v1/audit",
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
            name: "brand",
            in: "query",
            required: true,
            description: "Brand or company name to audit",
            schema: { type: "string", minLength: 1 },
          },
          {
            name: "query",
            in: "query",
            required: true,
            description: "AI search prompt or discovery category to test brand visibility against",
            schema: { type: "string", minLength: 1 },
          },
          {
            name: "competitors",
            in: "query",
            description: "Optional comma-separated competitor brand names to compare against",
            schema: { type: "string" },
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
            description: "Stripe checkout session ID from a completed $1.50 payment",
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
                  required: ["score", "label", "citations", "llmIndexStatus", "recommendations", "searchedAt"],
                  properties: {
                    score: { type: "number", minimum: 0, maximum: 100, description: "Visibility score (0–100)." },
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
        required: ["url", "title", "snippet"],
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
        required: ["x402Version", "error", "accepts"],
        properties: {
          x402Version: { type: "integer", enum: [1] },
          error: { type: "string", enum: ["Payment Required"] },
          accepts: {
            type: "array",
            items: {
              type: "object",
              required: ["scheme", "network", "maxAmountRequired", "resource", "description", "mimeType", "payTo", "maxTimeoutSeconds", "asset", "input_schema", "output_schema"],
              properties: {
                scheme: { type: "string" },
                network: { type: "string" },
                maxAmountRequired: { type: "string" },
                resource: { type: "string", format: "uri" },
                description: { type: "string" },
                mimeType: { type: "string" },
                payTo: { type: "string" },
                maxTimeoutSeconds: { type: "integer" },
                asset: { type: "string" },
                input_schema: { type: "object" },
                output_schema: { type: "object" },
              },
            },
          },
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
