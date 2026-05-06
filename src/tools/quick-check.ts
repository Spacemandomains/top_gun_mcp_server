import { z } from "zod";
import { runQuickCheck } from "../lib/audit.js";
import { verifyStripeSession, buildPaymentRequired } from "../lib/payment.js";
import { formatPaymentRequired } from "./audit.js";
import type { QuickCheckResult } from "../lib/types.js";

export const QUICK_CHECK_PRICE_CENTS = 150; // $1.50

export const QuickCheckInputSchema = z.object({
  query: z.string().min(1).describe("Brand name, company, or product to check"),
  paymentToken: z
    .string()
    .optional()
    .describe("Stripe session ID from a completed $1.50 USDC payment"),
});

export type QuickCheckInput = z.infer<typeof QuickCheckInputSchema>;

export async function handleQuickCheckTool(input: QuickCheckInput): Promise<string> {
  const stripeSecretKey = process.env["STRIPE_SECRET_KEY"] ?? "";
  const paymentUrl = process.env["STRIPE_QUICK_CHECK_PAYMENT_URL"] ?? "";
  const walletAddress = process.env["USDC_WALLET_ADDRESS"];

  if (!input.paymentToken) {
    return formatPaymentRequired(buildPaymentRequired(paymentUrl, "1.50", walletAddress));
  }

  const isPaid = await verifyStripeSession(
    input.paymentToken,
    stripeSecretKey,
    QUICK_CHECK_PRICE_CENTS
  );
  if (!isPaid) {
    return [
      "Payment token is invalid or unpaid.",
      "",
      `Complete the $1.50 payment at: ${paymentUrl}`,
      "Then retry with the Stripe session ID as `paymentToken`.",
    ].join("\n");
  }

  const result = await runQuickCheck(input.query, {
    braveApiKey: process.env["BRAVE_SEARCH_API_KEY"],
    exaApiKey: process.env["EXA_API_KEY"],
  });

  return formatQuickCheckResult(result);
}

function formatQuickCheckResult(r: QuickCheckResult): string {
  const lines: string[] = [
    `## TOP GUN Quick Check: ${r.query}`,
    "",
    `**Visibility Score:** ${r.score}/100 — **${r.label}**`,
    "",
    "### Top Citations",
  ];

  if (r.topCitations.length === 0) {
    lines.push("No citations found.");
  } else {
    for (const c of r.topCitations) {
      lines.push(`${c.position}. [${c.title}](${c.url})`);
      if (c.snippet) lines.push(`   > ${c.snippet.slice(0, 100)}...`);
    }
  }

  lines.push("", "### Quick Tips");
  for (const tip of r.quickTips) {
    lines.push(`- ${tip}`);
  }

  lines.push("", `_Checked at ${r.checkedAt}_`);
  return lines.join("\n");
}
