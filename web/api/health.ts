// Health check endpoint for verifying environment configuration
// GET /api/health
// Returns 200 if all systems are healthy, 503 if any checks fail

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateAIConfig } from "./_lib/ai.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Run health checks
  const checks = {
    supabase_url: !!process.env.SUPABASE_URL?.trim(),
    supabase_anon_key: !!process.env.SUPABASE_ANON_KEY?.trim(),
    openai_api_key: !!process.env.OPENAI_API_KEY?.trim(),
    ai_config_valid: validateAIConfig().valid,
  };

  // Determine overall health
  const allHealthy = Object.values(checks).every(v => v);
  const status = allHealthy ? 200 : 503;

  // Include error details only in non-production or if specifically requested
  const includeDetails = process.env.NODE_ENV !== 'production' || req.query.details === 'true';

  const response: any = {
    status: allHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
  };

  if (includeDetails) {
    response.checks = checks;

    // Add AI config error if validation failed
    const aiConfig = validateAIConfig();
    if (!aiConfig.valid) {
      response.ai_config_error = aiConfig.error;
    }
  }

  return res.status(status).json(response);
}
