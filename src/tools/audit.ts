import { z } from "zod";
import { runAudit } from "../lib/audit.js";
import { verifyStripeSession, buildPaymentRequired } from "../lib/payment.js";
import type { AuditResult } from "../lib/types.js";

export const AUDIT_PRICE_CENTS = 150; // $1.50

export const AuditInputSchema = z.object({
  query: z.string().min(1).describe("Brand name, company, or product to audit"),
  paymentToken: z
    .string()
    .optional()
    .describe("Stripe session ID from a completed $1.50 USDC payment"),
});

export type AuditInput = z.infer<typeof AuditInputSchema>;

export async function handleAuditTool(input: AuditInput): Promise<string> {
  const stripeSecretKey = process.env["STRIPE_SECRET_KEY"] ?? "";
  const paymentUrl = process.env["STRIPE_PAYMENT_URL"] ?? "";
  const walletAddress = process.env["USDC_WALLET_ADDRESS"];

  if (!input.paymentToken) {
    return formatPaymentRequired(buildPaymentRequired(paymentUrl, "1.50", walletAddress));
  }

  const isPaid = await verifyStripeSession(input.paymentToken, stripeSecretKey, AUDIT_PRICE_CENTS);
  if (!isPaid) {
    return [
      "Payment token is invalid, unpaid, or was issued for a lower-priced tier.",
      "",
      `Complete the $1.50 payment at: ${paymentUrl}`,
      "Then retry with the Stripe session ID as `paymentToken`.",
    ].join("\n");
  }

  const result = await runAudit(input.query, {
    braveApiKey: process.env["BRAVE_SEARCH_API_KEY"],
    exaApiKey: process.env["EXA_API_KEY"],
  });

  return formatAuditResult(result);
}

export function formatPaymentRequired(req: ReturnType<typeof buildPaymentRequired>): string {
  return [
    "## Payment Required",
    "",
    `**Cost:** $${req.amount} ${req.currency}`,
    `**Pay here:** ${req.paymentUrl}`,
    ...(req.walletAddress ? [`**USDC Wallet:** \`${req.walletAddress}\``] : []),
    "",
    "After payment, call this tool again with the Stripe session ID as `paymentToken`.",
  ].join("\n");
}

function formatAuditResult(r: AuditResult): string {
  const lines: string[] = [
    `## TOP GUN GEO-Lens Audit: ${r.query}`,
    "",
    `**Visibility Score:** ${r.score}/100 — **${r.label}**`,
    "",
    "### LLM Index Status",
    `- Brave indexed: ${r.llmIndexStatus.braveIndexed ? "Yes" : "No"}`,
    `- Exa indexed: ${r.llmIndexStatus.exaIndexed ? "Yes" : "No"}`,
    `- Estimated LLM reach: **${r.llmIndexStatus.estimatedReach}**`,
    "",
    "### Top Citations",
  ];

  if (r.citations.length === 0) {
    lines.push("No citations found.");
  } else {
    for (const c of r.citations.slice(0, 5)) {
      lines.push(`${c.position}. [${c.title}](${c.url})`);
      if (c.snippet) lines.push(`   > ${c.snippet.slice(0, 120)}...`);
    }
  }

  lines.push("", "### GEO Recommendations");
  for (const rec of r.recommendations) {
    lines.push(`- ${rec}`);
  }

  lines.push("", `_Audited at ${r.searchedAt}_`);
  return lines.join("\n");
}
