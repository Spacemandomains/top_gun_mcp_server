// ============================================================================
// x402 v2 GATE — standard pay-per-call gating for the /api/v1 endpoints.
//
// The endpoints previously spoke x402 v1 + Tempo/MPP and never verified an
// x402 payment (any X-PAYMENT header was accepted). This module adds the
// standard x402 v2 flow the agent ecosystem actually uses:
//
//   - Unpaid request  -> HTTP 402 with a PAYMENT-REQUIRED header (base64
//     v2 challenge: exact scheme, USDC on Base mainnet, Bazaar discovery
//     extension so Coinbase Bazaar / Agentic Market can catalog the
//     endpoint after its first settled payment).
//   - Paid request    -> the PAYMENT-SIGNATURE (v2) or X-PAYMENT (v1)
//     header is verified with the facilitator BEFORE the tool runs, and
//     settled only AFTER it succeeds — a failed call is never charged.
//
// Facilitator choice (same rule as our other services):
//   - CDP_API_KEY_ID + CDP_API_KEY_SECRET set -> Coinbase CDP facilitator
//     (required for Bazaar cataloging).
//   - Otherwise X402_FACILITATOR_URL (default: PayAI public facilitator).
//
// The Stripe payment-token path in the handlers is unchanged.
// ============================================================================

import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  bazaarResourceServerExtension,
  declareDiscoveryExtension,
} from "@x402/extensions/bazaar";
import { createFacilitatorConfig } from "@coinbase/x402";

export const X402_NETWORK = "eip155:8453" as Network;
export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const PAY_TO = (process.env["X402_PAY_TO_ADDRESS"] ??
  "0xea8B7221507d1A0549e1ab96000a54401A7fDaC1") as `0x${string}`;

let serverPromise: Promise<x402ResourceServer> | null = null;

function getServer(): Promise<x402ResourceServer> {
  if (!serverPromise) {
    serverPromise = (async () => {
      const useCdp = Boolean(
        process.env["CDP_API_KEY_ID"] && process.env["CDP_API_KEY_SECRET"],
      );
      const client = useCdp
        ? new HTTPFacilitatorClient(createFacilitatorConfig())
        : new HTTPFacilitatorClient({
            url:
              process.env["X402_FACILITATOR_URL"] ??
              "https://facilitator.payai.network",
          });
      const server = new x402ResourceServer(client);
      server.register(X402_NETWORK, new ExactEvmScheme());
      server.registerExtension(bazaarResourceServerExtension);
      await server.initialize();
      return server;
    })();
  }
  return serverPromise;
}

export interface GateRoute {
  resource: string;
  description: string;
  amountAtomic: string;
  inputExample: Record<string, unknown>;
  inputProperties: Record<string, unknown>;
  inputRequired: string[];
  outputExample: Record<string, unknown>;
}

function requirementsFor(route: GateRoute) {
  return {
    scheme: "exact" as const,
    network: X402_NETWORK,
    asset: USDC_BASE,
    amount: route.amountAtomic,
    payTo: PAY_TO,
    maxTimeoutSeconds: 300,
    extra: { name: "USD Coin", version: "2" },
  };
}

function discoveryFor(route: GateRoute) {
  return declareDiscoveryExtension({
    input: route.inputExample,
    inputSchema: {
      properties: route.inputProperties,
      required: route.inputRequired,
    },
    output: { example: route.outputExample },
  });
}

export interface Challenge {
  header: string;
  body: Record<string, unknown>;
}

/** Build the v2 402 challenge for a route (header value + JSON body). */
export async function buildChallenge(route: GateRoute): Promise<Challenge> {
  const server = await getServer();
  const required = await server.createPaymentRequiredResponse(
    [requirementsFor(route)],
    {
      url: route.resource,
      description: route.description,
      mimeType: "application/json",
    },
    `Payment required: this call costs $${(Number(route.amountAtomic) / 1_000_000).toFixed(2)} USDC.`,
    discoveryFor(route),
  );
  const body = JSON.parse(JSON.stringify(required)) as Record<string, unknown>;
  // Catalogs read extensions.bazaar.info.input — make sure it describes this
  // GET endpoint (query params), matching what the Bazaar expects.
  const bazaar = (body.extensions as Record<string, unknown> | undefined)?.[
    "bazaar"
  ] as Record<string, unknown> | undefined;
  if (bazaar) {
    const info = (bazaar.info ?? {}) as Record<string, unknown>;
    info.input = {
      type: "http",
      method: "GET",
      queryParams: route.inputExample,
    };
    info.output = { type: "json", example: route.outputExample };
    bazaar.info = info;
  }
  return { header: Buffer.from(JSON.stringify(body)).toString("base64"), body };
}

export interface VerifyOk {
  ok: true;
  payload: unknown;
  payer?: string;
}
export interface VerifyFail {
  ok: false;
  reason: string;
}

/** Verify a buyer's payment header against the route's requirements. */
export async function verifyPayment(
  headerValue: string,
  route: GateRoute,
): Promise<VerifyOk | VerifyFail> {
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(headerValue, "base64").toString("utf8"));
  } catch {
    return { ok: false, reason: "Payment header was not valid base64 JSON." };
  }
  try {
    const server = await getServer();
    const result = await server.verifyPayment(
      payload as never,
      requirementsFor(route) as never,
    );
    const r = result as unknown as Record<string, unknown>;
    if (r["isValid"]) {
      return { ok: true, payload, payer: r["payer"] as string | undefined };
    }
    return {
      ok: false,
      reason: String(r["invalidReason"] ?? r["invalidMessage"] ?? "Payment did not verify."),
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Payment verification failed.",
    };
  }
}

/** Settle a previously verified payment. Returns the receipt header value. */
export async function settlePayment(
  payload: unknown,
  route: GateRoute,
): Promise<{ ok: true; header: string } | { ok: false; reason: string }> {
  try {
    const server = await getServer();
    const result = await server.settlePayment(
      payload as never,
      requirementsFor(route) as never,
    );
    const r = result as unknown as Record<string, unknown>;
    if (r["success"]) {
      return {
        ok: true,
        header: Buffer.from(JSON.stringify(result)).toString("base64"),
      };
    }
    return {
      ok: false,
      reason: String(r["errorReason"] ?? r["errorMessage"] ?? "Settlement failed."),
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Settlement failed.",
    };
  }
}

/** Read the payment header a buyer sent (v2 name first, then v1). */
export function paymentHeaderValue(
  headers: Record<string, string | string[] | undefined>,
): string | null {
  const v2 = headers["payment-signature"];
  if (typeof v2 === "string" && v2) return v2;
  const v1 = headers["x-payment"];
  if (typeof v1 === "string" && v1) return v1;
  return null;
}
