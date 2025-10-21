import type { ChatMessage } from '@/components/MessageList';

export type SendResult = {
  ok: boolean;
  reply?: string;
  usage?: {
    total_tokens: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  request_id?: string;
  warnings?: string[];
  error?: string;
  detail?: string;
};

/**
 * Send a chat request to /api/chat (non-streaming)
 *
 * Supports mock mode via VITE_CHAT_MOCK=1 for local development
 * without running the actual API.
 */
export async function sendChat(
  messages: ChatMessage[],
  userId: string
): Promise<SendResult> {
  // Mock mode - return canned response
  if (import.meta.env.VITE_CHAT_MOCK === '1') {
    console.log('[MOCK MODE] sendChat called with:', {
      messageCount: messages.length,
      userId,
      lastMessage: messages[messages.length - 1]?.content,
    });

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    return {
      ok: true,
      reply: `This is a mock response. Your message was: "${messages[messages.length - 1]?.content}"\n\nMock mode is enabled (VITE_CHAT_MOCK=1). Set it to 0 to use the real API.`,
      usage: {
        total_tokens: 1200,
        prompt_tokens: 800,
        completion_tokens: 400,
      },
      request_id: `mock-${crypto.randomUUID()}`,
    };
  }

  // Real API call
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        user_id: userId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    let json: any;
    try {
      json = await response.json();
    } catch (parseErr) {
      console.error('[sendChat] Failed to parse JSON:', parseErr);
      return {
        ok: false,
        error: 'invalid_response',
        detail: 'Server returned invalid JSON',
      };
    }

    // Handle non-OK HTTP status
    if (!response.ok) {
      return {
        ok: false,
        error: json?.error || `http_${response.status}`,
        detail: json?.detail || response.statusText,
        warnings: json?.warnings,
      };
    }

    // Handle API-level errors (ok: false in JSON)
    if (json.ok === false) {
      return {
        ok: false,
        error: json.error || 'chat_failed',
        detail: json.detail,
        warnings: json.warnings,
      };
    }

    // Success
    return {
      ok: true,
      reply: json.reply || '',
      usage: json.usage,
      request_id: json.request_id,
      warnings: json.warnings,
    };
  } catch (err: any) {
    console.error('[sendChat] Network or timeout error:', err);

    // Normalize fetch/abort errors
    if (err.name === 'AbortError') {
      return {
        ok: false,
        error: 'timeout',
        detail: 'Request took longer than 60 seconds',
      };
    }

    return {
      ok: false,
      error: 'openai_call_error',
      detail: err.message || 'Network error occurred',
    };
  }
}
