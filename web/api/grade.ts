/**
 * DO NOT CHANGE CONTRACTS OR SCHEMA.
 * - Auth: Bearer <supabase access token> (anon client w/ RLS)
 * - Errors: { code, message } only. Codes: LIMIT_EXCEEDED | SCHEMA_INVALID | NOT_FOUND | OPENAI_ERROR | UNAUTHORIZED | SERVER_ERROR
 * - No service role keys, no schema edits, no new deps.
 * - Limits: Free = max 1 class, 5 quizzes (created).
 */

// Purpose: Grade quiz answers using OpenAI (RLS-enabled)
// Connects to: /quiz/:id page, quiz_attempts table

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { randomUUID } from "crypto";
import { MODEL } from "./_lib/ai";

// Input schema
const Body = z.object({
  quiz_id: z.string().uuid(),
  answers: z.array(z.object({ questionId: z.string(), answer: z.string() })).min(1),
});

// Grading response schema (matches GRADER.md output)
const PerQuestionFeedback = z.object({
  questionId: z.string(),
  correct: z.boolean(),
  explanation: z.string(),
  feedback: z.string(),
});

const GradeResult = z.object({
  score: z.number().min(0).max(100),
  perQuestion: z.array(PerQuestionFeedback),
  summary: z.string(),
});

// Letter grade helper
function getLetterGrade(score: number): "F" | "D" | "C" | "B" | "A" | "A+" {
  if (score >= 97) return "A+";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

// Structured logging
function log(level: 'info' | 'error' | 'warn', context: any, message: string) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, ...context, message }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const request_id = randomUUID();

  res.setHeader('Content-Type', 'application/json');

  if (req.method !== "POST") {
    return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Only POST allowed" });
  }

  try {
    // Auth passthrough (RLS relies on this token)
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      log('error', { request_id, route: '/api/grade' }, 'Missing auth header');
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Missing or invalid authorization header" });
    }

    const access_token = auth.split(" ")[1];

    // Supabase client bound to user token (enables RLS)
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${access_token}` } },
        auth: { persistSession: false }
      }
    );

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      log('error', { request_id, route: '/api/grade' }, 'Invalid token');
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
    }

    const user_id = user.id;

    // Validate body
    const parse = Body.safeParse(req.body ?? {});
    if (!parse.success) {
      log('error', { request_id, route: '/api/grade', user_id }, 'Schema validation failed');
      return res.status(400).json({
        code: "SCHEMA_INVALID",
        message: parse.error.issues.map(i => i.message).join(', ')
      });
    }

    const { quiz_id, answers } = parse.data;

    // Load quiz and verify ownership (join through classes or check user_id)
    const { data: quizData, error: quizError } = await supabase
      .from('quizzes')
      .select('id, questions, user_id')
      .eq('id', quiz_id)
      .single();

    if (quizError || !quizData) {
      log('error', { request_id, route: '/api/grade', user_id, quiz_id }, 'Quiz not found');
      return res.status(404).json({ code: "NOT_FOUND", message: "Quiz not found" });
    }

    if (quizData.user_id !== user_id) {
      log('error', { request_id, route: '/api/grade', user_id, quiz_id }, 'Access denied');
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Access denied" });
    }

    // Convert answers array to object for OpenAI
    const studentAnswers: Record<string, string> = {};
    answers.forEach(a => {
      studentAnswers[a.questionId] = a.answer;
    });

    // Call OpenAI to grade
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      log('error', { request_id, route: '/api/grade' }, 'Missing OpenAI key');
      return res.status(500).json({ code: "SERVER_ERROR", message: "Server configuration error" });
    }

    const prompt = `You are ChatGPA's strict grader.

Goal
- Grade a student's answers against the provided quiz.
- Return EXACTLY the JSON structure below. No prose, no markdown.

Constraints
- temperature: 0
- Be deterministic and concise.
- For "mcq": correct if the student's answer string EXACTLY matches the correct option.
- For "short": use semantic matching from the gold "answer". Allow synonyms; penalize missing core concepts.
- Scoring: score = round( (correct_count / total_questions) * 100 )
- "explanation": one short sentence on why.
- "feedback": one short, study-oriented suggestion (what to recall or contrast).

Input:
Quiz: ${JSON.stringify({ questions: quizData.questions })}
Student Answers: ${JSON.stringify(studentAnswers)}

Output (strict):
{
  "score": 0-100,
  "perQuestion": [
    {
      "questionId": "q1",
      "correct": true | false,
      "explanation": "string",
      "feedback": "string"
    },
    ...
  ],
  "summary": "string"   // one-sentence, actionable study tip
}`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiResponse.ok) {
      await openaiResponse.text();
      log('error', { request_id, route: '/api/grade', user_id, quiz_id, status: openaiResponse.status }, 'OpenAI API error');
      return res.status(500).json({ code: "OPENAI_ERROR", message: "Grading failed" });
    }

    const openaiData: any = await openaiResponse.json();
    const raw = openaiData?.choices?.[0]?.message?.content ?? "{}";

    let gradeJson;
    try {
      gradeJson = JSON.parse(raw);
    } catch {
      log('error', { request_id, route: '/api/grade', user_id, quiz_id }, 'Non-JSON response from model');
      return res.status(400).json({ code: "SCHEMA_INVALID", message: "Non-JSON response from model" });
    }

    // Validate grading result with Zod
    const gradeValidation = GradeResult.safeParse(gradeJson);
    if (!gradeValidation.success) {
      log('error', { request_id, route: '/api/grade', user_id, quiz_id }, 'Grade validation failed');
      return res.status(500).json({
        code: "SCHEMA_INVALID",
        message: "Grading response failed validation"
      });
    }

    const graded = gradeValidation.data;
    const letter = getLetterGrade(graded.score);

    // Insert quiz_attempt into database (RLS ensures user_id is set correctly)
    const { data: attemptData, error: insertError } = await supabase
      .from('quiz_attempts')
      .insert({
        quiz_id,
        responses: studentAnswers,
        grading: graded.perQuestion,
        score: graded.score / 100, // Store as 0..1 per schema
      })
      .select('id')
      .single();

    if (insertError || !attemptData) {
      log('error', { request_id, route: '/api/grade', user_id, quiz_id, error: insertError?.message }, 'Failed to insert attempt');
      return res.status(500).json({ code: "SERVER_ERROR", message: "Failed to save attempt" });
    }

    log('info', { request_id, route: '/api/grade', user_id, quiz_id, attempt_id: attemptData.id }, 'Grading completed successfully');

    return res.status(200).json({
      score: graded.score,
      letter,
      feedback: graded.perQuestion,
      summary: graded.summary,
      attempt_id: attemptData.id,
    });

  } catch (error: any) {
    log('error', { request_id, route: '/api/grade', error: error.message }, 'Unhandled error');
    return res.status(500).json({ code: "SERVER_ERROR", message: "Internal server error" });
  }
}
