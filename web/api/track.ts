// web/api/track.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = { runtime: "nodejs" };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res
        .status(405)
        .json({ code: "METHOD_NOT_ALLOWED", message: "Only POST allowed" });
    }

    // Body is parsed by Vercel when Content-Type: application/json
    const event = req.body ?? {};
    // Optional: basic schema guard (non-blocking)
    if (!event?.event || typeof event.event !== "string") {
      // don't fail telemetry; swallow errors in alpha
      return res.status(204).end();
    }

    // Non-blocking telemetry: log or enqueue then end
    console.log("[telemetry]", {
      event: event.event,
      data: event.data ?? {},
      ip: req.headers["x-forwarded-for"],
      ts: new Date().toISOString(),
    });

    return res.status(204).end();
  } catch (err) {
    // Swallow in alpha to avoid breaking UX
    console.error("TRACK_ERROR", err);
    return res.status(204).end();
  }
}
