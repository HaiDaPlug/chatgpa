// Purpose: Dynamic AI model router with fallback logic for generation + grading
// Connects to: OpenAI API, analytics tracking, generate-quiz.ts, grade.ts

import OpenAI from "openai";
import { randomUUID } from "crypto";
import { getOpenAIClient } from "./ai.js";

// ============================================================================
// Types & Interfaces
// ============================================================================

export type ModelFamily = "reasoning" | "standard";

export type RouterTask = "quiz_generation" | "grade_mcq" | "grade_short" | "grade_long";

export interface RouterRequest {
  task: RouterTask;
  prompt: string;
  context: {
    // Generation context (quiz_generation)
    notes_length?: number;
    question_count?: number;
    config?: any; // Section 4: QuizConfig for model selection

    // Grading context (grade_*)
    question_type?: "mcq" | "short" | "long";
    has_reference?: boolean;

    // Common
    request_id?: string; // Optional: pass existing request_id for log correlation
  };
}

export interface RouterMetrics {
  request_id: string;
  model_used: string;
  model_family: ModelFamily;
  fallback_triggered: boolean;
  model_decision_reason: string; // Why this model was chosen (e.g., "mcq_default", "typing_fallback_rate_limit")
  attempt_count: number;
  latency_ms: number;
  tokens_prompt?: number;
  tokens_completion?: number;
  tokens_total?: number;
}

export interface RouterError {
  code: string;
  message: string;
  recoverable: boolean;
  provider_status?: number;
  provider_message?: string;
}

export interface RouterResult {
  success: boolean;
  content?: string;
  metrics: RouterMetrics;
  error?: RouterError;
}

// ============================================================================
// Configuration
// ============================================================================

function getGenerationConfig(config?: any) {
  // Section 4: Dynamic model selection based on question type
  let defaultModel = process.env.OPENAI_MODEL_GENERATE_DEFAULT || "gpt-4o-mini";
  let fallbackModel = process.env.OPENAI_MODEL_GENERATE_FALLBACK || "gpt-5-mini";

  // If config provided, adjust model selection based on question type
  if (config) {
    const isTypingHeavy =
      config.question_type === "typing" ||
      (config.question_type === "hybrid" &&
       config.question_counts &&
       config.question_counts.typing >= config.question_counts.mcq);

    if (isTypingHeavy) {
      // Typing-heavy: prefer reasoning model for better rubric-aligned answers
      defaultModel = process.env.OPENAI_MODEL_GENERATE_TYPING_DEFAULT || "gpt-5-mini";
      fallbackModel = process.env.OPENAI_MODEL_GENERATE_TYPING_FALLBACK || "gpt-4o-mini";
    }
    // MCQ-heavy uses default models (already set above)
  }

  const fallbackEnabled = (process.env.ROUTER_ENABLE_FALLBACK || "true") === "true";
  const jsonStrict = (process.env.ROUTER_JSON_STRICT || "true") === "true";
  const timeoutMs = parseInt(process.env.ROUTER_TIMEOUT_MS || "60000", 10);
  const maxRetries = parseInt(process.env.ROUTER_MAX_RETRIES || "1", 10);

  return {
    defaultModel,
    fallbackModel,
    fallbackEnabled,
    jsonStrict,
    timeoutMs,
    maxRetries,
  };
}

function getGradingConfig(task: RouterTask) {
  const fallbackEnabled = (process.env.ROUTER_ENABLE_FALLBACK || "true") === "true";
  const jsonStrict = (process.env.ROUTER_JSON_STRICT || "true") === "true";
  const timeoutMs = parseInt(process.env.ROUTER_TIMEOUT_MS || "60000", 10);
  const maxRetries = parseInt(process.env.ROUTER_MAX_RETRIES || "1", 10);

  let defaultModel: string;
  let fallbackModel: string;

  switch (task) {
    case "grade_mcq":
      defaultModel = process.env.OPENAI_MODEL_GRADE_DEFAULT_MCQ || "gpt-4o-mini";
      fallbackModel = process.env.OPENAI_MODEL_GRADE_FALLBACK_MCQ || "gpt-5-mini";
      break;
    case "grade_short":
      defaultModel = process.env.OPENAI_MODEL_GRADE_DEFAULT_SHORT || "gpt-4o-mini";
      fallbackModel = process.env.OPENAI_MODEL_GRADE_FALLBACK_SHORT || "gpt-5-mini";
      break;
    case "grade_long":
      defaultModel = process.env.OPENAI_MODEL_GRADE_DEFAULT_LONG || "gpt-5-mini";
      fallbackModel = process.env.OPENAI_MODEL_GRADE_FALLBACK_LONG || "gpt-4o-mini";
      break;
    default:
      throw new Error(`Invalid grading task: ${task}`);
  }

  return {
    defaultModel,
    fallbackModel,
    fallbackEnabled,
    jsonStrict,
    timeoutMs,
    maxRetries,
  };
}

// ============================================================================
// Model Family Detection
// ============================================================================

/**
 * Detect model family based on model name patterns.
 *
 * Reasoning models (gpt-5*, o-series):
 * - Do NOT support custom temperature (only 1.0)
 * - Require strict JSON schema
 * - Support reasoning_effort parameter
 *
 * Standard models (gpt-4o*, gpt-4o-mini*):
 * - Support temperature range 0-2
 * - Support JSON object mode
 * - No reasoning parameters
 */
export function detectModelFamily(model: string): ModelFamily {
  const modelLower = model.toLowerCase();

  // Reasoning family: gpt-5, gpt-5-mini, gpt-5-nano, o1, o3, etc.
  if (
    modelLower.startsWith("gpt-5") ||
    modelLower.startsWith("o1") ||
    modelLower.startsWith("o3") ||
    modelLower.includes("reasoning")
  ) {
    return "reasoning";
  }

  // Standard family: everything else (gpt-4o, gpt-4o-mini, gpt-4, etc.)
  return "standard";
}

/**
 * Build model-family-aware OpenAI parameters.
 * Handles max_tokens vs max_completion_tokens and temperature constraints.
 *
 * @param family - Model family (reasoning or standard)
 * @param tokenLimit - Maximum tokens to generate
 * @param temperature - Temperature setting (optional, ignored for reasoning models)
 * @returns Parameter object ready to spread into chat.completions.create()
 */
export function buildOpenAIParams(
  family: ModelFamily,
  tokenLimit: number,
  temperature?: number
): Partial<{ max_tokens: number; max_completion_tokens: number; temperature: number }> {
  const params: Partial<{ max_tokens: number; max_completion_tokens: number; temperature: number }> = {};

  // Token limit parameter (reasoning vs standard)
  if (family === "reasoning") {
    params.max_completion_tokens = tokenLimit;
    // Reasoning models only support temperature=1.0 (default), omit parameter
  } else {
    params.max_tokens = tokenLimit;
    // Include temperature for standard models if provided
    if (temperature !== undefined) {
      params.temperature = temperature;
    }
  }

  return params;
}

// ============================================================================
// Parameter Building
// ============================================================================

interface OpenAICallParams {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  response_format?: { type: string };
  max_tokens?: number;
  max_completion_tokens?: number;
  // Future: reasoning_effort, top_p, etc.
}

/**
 * Build OpenAI API parameters based on model family and task.
 */
function buildParameters(
  model: string,
  family: ModelFamily,
  request: RouterRequest
): OpenAICallParams {
  const params: OpenAICallParams = {
    model,
    messages: [{ role: "user", content: request.prompt }],
  };

  // Calculate token limit based on task
  let tokenLimit: number;
  if (request.task === "quiz_generation") {
    const estimatedTokensPerQuestion = 150;
    tokenLimit = (request.context.question_count || 8) * estimatedTokensPerQuestion + 500;
    tokenLimit = Math.min(tokenLimit, 4000); // Cap at 4k tokens
  } else {
    // Grading tasks: more generous for detailed feedback
    tokenLimit = 2000;
  }

  // Calculate temperature (only used for standard models)
  const temperature = request.task === "quiz_generation" ? 0.7 : 0.1;

  // Apply model-family-aware parameters (max_tokens vs max_completion_tokens, temperature)
  Object.assign(params, buildOpenAIParams(family, tokenLimit, temperature));

  // All models use JSON object mode
  params.response_format = { type: "json_object" };

  // Note: response_format is correct for chat.completions API
  // All our code paths use client.chat.completions.create(), not other endpoints

  // Future: Add reasoning_effort if available for reasoning models
  // if (family === "reasoning") {
  //   params.reasoning_effort = "medium";
  // }

  return params;
}

// ============================================================================
// Error Classification
// ============================================================================

interface ErrorClassification {
  retryable: boolean;
  reason: string;
  code: string;
}

/**
 * Classify OpenAI errors to determine if fallback should be attempted.
 */
function classifyError(error: any): ErrorClassification {
  // Network/timeout errors - retryable
  if (error.code === "ENOTFOUND" || error.code === "ETIMEDOUT" || error.code === "ECONNREFUSED") {
    return { retryable: true, reason: "network_error", code: "NETWORK_ERROR" };
  }

  // OpenAI API errors
  if (error.status) {
    switch (error.status) {
      case 400:
        // Check if model-related
        const errorDetails = error.error || error;
        const isModelError =
          error.message?.toLowerCase().includes("model") ||
          errorDetails?.code === "model_not_found" ||
          errorDetails?.type === "invalid_request_error";

        if (isModelError) {
          return { retryable: true, reason: "model_not_found", code: "MODEL_ERROR" };
        }

        // Other 400 errors (bad prompt, etc.) - not retryable
        return { retryable: false, reason: "bad_request", code: "BAD_REQUEST" };

      case 401:
      case 403:
        // Auth errors - not retryable (config issue)
        return { retryable: false, reason: "auth_error", code: "AUTH_ERROR" };

      case 429:
        // Rate limit - could retry, but fallback model might have different limits
        return { retryable: true, reason: "rate_limit", code: "RATE_LIMIT" };

      case 500:
      case 502:
      case 503:
        // Server errors - retryable
        return { retryable: true, reason: "server_error", code: "SERVER_ERROR" };

      default:
        return { retryable: false, reason: "unknown_error", code: "UNKNOWN_ERROR" };
    }
  }

  // Unknown errors - don't retry
  return { retryable: false, reason: "unknown_error", code: "UNKNOWN_ERROR" };
}

/**
 * Classify fallback reason for model_decision_reason field.
 * Converts error classification into user-friendly reason strings.
 */
function classifyFallbackReason(error: any): string {
  if (error.status === 429) return "rate_limit";
  if ([500, 502, 503].includes(error.status)) return "timeout";
  if (error.code === "MODEL_NON_JSON" || error.code === "MODEL_EMPTY_RESPONSE") return "parse_error";
  if (error.code === "NETWORK_ERROR" || error.code === "SERVER_ERROR") return "timeout";
  if (error.code === "MODEL_ERROR" || error.code === "RATE_LIMIT") return error.code.toLowerCase().replace("_", "_");
  return "unknown";
}

// ============================================================================
// Core Router Logic
// ============================================================================

/**
 * Classify content pattern for diagnostics
 */
function classifyContent(raw: string): string {
  if (!raw || raw.trim() === "") return "empty";
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return "json_like";
  if (trimmed.startsWith("```")) return "markdown_fence";
  if (trimmed.match(/^(I can't|I cannot|Sorry|As an AI)/i)) return "refusal";
  return "prose";
}

/**
 * Extract JSON from common wrapper patterns
 * Handles both objects {...} and arrays [...]
 * Handles leading prose like "Sure! Here's the JSON: {...}"
 * Returns null if no valid JSON found
 */
function extractJSON(raw: string): string | null {
  // Pattern 1: Markdown fences (```json\n{...}\n``` or ```\n{...}\n```)
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    const candidate = fenceMatch[1].trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {}
  }

  // Pattern 2: First {...} or [...] block (handles leading prose)
  // Scan original raw string to preserve exact characters
  const openBraceIdx = raw.indexOf('{');
  const openBracketIdx = raw.indexOf('[');

  // Pick whichever comes first (or only one if other is -1)
  let startIdx = -1;
  let openChar = '';
  let closeChar = '';

  if (openBraceIdx !== -1 && (openBracketIdx === -1 || openBraceIdx < openBracketIdx)) {
    startIdx = openBraceIdx;
    openChar = '{';
    closeChar = '}';
  } else if (openBracketIdx !== -1) {
    startIdx = openBracketIdx;
    openChar = '[';
    closeChar = ']';
  }

  if (startIdx === -1) return null;

  // Extract from first open to matching close
  let depth = 0;
  for (let i = startIdx; i < raw.length; i++) {
    if (raw[i] === openChar) depth++;
    if (raw[i] === closeChar) depth--;
    if (depth === 0) {
      const candidate = raw.slice(startIdx, i + 1);
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {}
      return null;
    }
  }

  return null;
}

/**
 * Execute OpenAI call with the specified model and parameters.
 */
async function executeCall(
  client: OpenAI,
  params: OpenAICallParams,
  requestId: string
): Promise<{ content: string; tokens: any; latency: number }> {
  const startTime = Date.now();

  try {
    const completion = await client.chat.completions.create(params as any);
    const latency = Date.now() - startTime;

    const rawContent = completion.choices?.[0]?.message?.content;
    const finishReason = completion.choices?.[0]?.finish_reason;
    const choice = completion.choices?.[0];
    const usage = completion.usage;
    const tokens = {
      prompt: completion.usage?.prompt_tokens,
      completion: completion.usage?.completion_tokens,
      total: completion.usage?.total_tokens,
    };

    // Extract token limit params (different for reasoning vs standard models)
    const maxTokensParam = (params as any).max_completion_tokens || (params as any).max_tokens;

    // 1. Handle empty/missing response
    if (!rawContent || rawContent.trim() === "") {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id: requestId,
        error: 'MODEL_EMPTY_RESPONSE',
        model: params.model,
        finish_reason: finishReason,
        usage,
        max_tokens_param: maxTokensParam,
        choice_message_keys: choice ? Object.keys(choice.message || {}) : [],
        response_format: (params as any).response_format,
        message: 'OpenAI returned empty content'
      }));

      throw {
        code: 'MODEL_EMPTY_RESPONSE',
        message: 'AI returned empty response',
        status: 502,
        metadata: { request_id: requestId, model: params.model, finish_reason: finishReason }
      };
    }

    // 2. Try parsing as-is first (fast path)
    try {
      JSON.parse(rawContent);
      // Success - return as-is
      return { content: rawContent, tokens, latency };
    } catch (firstParseError) {
      // 3. Attempt repair: strip fences/extract JSON
      const extracted = extractJSON(rawContent);

      if (extracted) {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          request_id: requestId,
          event: 'JSON_REPAIR_SUCCEEDED',
          model: params.model,
          original_pattern: classifyContent(rawContent),
          original_length: rawContent.length,
          extracted_length: extracted.length,
          message: 'Extracted valid JSON from wrapped content'
        }));
        return { content: extracted, tokens, latency };
      }

      // 4. Repair failed - log and throw
      const pattern = classifyContent(rawContent);

      // Truncation detection (prioritize finish_reason as strongest signal)
      const truncationLikely =
        finishReason === 'length' ||
        (pattern === 'json_like' && !rawContent.trim().match(/[}\]]$/));

      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id: requestId,
        error: 'MODEL_NON_JSON',
        model: params.model,
        finish_reason: finishReason,
        usage,
        max_tokens_param: maxTokensParam,
        raw_length: rawContent.length,
        raw_preview: rawContent.slice(0, 300),
        content_pattern: pattern,
        truncation_likely: truncationLikely,
        response_format: (params as any).response_format,
        message: 'OpenAI returned non-JSON content after repair attempt'
      }));

      throw {
        code: 'MODEL_NON_JSON',
        message: 'AI returned invalid response format',
        status: 502,
        metadata: {
          request_id: requestId,
          model: params.model,
          pattern,
          truncation_likely: truncationLikely,
          finish_reason: finishReason
        }
      };
    }
  } catch (error: any) {
    const latency = Date.now() - startTime;

    // Attach latency to error for metrics
    error.latency_ms = latency;
    throw error;
  }
}

/**
 * Main router function: route AI requests (generation + grading) with fallback logic.
 */
export async function generateWithRouter(request: RouterRequest): Promise<RouterResult> {
  // Get appropriate config based on task
  // Section 4: Pass quiz config to generation config for dynamic model selection
  const config =
    request.task === "quiz_generation"
      ? getGenerationConfig(request.context.config)
      : getGradingConfig(request.task);
  // Use provided request_id or generate new one (single source of truth)
  const requestId = request.context.request_id || randomUUID();
  const client = getOpenAIClient();

  let attemptCount = 0;
  let fallbackTriggered = false;
  let lastError: any = null;

  // Determine quiz type and initial model decision reason
  let modelDecisionReason: string;
  if (request.task === "quiz_generation") {
    const quizConfig = request.context.config;
    const isTypingHeavy =
      quizConfig?.question_type === "typing" ||
      (quizConfig?.question_type === "hybrid" &&
       quizConfig?.question_counts &&
       quizConfig.question_counts.typing >= quizConfig.question_counts.mcq);
    const quizType = isTypingHeavy ? "typing" : "mcq";
    modelDecisionReason = `${quizType}_default`;
  } else {
    // Grading tasks
    modelDecisionReason = "grading_default";
  }

  // Attempt 1: Default model
  const defaultModel = config.defaultModel;
  const defaultFamily = detectModelFamily(defaultModel);

  attemptCount++;
  try {
    const params = buildParameters(defaultModel, defaultFamily, request);
    const result = await executeCall(client, params, requestId);

    // Success on first attempt
    return {
      success: true,
      content: result.content,
      metrics: {
        request_id: requestId,
        model_used: defaultModel,
        model_family: defaultFamily,
        fallback_triggered: false,
        model_decision_reason: modelDecisionReason,
        attempt_count: attemptCount,
        latency_ms: result.latency,
        tokens_prompt: result.tokens.prompt,
        tokens_completion: result.tokens.completion,
        tokens_total: result.tokens.total,
      },
    };
  } catch (error: any) {
    lastError = error;
    const classification = classifyError(error);

    // Log the error with full context
    console.error("ROUTER_PRIMARY_ATTEMPT_FAILED", {
      request_id: requestId,
      model: defaultModel,
      family: defaultFamily,
      error_code: classification.code,
      error_reason: classification.reason,
      retryable: classification.retryable,
      provider_status: error.status,
      provider_message: error.message,
      latency_ms: error.latency_ms,
    });

    // Check if we should attempt fallback (Reliability Fix)
    // Use fallbackTriggered instead of attemptCount to allow exactly one fallback per request
    if (!config.fallbackEnabled || !classification.retryable || fallbackTriggered) {
      return {
        success: false,
        metrics: {
          request_id: requestId,
          model_used: defaultModel,
          model_family: defaultFamily,
          fallback_triggered: false,
          model_decision_reason: modelDecisionReason,
          attempt_count: attemptCount,
          latency_ms: error.latency_ms || 0,
        },
        error: {
          code: classification.code,
          message: error.message || "Request failed",
          recoverable: classification.retryable,
          provider_status: error.status,
          provider_message: error.message,
        },
      };
    }

    // Proceed to fallback attempt
    fallbackTriggered = true;

    // Update model decision reason for fallback
    const fallbackReasonType = classifyFallbackReason(error);
    if (request.task === "quiz_generation") {
      const quizConfig = request.context.config;
      const isTypingHeavy =
        quizConfig?.question_type === "typing" ||
        (quizConfig?.question_type === "hybrid" &&
         quizConfig?.question_counts &&
         quizConfig.question_counts.typing >= quizConfig.question_counts.mcq);
      const quizType = isTypingHeavy ? "typing" : "mcq";
      modelDecisionReason = `${quizType}_fallback_${fallbackReasonType}`;
    } else {
      modelDecisionReason = `grading_fallback_${fallbackReasonType}`;
    }
  }

  // Attempt 2: Fallback model (if enabled and error was retryable)
  if (fallbackTriggered) {
    const fallbackModel = config.fallbackModel;
    const fallbackFamily = detectModelFamily(fallbackModel);

    attemptCount++;

    // Log LOUD fallback event
    console.warn("MODEL_FALLBACK", {
      request_id: requestId,
      task: request.task,
      from_model: defaultModel,
      to_model: fallbackModel,
      reason: classifyError(lastError).reason,
      attempt_count: attemptCount,
    });

    try {
      const params = buildParameters(fallbackModel, fallbackFamily, request);
      const result = await executeCall(client, params, requestId);

      // Success on fallback
      return {
        success: true,
        content: result.content,
        metrics: {
          request_id: requestId,
          model_used: fallbackModel,
          model_family: fallbackFamily,
          fallback_triggered: true,
          model_decision_reason: modelDecisionReason,
          attempt_count: attemptCount,
          latency_ms: result.latency,
          tokens_prompt: result.tokens.prompt,
          tokens_completion: result.tokens.completion,
          tokens_total: result.tokens.total,
        },
      };
    } catch (error: any) {
      const classification = classifyError(error);

      // Log fallback failure
      console.error("ROUTER_FALLBACK_ATTEMPT_FAILED", {
        request_id: requestId,
        model: fallbackModel,
        family: fallbackFamily,
        error_code: classification.code,
        error_reason: classification.reason,
        provider_status: error.status,
        provider_message: error.message,
        latency_ms: error.latency_ms,
      });

      // Both attempts failed
      return {
        success: false,
        metrics: {
          request_id: requestId,
          model_used: fallbackModel,
          model_family: fallbackFamily,
          fallback_triggered: true,
          model_decision_reason: modelDecisionReason,
          attempt_count: attemptCount,
          latency_ms: error.latency_ms || 0,
        },
        error: {
          code: classification.code,
          message: error.message || "Fallback request failed",
          recoverable: false, // No more retries
          provider_status: error.status,
          provider_message: error.message,
        },
      };
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error("Router logic error: unexpected code path");
}
