import { searchBrave } from "./brave.js";
import { searchExa } from "./exa.js";
import { quickScoreResults, scoreResults } from "./scorer.js";
import type { AuditResult, QuickCheckResult, SearchResult } from "./types.js";

export interface AuditConfig {
  braveApiKey?: string;
  exaApiKey?: string;
}

export async function runAudit(
  query: string,
  config: AuditConfig
): Promise<AuditResult> {
  if (!config.braveApiKey && !config.exaApiKey) {
    throw new Error(
      "At least one search API key is required: BRAVE_SEARCH_API_KEY or EXA_API_KEY"
    );
  }

  const searchJobs: Promise<SearchResult[]>[] = [];

  if (config.braveApiKey) {
    searchJobs.push(
      searchBrave(query, config.braveApiKey).catch((err) => {
        console.error("[brave] search failed:", err.message);
        return [];
      })
    );
  }

  if (config.exaApiKey) {
    searchJobs.push(
      searchExa(query, config.exaApiKey).catch((err) => {
        console.error("[exa] search failed:", err.message);
        return [];
      })
    );
  }

  const resultGroups = await Promise.all(searchJobs);
  const allResults = deduplicateByUrl(resultGroups.flat());

  return scoreResults(query, allResults);
}

// Quick check: single source, 5 results — used by the $0.05 geo_quick_check tool
export async function runQuickCheck(
  query: string,
  config: AuditConfig
): Promise<QuickCheckResult> {
  if (!config.braveApiKey && !config.exaApiKey) {
    throw new Error(
      "At least one search API key is required: BRAVE_SEARCH_API_KEY or EXA_API_KEY"
    );
  }

  let results: SearchResult[] = [];

  if (config.braveApiKey) {
    results = await searchBrave(query, config.braveApiKey, 5).catch((err) => {
      console.error("[brave] quick-check failed:", err.message);
      return [];
    });
  }

  // Fall back to Exa if Brave returned nothing — use "fast" type for quick-check latency
  if (results.length === 0 && config.exaApiKey) {
    results = await searchExa(query, config.exaApiKey, 5, "fast").catch((err) => {
      console.error("[exa] quick-check failed:", err.message);
      return [];
    });
  }

  return quickScoreResults(query, results);
}

function deduplicateByUrl(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}
