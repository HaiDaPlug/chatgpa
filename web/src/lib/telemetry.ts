// Purpose: Client telemetry - non-blocking, durable-ready
// Sends events to /api/track via sendBeacon (or fetch keepalive fallback)
// All errors are swallowed to prevent breaking UX
// Section 3: Extended with Results page and attempt lifecycle events

type TelemetryEvent =
  | "dashboard_loaded"
  | "attempts_loaded"
  | "quiz_generated_start"
  | "quiz_generated_success"
  | "quiz_generated_failure"
  | "quiz_graded_start"
  | "quiz_graded_success"
  | "quiz_graded_failure"
  // Section 3: Results Page events
  | "results_page_viewed"
  | "attempt_card_viewed"
  | "attempt_resume_clicked"
  | "attempt_title_edited"
  | "attempt_subject_edited"
  | "attempt_autosave_success"
  | "attempt_autosave_fail"
  | "result_opened"
  | "grade_summary_viewed"
  | "attempt_submit_clicked"
  | "attempt_submit_success"
  | "attempt_submit_fail"
  // Section 4: Quiz Configuration events
  | "quiz_config_changed"
  | "quiz_config_reset"
  // Section 5: Workspace Folders events
  | "folder_created"
  | "folder_renamed"
  | "folder_moved"
  | "folder_deleted"
  | "note_moved_to_folder"
  | "note_removed_from_folder"
  | "class_breadcrumb_clicked"
  | "uncategorized_view_opened"
  | "folder_tree_expanded"
  | "folder_tree_collapsed"
  // Section 7: Visual System events
  | "quiz_visuals_enabled"
  | "quiz_visuals_disabled"
  | "asset_load_success"
  | "asset_load_error"
  | "text_only_mode_toggled";

/**
 * Track telemetry event - sends to server endpoint
 * Uses navigator.sendBeacon when available for non-blocking behavior
 * Falls back to fetch with keepalive flag
 * All errors are swallowed - telemetry must never crash the app
 *
 * Section 3 Enhancement: Automatically adds client_ts for clock drift analysis
 */
export function track(event: TelemetryEvent, data?: Record<string, any>) {
  try {
    // Section 3: Add client timestamp for clock drift analysis
    const enrichedData = {
      ...data,
      client_ts: new Date().toISOString(),
      route: window.location.pathname, // Auto-capture route for context
    };

    // Local dev console visibility
    // eslint-disable-next-line no-console
    console.log(`[telemetry] ${event}`, enrichedData);

    const payload = JSON.stringify({ event, data: enrichedData });
    const url = "/api/v1/util?action=track";

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
