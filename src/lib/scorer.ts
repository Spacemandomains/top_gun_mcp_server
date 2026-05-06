import type { AuditResult, Citation, LLMIndexStatus, QuickCheckResult, SearchResult } from "./types.js";

const SCORE_LABELS = [
  { min: 75, label: "Strong" as const },
  { min: 50, label: "Moderate" as const },
  { min: 25, label: "Weak" as const },
  { min: 0, label: "Not Found" as const },
];

// High-authority domains that LLMs heavily train on
const HIGH_AUTHORITY_DOMAINS = [
  "wikipedia.org", "github.com", "reddit.com", "stackoverflow.com",
  "medium.com", "dev.to", "techcrunch.com", "producthunt.com",
  "news.ycombinator.com", "arxiv.org", "scholar.google.com",
  "g2.com", "capterra.com", "trustpilot.com", "crunchbase.com",
  "linkedin.com", "twitter.com", "x.com",
];

export function scoreResults(
  query: string,
  results: SearchResult[]
): AuditResult {
  const normalizedQuery = query.toLowerCase();
  const citations: Citation[] = [];
  let rawScore = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const text = `${r.title} ${r.description}`.toLowerCase();
    const positionWeight = 1 - i * 0.07; // top results weight more
    const domainWeight = isHighAuthority(r.url) ? 1.4 : 1.0;
    const mentionWeight = countMentions(normalizedQuery, text) > 0 ? 1.0 : 0.2;

    const itemScore = 10 * positionWeight * domainWeight * mentionWeight;
    rawScore += itemScore;

    citations.push({
      url: r.url,
      title: r.title,
      snippet: r.description.slice(0, 200),
      source: r.source,
      position: i + 1,
    });
  }

  // Clamp 0–100
  const score = Math.min(100, Math.round(rawScore));
  const label = SCORE_LABELS.find((s) => score >= s.min)!.label;

  const braveResults = results.filter((r) => r.source === "brave");
  const exaResults = results.filter((r) => r.source === "exa");

  const llmIndexStatus: LLMIndexStatus = {
    braveIndexed: braveResults.length > 0,
    exaIndexed: exaResults.length > 0,
    estimatedReach: estimateReach(score, citations),
  };

  return {
    query,
    score,
    label,
    citations,
    llmIndexStatus,
    recommendations: generateRecommendations(query, score, citations),
    searchedAt: new Date().toISOString(),
  };
}

function isHighAuthority(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return HIGH_AUTHORITY_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

function countMentions(query: string, text: string): number {
  const words = query.split(/\s+/);
  return words.filter((w) => text.includes(w)).length;
}

function estimateReach(score: number, citations: Citation[]): LLMIndexStatus["estimatedReach"] {
  const hasHighAuth = citations.some((c) => isHighAuthority(c.url));
  if (score >= 75 && hasHighAuth) return "High";
  if (score >= 40 || hasHighAuth) return "Medium";
  if (score > 0) return "Low";
  return "Unknown";
}

export function quickScoreResults(query: string, results: SearchResult[]): QuickCheckResult {
  const normalizedQuery = query.toLowerCase();
  let rawScore = 0;
  const citations: Citation[] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const text = `${r.title} ${r.description}`.toLowerCase();
    const positionWeight = 1 - i * 0.07;
    const domainWeight = isHighAuthority(r.url) ? 1.4 : 1.0;
    const mentionWeight = countMentions(normalizedQuery, text) > 0 ? 1.0 : 0.2;
    rawScore += 10 * positionWeight * domainWeight * mentionWeight;

    citations.push({
      url: r.url,
      title: r.title,
      snippet: r.description.slice(0, 150),
      source: r.source,
      position: i + 1,
    });
  }

  const score = Math.min(100, Math.round(rawScore));
  const label = SCORE_LABELS.find((s) => score >= s.min)!.label;

  return {
    query,
    score,
    label,
    topCitations: citations.slice(0, 3),
    quickTips: generateQuickTips(query, score, citations),
    checkedAt: new Date().toISOString(),
  };
}

function generateQuickTips(query: string, score: number, citations: Citation[]): string[] {
  const citedDomains = new Set(
    citations.map((c) => {
      try { return new URL(c.url).hostname.replace(/^www\./, ""); } catch { return ""; }
    })
  );

  if (score < 25) {
    return [
      `"${query}" has minimal LLM visibility. Start with a Wikipedia page and a Product Hunt listing.`,
      "Run a full audit ($1.50) for a complete citation breakdown and prioritized GEO roadmap.",
    ];
  }
  if (score < 50) {
    const missing = !citedDomains.has("github.com") ? "GitHub" : !citedDomains.has("reddit.com") ? "Reddit" : "high-authority directories";
    return [
      `Moderate presence detected. Boost it by getting listed on ${missing} and Crunchbase.`,
      "Run a full audit ($1.50) to see all citations and a complete recommendation set.",
    ];
  }
  if (score < 75) {
    return [
      `Good visibility for "${query}". Add JSON-LD Organization schema to your site to reinforce it.`,
      "Run a full audit ($1.50) to identify specific citation gaps and reach estimates.",
    ];
  }
  return [
    `Strong LLM visibility for "${query}". Keep profiles current and monitor monthly.`,
    "Run a full audit ($1.50) for a detailed citation report and drift analysis.",
  ];
}

function generateRecommendations(
  query: string,
  score: number,
  citations: Citation[]
): string[] {
  const recs: string[] = [];
  const citedDomains = new Set(
    citations.map((c) => {
      try { return new URL(c.url).hostname.replace(/^www\./, ""); } catch { return ""; }
    })
  );

  if (score < 25) {
    recs.push(`Create a Wikipedia page for "${query}" — LLMs heavily cite Wikipedia.`);
    recs.push("Publish a detailed overview post on a high-authority platform (Medium, Dev.to, or your own blog with schema markup).");
    recs.push("Submit your product to Product Hunt and G2 to build LLM-indexable profile pages.");
  }

  if (score < 50) {
    if (!citedDomains.has("github.com"))
      recs.push("Create a public GitHub repository with a well-structured README — LLMs index GitHub heavily.");
    if (!citedDomains.has("reddit.com"))
      recs.push("Engage in relevant Reddit communities (r/SaaS, r/startups, etc.) with informative posts.");
    recs.push("Issue a press release distributed to sources indexed by Brave News and Exa.");
  }

  if (score < 75) {
    recs.push("Publish technical documentation or an API reference — structured docs rank well in LLM training data.");
    recs.push(`Add JSON-LD schema markup (Organization, Product) to your website so crawlers surface "${query}" with full context.`);
    if (!citedDomains.has("crunchbase.com"))
      recs.push("Create or claim your Crunchbase profile — commonly cited by LLMs for company information.");
  }

  if (score >= 75) {
    recs.push("Maintain citation quality: keep your Wikipedia, Crunchbase, and G2 profiles up to date.");
    recs.push("Monitor for brand drift: audit monthly to catch any drops in visibility as LLM training data evolves.");
  }

  recs.push("Build backlinks from .edu and .gov domains where possible — these carry high LLM citation weight.");
  recs.push("Publish original research or data reports that journalists and bloggers will cite, creating secondary LLM-indexed mentions.");

  return recs.slice(0, 6);
}
