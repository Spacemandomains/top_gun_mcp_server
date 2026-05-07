interface StripeSession {
  payment_status?: string;
  amount_total?: number; // cents
}

async function fetchStripeSession(
  sessionId: string,
  stripeSecretKey: string
): Promise<StripeSession | null> {
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${stripeSecretKey}` } }
    );
    if (!res.ok) return null;
    return res.json() as Promise<StripeSession>;
  } catch {
    return null;
  }
}

export async function verifyStripeSession(
  sessionId: string,
  stripeSecretKey: string,
  expectedCents: number
): Promise<boolean> {
  const session = await fetchStripeSession(sessionId, stripeSecretKey);
  if (!session) return false;
  if (session.payment_status !== "paid") return false;
  if (session.amount_total !== undefined && session.amount_total < expectedCents) {
    return false;
  }
  return true;
}

// ── x402 ─────────────────────────────────────────────────────────────────────

const DEFAULT_PAY_TO = "0xea8B7221507d1A0549e1ab96000a54401A7fDaC1";
const USDC_BASE_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export interface X402Accept {
  scheme: "exact";
  network: "base";
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: "application/json";
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  schema_url: string;
}

export interface X402PaymentRequired {
  x402Version: 1;
  error: "Payment Required";
  accepts: X402Accept[];
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  schema_url?: string;
  extensions?: Record<string, unknown>;
}

export function buildX402Body(
  resource: string,
  description: string,
  maxAmountRequired: string,
  inputSchema: Record<string, unknown>,
  outputSchema: Record<string, unknown>
): X402PaymentRequired {
  const payTo = process.env["X402_PAY_TO_ADDRESS"] || DEFAULT_PAY_TO;
  const baseUrl = process.env["TOP_GUN_API_URL"] ?? "https://top-gun-mcp-server.vercel.app";
  const schemaUrl = `${baseUrl}${new URL(resource).pathname}/schema`;

  const accept: X402Accept = {
    scheme: "exact",
    network: "base",
    maxAmountRequired,
    resource,
    description,
    mimeType: "application/json",
    payTo,
    maxTimeoutSeconds: 300,
    asset: USDC_BASE_ASSET,
    input_schema: inputSchema,
    output_schema: outputSchema,
    schema_url: schemaUrl,
  };

  // Bazaar/agentcash discovery extension — library reads inputSchema from:
  //   extensions.bazaar.schema.properties.input.properties.body  (POST)
  //   extensions.bazaar.schema.properties.input.properties.queryParams  (GET fallback)
  const bazaarSchema = {
    properties: {
      input: {
        properties: {
          body: inputSchema,
          queryParams: inputSchema,
        },
      },
    },
  };

  return {
    x402Version: 1,
    error: "Payment Required",
    accepts: [accept],
    input_schema: inputSchema,
    output_schema: outputSchema,
    schema_url: schemaUrl,
    extensions: {
      bazaar: {
        schema: bazaarSchema,
      },
    },
  };
}

// ── MPP / Tempo (header only) ─────────────────────────────────────────────────

export function buildTempoHeader(
  realm: string,
  amount: string,
  paymentUrl: string
): string {
  const payload = { method: "tempo", intent: "charge", realm, amount, currency: "USD", paymentUrl };
  const request = btoa(JSON.stringify(payload));
  return (
    `Payment method="tempo" intent="charge" ` +
    `realm="${realm}" request="${request}"`
  );
}

// Kept for MCP tool text responses
export function buildPaymentRequired(
  paymentUrl: string,
  amount: string,
  walletAddress?: string
) {
  return {
    error: "payment_required" as const,
    message:
      `This costs $${amount} USDC. Complete payment and retry with the ` +
      "X-Payment-Token header set to your Stripe session ID.",
    amount,
    currency: "USDC" as const,
    paymentUrl,
    ...(walletAddress ? { walletAddress } : {}),
  };
}
