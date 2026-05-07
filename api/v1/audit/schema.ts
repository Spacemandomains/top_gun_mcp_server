import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(200).json({
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: true,
    },
    output_schema: {
      type: "object",
      required: ["score", "label", "citations", "llmIndexStatus", "recommendations"],
      properties: {
        score: { type: "number", minimum: 0, maximum: 100 },
        label: {
          type: "string",
          enum: ["Strong", "Moderate", "Weak", "Not Found"],
        },
        citations: { type: "array", items: { type: "object" } },
        llmIndexStatus: { type: "object" },
        recommendations: { type: "array", items: { type: "string" } },
        searchedAt: { type: "string", format: "date-time" },
      },
    },
  });
}
