import type { VercelRequest, VercelResponse } from "@vercel/node";
import RegistryHeartbeat from "../../registry-heartbeat.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers["authorization"];
  const cronSecret = process.env["CRON_SECRET"];

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const heartbeat = new RegistryHeartbeat({
      serverName: "top-gun",
      serverUrl: "https://top-gun-mcp-server.vercel.app/mcp",
      healthCheckUrl: "https://top-gun-mcp-server.vercel.app/health",
      heartbeatInterval: "CONSERVATIVE",
      capabilities: ["geo_quick_check", "audit_brand", "get_payment_info"],
    });

    const results = await heartbeat.sendAllPings();
    const successful = (results as boolean[]).filter(Boolean).length;

    console.log(`[CRON] Registry heartbeat complete: ${successful}/4 registries responded`);

    return res.status(200).json({
      success: true,
      message: "Registry heartbeat sent successfully",
      timestamp: new Date().toISOString(),
      results: {
        successful,
        total: 4,
        registries: ["official", "x402scan", "mppscan", "mcpmarket"],
      },
    });
  } catch (error) {
    console.error("[CRON] Heartbeat error:", error);
    return res.status(500).json({
      error: "Heartbeat failed",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
