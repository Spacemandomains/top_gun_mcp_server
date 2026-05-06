interface StripeSession {
  payment_status?: string;
  amount_total?: number; // cents
}

async function fetchStripeSession(
  sessionId: string,
  stripeSecretKey: string
): Promise<StripeSession | null> {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${stripeSecretKey}` } }
  );
  if (!res.ok) return null;
  return res.json() as Promise<StripeSession>;
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
  extra: { name: string; version: string };
  inputSchema: object;
  outputSchema: object;
}

export interface X402PaymentRequired {
  x402Version: 1;
  error: string;
  accepts: X402Accept[];
}

export function buildX402Required(
  resource: string,
  description: string,
  maxAmountRequired: string,
  inputSchema: object,
  outputSchema: object
): { header: string; body: X402PaymentRequired } {
  const payTo = process.env["X402_PAY_TO_ADDRESS"] ?? "";
  const accept: X402Accept = {
    scheme: "exact",
    network: "base",
    maxAmountRequired,
    resource,
    description,
    mimeType: "application/json",
    payTo,
    maxTimeoutSeconds: 300,
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
    extra: { name: "USD Coin", version: "2" },
    inputSchema,
    outputSchema,
  };
  const body: X402PaymentRequired = {
    x402Version: 1,
    error: "X-PAYMENT header is required",
    accepts: [accept],
  };
  const header = `x402 realm="${resource}"`;
  return { header, body };
}

// ── MPP / Tempo ───────────────────────────────────────────────────────────────

export interface TempoChallenge {
  method: "tempo";
  intent: "charge";
  realm: string;
  amount: string;
  currency: "USD";
  request: string;
}

export interface MPPPaymentRequired {
  error: "payment_required";
  message: string;
  payment_options: TempoChallenge[];
  challenges: TempoChallenge[];
}

export function buildTempoChallenge(
  realm: string,
  amount: string,
  paymentUrl: string
): TempoChallenge {
  const payload = { method: "tempo", intent: "charge", realm, amount, currency: "USD", paymentUrl };
  const request = btoa(JSON.stringify(payload));
  return { method: "tempo", intent: "charge", realm, amount, currency: "USD", request };
}

export function buildMPPPaymentRequired(
  realm: string,
  amount: string,
  paymentUrl: string,
  message: string
): { header: string; body: MPPPaymentRequired } {
  const challenge = buildTempoChallenge(realm, amount, paymentUrl);
  const header =
    `Payment method="${challenge.method}" intent="${challenge.intent}" ` +
    `realm="${challenge.realm}" request="${challenge.request}"`;
  const body: MPPPaymentRequired = {
    error: "payment_required",
    message,
    payment_options: [challenge],
    challenges: [challenge],
  };
  return { header, body };
}

// Kept for backward compatibility with MCP tool responses
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
