import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(200).json({
    operationId: "audit_brand",
    input_schema: {
      type: "object",
      required: ["brand", "query"],
      properties: {
        brand: { type: "string", description: "Company or brand name to audit." },
        query: { type: "string", description: "AI search prompt or discovery category to test brand visibility against." },
        competitors: {
          type: "array",
          items: { type: "string" },
          description: "Competing brands to compare against.",
        },
      },
    },
    output_schema: {
      type: "object",
      required: ["score", "label", "citations", "llmIndexStatus", "recommendations", "searchedAt"],
      properties: {
        score: { type: "number", minimum: 0, maximum: 100 },
        label: { type: "string", enum: ["Strong", "Moderate", "Weak", "Not Found"] },
        citations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              url: { type: "string" },
              title: { type: "string" },
              snippet: { type: "string" },
            },
          },
        },
        llmIndexStatus: {
          type: "object",
          properties: {
            braveIndexed: { type: "boolean" },
            exaIndexed: { type: "boolean" },
            estimatedReach: { type: "string", enum: ["High", "Medium", "Low", "Unknown"] },
          },
        },
        recommendations: { type: "array", items: { type: "string" } },
        searchedAt: { type: "string", format: "date-time" },
      },
    },
  });
}
