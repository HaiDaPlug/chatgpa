/**
 * UUID validation utilities
 * Prevents invalid UUIDs from causing Supabase query errors
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if value is a valid UUID format
 * Validates generic UUID format (not specifically v4)
 */
export function isValidUuid(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return UUID_REGEX.test(value);
}

/**
 * Sanitize URL param that should be a UUID
 * Returns undefined if invalid
 *
 * Handles edge cases:
 * - Whitespace: " <uuid> " → trimmed and validated
 * - "undefined"/"null" strings (any case) → undefined
 * - Invalid format → undefined
 * - Valid UUID → passthrough
 */
export function sanitizeUuidParam(value: string | null): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();
  if (lower === 'undefined' || lower === 'null') return undefined;

  if (!isValidUuid(trimmed)) return undefined;
  return trimmed;
}
