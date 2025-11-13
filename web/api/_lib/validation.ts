// Purpose: Shared validation helpers (simple)
// Connects to: /api/generate-quiz, /api/grade

import { randomUUID } from "crypto";

// Error codes enum
export const ErrorCode = {
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  SCHEMA_INVALID: 'SCHEMA_INVALID',
  OPENAI_ERROR: 'OPENAI_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',

  // Section 6: Gateway-specific error codes
  ACTION_UNKNOWN: 'ACTION_UNKNOWN',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

// Simple result helpers
export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; code: ErrorCodeType; message: string };
export type Result<T> = Ok<T> | Err;

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}

export function err(code: ErrorCodeType, message: string): Err {
  return { ok: false, code, message };
}

// Request ID generator
export function generateRequestId(): string {
  return randomUUID();
}

// Structured logging helper
export function log(level: 'info' | 'error' | 'warn', context: Record<string, any>, message: string) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, ...context, message }));
}
