import type { VercelRequest, VercelResponse } from "@vercel/node";

// x402 discovery document, served at /.well-known/x402 via the rewrite in
// vercel.json. Lists every paid resource so catalogs and buyer agents can
// find the endpoints from the origin alone.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.status(200).json({
    version: 1,
    resources: [
      "https://top-gun-mcp-server.vercel.app/api/v1/quick-check",
      "https://top-gun-mcp-server.vercel.app/api/v1/audit",
    ],
  });
}
