import { z } from "zod";

// Waitlist validation with Turnstile CAPTCHA
export const waitlistSchema = z.object({
  email: z.string().email().max(120),
  ref: z.string().trim().toLowerCase().max(40).optional(),
  turnstileToken: z.string().min(10).max(10_000), // from Cloudflare Turnstile widget
});

// Chat API validation - strict limits to prevent abuse
export const chatSchema = z.object({
  message: z.string().min(1).max(8000), // 8k char max
  conversationId: z.string().uuid().optional(),
  messageId: z.string().uuid(), // for idempotency
});

// Sanitize input - remove control characters and dangerous patterns
export function sanitizeInput(input: string): string {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // remove control chars except \n, \r, \t
    .trim()
    .slice(0, 8000); // hard limit
}
