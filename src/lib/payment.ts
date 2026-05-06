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
  // Guard: session amount must match expected price tier
  if (session.amount_total !== undefined && session.amount_total < expectedCents) {
    return false;
  }
  return true;
}

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
