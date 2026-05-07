import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    status: "ok",
    server: "top-gun-mcp-server",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
}
