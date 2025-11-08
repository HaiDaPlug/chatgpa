// Purpose: Client telemetry - non-blocking, durable-ready
// Sends events to /api/track via sendBeacon (or fetch keepalive fallback)
// All errors are swallowed to prevent breaking UX

type TelemetryEvent =
  | "dashboard_loaded"
  | "attempts_loaded"
  | "quiz_generated_start"
  | "quiz_generated_success"
  | "quiz_generated_failure"
  | "quiz_graded_start"
  | "quiz_graded_success"
  | "quiz_graded_failure";

/**
 * Track telemetry event - sends to server endpoint
 * Uses navigator.sendBeacon when available for non-blocking behavior
 * Falls back to fetch with keepalive flag
 * All errors are swallowed - telemetry must never crash the app
 */
export function track(event: TelemetryEvent, data?: Record<string, any>) {
  try {
    // Local dev console visibility
    // eslint-disable-next-line no-console
    console.log(`[telemetry] ${event}`, { ...data, ts: new Date().toISOString() });

    const payload = JSON.stringify({ event, data });
    const url = "/api/track";

    // Prefer sendBeacon for non-blocking behavior
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }

    // Fallback: fetch with keepalive (do not await)
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Swallow errors - telemetry must not break UX
    });
  } catch {
    // Swallow all errors - telemetry must never crash the app
  }
}
