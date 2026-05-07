import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(200).json({
    operationId: "geo_quick_check",
    input_schema: {
      type: "object",
      required: ["brand", "query"],
      properties: {
        brand: { type: "string", description: "Company or brand name to check." },
        query: { type: "string", description: "Search prompt to test visibility against." },
        competitors: {
          type: "array",
          items: { type: "string" },
          description: "Competing brands to compare against.",
        },
      },
    },
    output_schema: {
      type: "object",
      required: ["score", "label", "topCitations", "quickTips", "checkedAt"],
      properties: {
        score: { type: "number", minimum: 0, maximum: 100 },
        label: { type: "string", enum: ["Strong", "Moderate", "Weak", "Not Found"] },
        topCitations: {
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
        quickTips: { type: "array", items: { type: "string" } },
        checkedAt: { type: "string", format: "date-time" },
      },
    },
  });
}
