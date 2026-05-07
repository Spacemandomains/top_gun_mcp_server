export function createPaymentChallenge({
  route,
  amount,
  service,
}: {
  route: string;
  amount: string;
  service: string;
}) {
  const realm = "top-gun-mcp-server.vercel.app";

  const request = Buffer.from(
    JSON.stringify({
      route,
      amount,
      currency: "USD",
      service,
      realm,
      timestamp: new Date().toISOString(),
    })
  ).toString("base64url");

  const challenge = {
    method: "tempo",
    intent: "charge",
    realm,
    amount,
    currency: "USD",
    request,
  };

  return new Response(
    JSON.stringify({
      error: "payment_required",
      message: `Payment is required to use ${service}.`,
      payment_options: [challenge],
      challenges: [challenge],
    }),
    {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Payment method="tempo" intent="charge" realm="${realm}" request="${request}"`,
      },
    }
  );
}
