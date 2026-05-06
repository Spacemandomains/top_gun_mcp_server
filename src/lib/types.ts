export interface SearchResult {
  url: string;
  title: string;
  description: string;
  source: "brave" | "exa";
}

export interface AuditResult {
  query: string;
  score: number;
  label: "Strong" | "Moderate" | "Weak" | "Not Found";
  citations: Citation[];
  llmIndexStatus: LLMIndexStatus;
  recommendations: string[];
  searchedAt: string;
}

export interface Citation {
  url: string;
  title: string;
  snippet: string;
  source: "brave" | "exa";
  position: number;
}

export interface LLMIndexStatus {
  braveIndexed: boolean;
  exaIndexed: boolean;
  estimatedReach: "High" | "Medium" | "Low" | "Unknown";
}

export interface QuickCheckResult {
  query: string;
  score: number;
  label: "Strong" | "Moderate" | "Weak" | "Not Found";
  topCitations: Citation[];
  quickTips: string[];
  checkedAt: string;
}

export interface PaymentRequired {
  error: "payment_required";
  message: string;
  amount: string;
  currency: "USDC";
  paymentUrl: string;
  walletAddress?: string;
}
