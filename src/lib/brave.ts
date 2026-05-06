import type { SearchResult } from "./types.js";

const BRAVE_API_BASE = "https://api.search.brave.com/res/v1/web/search";

export async function searchBrave(
  query: string,
  apiKey: string,
  count = 10
): Promise<SearchResult[]> {
  const url = new URL(BRAVE_API_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(count));
  url.searchParams.set("result_filter", "web");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!res.ok) {
    throw new Error(`Brave Search error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as BraveResponse;
  const results: SearchResult[] = [];

  for (const item of data.web?.results ?? []) {
    results.push({
      url: item.url,
      title: item.title,
      description: item.description ?? "",
      source: "brave",
    });
  }

  return results;
}

interface BraveResponse {
  web?: {
    results: Array<{
      url: string;
      title: string;
      description?: string;
    }>;
  };
}
