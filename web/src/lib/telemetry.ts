// Minimal breadcrumb logger — swap console for real analytics later
type TelemetryEvent =
  | "dashboard_loaded"
  | "classes_loaded"
  | "attempts_loaded"
  | "dashboard_error"
  | "retry_clicked"
  | "refresh_clicked"
  | "auth_missing"
  | "create_class_success"
  | "create_class_error"
  | "no_notes_found"
  | "quiz_generated";

export function log(event: TelemetryEvent, data?: Record<string, unknown>) {
  try {
    // Replace with your analytics sink later
    console.debug(`[telemetry] ${event}`, data ?? {});
  } catch {
    // no-op
  }
}
