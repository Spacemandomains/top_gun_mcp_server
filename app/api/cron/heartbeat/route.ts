import { NextRequest, NextResponse } from "next/server";
import RegistryHeartbeat from "@/registry-heartbeat";

export const runtime = "nodejs";

/**
 * Vercel Cron Job — Registry Heartbeat for Top Gun MCP Server
 *
 * Called automatically by Vercel scheduler every 20 minutes.
 * Pings all registries to keep the server visible and active.
 *
 * Security: Requires CRON_SECRET environment variable for verification.
 */
export async function GET(req: NextRequest) {
  // Verify request is from Vercel's cron scheduler
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const heartbeat = new RegistryHeartbeat({
      serverName: "top-gun",
      serverUrl: "https://top-gun-mcp.vercel.app/mcp",
      healthCheckUrl: "https://top-gun-mcp.vercel.app/health",
      heartbeatInterval: "CONSERVATIVE", // 15-30 minutes between pings
      capabilities: [
        "geo_quick_check",
        "audit_brand",
        "get_payment_info",
      ]
    });

    // Send pings to all registries
    const results = await heartbeat.sendAllPings();
    const successful = results.filter(r => r).length;

    console.log(`[CRON] Registry heartbeat complete: ${successful}/4 registries responded`);

    return NextResponse.json({
      success: true,
      message: "Registry heartbeat sent successfully",
      timestamp: new Date().toISOString(),
      results: {
        successful,
        total: 4,
        registries: ["official", "x402scan", "mppscan", "mcpmarket"]
      }
    });
  } catch (error) {
    console.error("[CRON] Heartbeat error:", error);
    return NextResponse.json(
      {
        error: "Heartbeat failed",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
