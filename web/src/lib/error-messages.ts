// Central mapping: technical errors -> friendly copy (keeps tone consistent)
export type ErrorSource = "auth" | "classes" | "attempts" | "network" | "unknown";

export function friendlyError(err: unknown, source: ErrorSource): string {
  const raw = (err as any)?.message || String(err ?? "Unknown error");
  if (source === "auth") return "Please log in to continue.";
  if (/Failed to fetch|NetworkError|ERR_NETWORK/i.test(raw)) return "Network issue — check your connection and try again.";
  if (/429|RATE_LIMIT|too many/i.test(raw)) return "Too many requests — please slow down and try again.";
  if (/permission|rls|not authorized/i.test(raw)) return "You're not allowed to access that data.";
  if (/timeout|timed out/i.test(raw)) return "Request took too long. Please retry.";
  if (source === "classes") return "Couldn't load your classes right now. Please retry.";
  if (source === "attempts") return "Couldn't load recent results. Please retry.";
  return "Something went wrong. Please try again.";
}
