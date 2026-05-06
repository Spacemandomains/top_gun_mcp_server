import type { SearchResult } from "./types.js";

const EXA_API_BASE = "https://api.exa.ai/search";

export type ExaSearchType = "auto" | "fast" | "instant" | "deep-lite" | "deep";

export async function searchExa(
  query: string,
  apiKey: string,
  count = 10,
  type: ExaSearchType = "auto"
): Promise<SearchResult[]> {
  const res = await fetch(EXA_API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      numResults: count,
      type,
      contents: { highlights: true },
    }),
  });

  if (!res.ok) {
    throw new Error(`Exa Search error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as ExaResponse;
  const results: SearchResult[] = [];

  for (const item of data.results ?? []) {
    // highlights is an array of relevant excerpts; join top 2 as the description
    const description = item.highlights?.slice(0, 2).join(" ") ?? "";
    results.push({
      url: item.url,
      title: item.title ?? item.url,
      description,
      source: "exa",
    });
  }

  return results;
}

interface ExaResponse {
  results: Array<{
    url: string;
    title?: string;
    highlights?: string[];
  }>;
}
