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
      required: ["score", "label", "topCitations", "quickTips"],
      properties: {
        score: { type: "number", minimum: 0, maximum: 100 },
        label: {
          type: "string",
          enum: ["Strong", "Moderate", "Weak", "Not Found"],
        },
        topCitations: { type: "array", items: { type: "object" } },
        quickTips: { type: "array", items: { type: "string" } },
        checkedAt: { type: "string", format: "date-time" },
      },
    },
  });
}
