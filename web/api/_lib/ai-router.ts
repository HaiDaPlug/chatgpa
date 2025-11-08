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

function getGenerationConfig() {
  const defaultModel = process.env.OPENAI_MODEL_GENERATE_DEFAULT || "gpt-4o-mini";
  const fallbackModel = process.env.OPENAI_MODEL_GENERATE_FALLBACK || "gpt-5-mini";
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

// ============================================================================
// Parameter Building
// ============================================================================

interface OpenAICallParams {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  response_format?: { type: string };
  max_tokens?: number;
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

  // Estimate max tokens based on context
  if (request.task === "quiz_generation") {
    const estimatedTokensPerQuestion = 150;
    const maxTokens = (request.context.question_count || 8) * estimatedTokensPerQuestion + 500;
    params.max_tokens = Math.min(maxTokens, 4000); // Cap at 4k tokens
  } else {
    // Grading tasks: more generous for detailed feedback
    params.max_tokens = 2000;
  }

  if (family === "reasoning") {
    // Reasoning models:
    // - Do NOT include temperature (only supports 1.0, which is default)
    // - Always use strict JSON
    params.response_format = { type: "json_object" };

    // Future: Add reasoning_effort if available
    // params.reasoning_effort = "medium";
  } else {
    // Standard models:
    // - Include temperature based on task
    // - Use JSON object mode
    if (request.task === "quiz_generation") {
      params.temperature = 0.7; // Balanced creativity for quiz generation
    } else {
      // Grading tasks: low variance for deterministic evaluation
      params.temperature = 0.1;
    }
    params.response_format = { type: "json_object" };
  }

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

// ============================================================================
// Core Router Logic
// ============================================================================

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

    const content = completion.choices?.[0]?.message?.content ?? "{}";
    const tokens = {
      prompt: completion.usage?.prompt_tokens,
      completion: completion.usage?.completion_tokens,
      total: completion.usage?.total_tokens,
    };

    return { content, tokens, latency };
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
  const config =
    request.task === "quiz_generation" ? getGenerationConfig() : getGradingConfig(request.task);
  // Use provided request_id or generate new one (single source of truth)
  const requestId = request.context.request_id || randomUUID();
  const client = getOpenAIClient();

  let attemptCount = 0;
  let fallbackTriggered = false;
  let lastError: any = null;

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

    // Check if we should attempt fallback
    if (!config.fallbackEnabled || !classification.retryable || attemptCount >= config.maxRetries) {
      return {
        success: false,
        metrics: {
          request_id: requestId,
          model_used: defaultModel,
          model_family: defaultFamily,
          fallback_triggered: false,
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
