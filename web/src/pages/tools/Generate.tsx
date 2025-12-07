// NOTE: ChatGPA v1.12 UX Pivot - Phase 1
// Purpose: World-class quiz generator with zero-friction UX
// Changes: Unified text input, auto class handling, auto question count, simplified layout
// Connects to: /api/v1/ai?action=generate_quiz, quiz results

import { useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { track } from "@/lib/telemetry";
import type { QuizConfig, QuestionType, CoverageStrategy, DifficultyLevel } from "../../../shared/types";

type ClassRow = { id: string; name: string };

// ✅ Safe - localStorage keys remain unchanged for backward compatibility
const LS_KEY_DIRECT = "generate.directText";
const LS_KEY_CONFIG_DEFAULT = "quiz_config_default";
const LS_KEY_CONFIG_STANDALONE = "quiz_config_standalone";
const LS_KEY_LAST_CLASS = "last_used_class_id"; // ChatGPA v1.12: Auto class handling

// Helper to get config localStorage key
function getConfigKey(classId: string | null): string {
  if (classId) {
    return `quiz_config_class_${classId}`;
  }
  return LS_KEY_CONFIG_STANDALONE;
}

// ChatGPA v1.12: Auto question count based on note length
// ✅ Safe - matches plan specification
function getAutoQuestionCount(textLength: number): number {
  if (textLength < 500) return 4;      // small notes
  if (textLength < 2000) return 7;     // normal notes
  return 10;                           // dense notes
}

// Default quiz config (matches backend)
const DEFAULT_CONFIG: QuizConfig = {
  question_type: "mcq",
  question_count: 8,
  coverage: "key_concepts",
  difficulty: "medium",
};

export default function Generate() {
  const { push } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ChatGPA v1.12: Unified input state (no more mode switcher)
  // ✅ Safe - directText is now the single source of truth
  const [directText, setDirectText] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // ChatGPA v1.12: Auto class handling
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string | null>(null);
  const [isCreatingDefaultClass, setIsCreatingDefaultClass] = useState(false);

  const [loading, setLoading] = useState(false);
  const saveTimer = useRef<number | null>(null);

  // Section 4: Quiz config state
  const [questionType, setQuestionType] = useState<QuestionType>(DEFAULT_CONFIG.question_type);
  const [questionCount, setQuestionCount] = useState<number>(DEFAULT_CONFIG.question_count);
  const [coverage, setCoverage] = useState<CoverageStrategy>(DEFAULT_CONFIG.coverage);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(DEFAULT_CONFIG.difficulty);
  const [mcqCount, setMcqCount] = useState<number>(5); // For hybrid mode
  const [typingCount, setTypingCount] = useState<number>(3); // For hybrid mode
  const [showAdvanced, setShowAdvanced] = useState(false);
  const configSaveTimer = useRef<number | null>(null);

  // ChatGPA v1.12: Auto question count state
  const [autoQuestionCount, setAutoQuestionCount] = useState(4);
  const [userOverrodeQuestionCount, setUserOverrodeQuestionCount] = useState(false);

  // Section 7: Text-only mode toggle (persisted to localStorage)
  const [textOnlyMode, setTextOnlyMode] = useState(() => {
    const saved = localStorage.getItem('text_only_mode');
    return saved === 'true';
  });

  // Cost estimation (simple heuristic: ~300 tokens per question * 1.2 buffer)
  const estimatedTokens = useMemo(() => {
    const baseTokensPerQuestion = 300;
    const buffer = 1.2;
    return Math.round(questionCount * baseTokensPerQuestion * buffer);
  }, [questionCount]);

  // ChatGPA v1.12: Auto class selection logic
  // ✅ Safe - follows plan specification for class handling
  useEffect(() => {
    let alive = true;

    (async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id,name")
        .order("created_at", { ascending: false });

      if (!alive) return;

      if (error) {
        console.error("GENERATE_LOAD_CLASSES_ERROR", error);
        setClasses([]);
        return;
      }

      const loadedClasses = data ?? [];
      setClasses(loadedClasses);

      // Auto-select class logic
      if (loadedClasses.length === 0) {
        // No classes exist - auto-create "General"
        await createDefaultClass();
      } else {
        // Try to use last used class from localStorage
        const lastUsedId = localStorage.getItem(LS_KEY_LAST_CLASS);
        const lastUsedStillExists = loadedClasses.find((c: ClassRow) => c.id === lastUsedId);

        if (lastUsedStillExists) {
          setClassId(lastUsedId);
        } else {
          // Use most recent class
          setClassId(loadedClasses[0].id);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // ChatGPA v1.12: Create default "General" class if none exist
  // ✅ Safe - follows plan specification
  async function createDefaultClass() {
    if (isCreatingDefaultClass) return; // Prevent duplicate creation

    setIsCreatingDefaultClass(true);

    try {
      const { data, error } = await supabase
        .from("classes")
        .insert({
          name: "General",
          description: "Default class for quick quizzes"
        })
        .select("id,name")
        .single();

      if (error) {
        console.error("AUTO_CREATE_CLASS_ERROR", error);
        // Don't show error to user - silent fallback
        return;
      }

      if (data) {
        setClasses([data]);
        setClassId(data.id);
        localStorage.setItem(LS_KEY_LAST_CLASS, data.id);

        // ⚠️ Verify - New telemetry event for auto class creation
        track("quiz_config_changed" as any, {
          context: "auto_class_created",
          class_id: data.id,
          class_name: data.name
        });
      }
    } catch (e) {
      console.error("AUTO_CREATE_CLASS_EXCEPTION", e);
    } finally {
      setIsCreatingDefaultClass(false);
    }
  }

  // ChatGPA v1.12: Retake flow - load quiz content from URL parameter
  // ✅ Safe - handles ?retake=quiz_id parameter for retaking quizzes
  useEffect(() => {
    const retakeQuizId = searchParams.get("retake");
    if (!retakeQuizId) return;

    let alive = true;

    (async () => {
      try {
        const { data: quiz, error } = await supabase
          .from("quizzes")
          .select("id, note_content, class_id, config")
          .eq("id", retakeQuizId)
          .single();

        if (!alive) return;

        if (error || !quiz) {
          push({ kind: "error", text: "Could not load quiz for retake" });
          return;
        }

        // Populate the form with quiz data
        if (quiz.note_content) {
          setDirectText(quiz.note_content);
        }

        if (quiz.class_id) {
          setClassId(quiz.class_id);
        }

        // Load quiz config if available
        if (quiz.config && typeof quiz.config === "object") {
          const cfg = quiz.config as any;
          if (cfg.question_type) setQuestionType(cfg.question_type);
          if (cfg.question_count) setQuestionCount(cfg.question_count);
          if (cfg.coverage) setCoverage(cfg.coverage);
          if (cfg.difficulty) setDifficulty(cfg.difficulty);
        }

        track("retake_quiz_loaded", { quiz_id: retakeQuizId });

        push({ kind: "success", text: "Quiz loaded for retake. Make any changes and generate!" });
      } catch (e) {
        console.error("RETAKE_LOAD_ERROR", e);
        if (alive) {
          push({ kind: "error", text: "Failed to load quiz for retake" });
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [searchParams]);

  // localStorage: load once on mount
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_KEY_DIRECT);
      if (v && typeof v === "string") setDirectText(v);
    } catch {
      // no-op
    }
  }, []);

  // localStorage: debounced save on change
  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY_DIRECT, directText);
      } catch {
        // no-op
      }
    }, 400);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [directText]);

  // ChatGPA v1.12: Auto question count calculation
  // ✅ Safe - updates question count based on text length unless user manually overrode
  useEffect(() => {
    const textLength = directText.trim().length;
    const suggested = getAutoQuestionCount(textLength);
    setAutoQuestionCount(suggested);

    // Only auto-update if user hasn't manually changed it
    if (!userOverrodeQuestionCount && textLength > 0) {
      setQuestionCount(suggested);
    }
  }, [directText, userOverrodeQuestionCount]);

  // Section 4: Load config on mount and when classId changes
  useEffect(() => {
    const config = loadConfig(classId);
    applyConfig(config);
  }, [classId]);

  // Section 4: Debounced save config on change
  useEffect(() => {
    if (configSaveTimer.current) window.clearTimeout(configSaveTimer.current);

    configSaveTimer.current = window.setTimeout(() => {
      const config = getCurrentConfig();
      saveConfig(config, classId);

      // Track config change (debounced)
      track("quiz_config_changed", {
        question_type: questionType,
        question_count: questionCount,
        coverage,
        difficulty,
        ...(questionType === "hybrid" ? { mcq_count: mcqCount, typing_count: typingCount } : {})
      });
    }, 400);

    return () => {
      if (configSaveTimer.current) window.clearTimeout(configSaveTimer.current);
    };
  }, [questionType, questionCount, coverage, difficulty, mcqCount, typingCount, classId]);

  // ChatGPA v1.12: Unified text source (always directText)
  // ✅ Safe - simpler than multi-mode approach
  const notesSource = useMemo(() => {
    return directText.trim();
  }, [directText]);

  // ChatGPA v1.12: Unified file drop handler - inserts into directText
  // ✅ Safe - merges file content instead of replacing mode
  async function extractTextFromFile(f: File) {
    const name = f.name.toLowerCase();
    // lightweight, safe support: .txt / .md
    if (name.endsWith(".txt") || name.endsWith(".md")) {
      try {
        const text = await f.text();
        // Insert at end of existing text (or replace if empty)
        setDirectText((prev: string) => {
          if (prev.trim().length === 0) return text;
          return prev + "\n\n" + text;
        });
        push({ kind: "success", text: `File "${f.name}" imported successfully.` });
      } catch (err) {
        console.error("FILE_READ_ERROR", { file: f.name, error: err });
        push({ kind: "error", text: "Could not read file. Please try again." });
      }
      return;
    }
    // later (Phase 2): PDFs/Docs with server parsing
    push({ kind: "error", text: "Unsupported file format. Use .txt or .md, or paste text directly." });
  }

  // Build current config from state
  function getCurrentConfig(): QuizConfig {
    const config: QuizConfig = {
      question_type: questionType,
      question_count: questionCount,
      coverage,
      difficulty,
    };

    // Add question_counts for hybrid mode
    if (questionType === "hybrid") {
      config.question_counts = {
        mcq: mcqCount,
        typing: typingCount,
      };
    }

    return config;
  }

  // Load config from localStorage with hierarchy
  function loadConfig(currentClassId: string | null): QuizConfig {
    try {
      // Priority: class-specific → standalone → global default → hardcoded
      const keys = [
        getConfigKey(currentClassId),
        LS_KEY_CONFIG_STANDALONE,
        LS_KEY_CONFIG_DEFAULT
      ];

      for (const key of keys) {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Validate basic structure
          if (parsed && typeof parsed === "object" && parsed.question_type) {
            return { ...DEFAULT_CONFIG, ...parsed };
          }
        }
      }
    } catch (error) {
      console.error("CONFIG_LOAD_ERROR", error);
    }

    return DEFAULT_CONFIG;
  }

  // Save config to localStorage
  function saveConfig(config: QuizConfig, currentClassId: string | null) {
    try {
      const key = getConfigKey(currentClassId);
      localStorage.setItem(key, JSON.stringify(config));

      // Also save as global default
      localStorage.setItem(LS_KEY_CONFIG_DEFAULT, JSON.stringify(config));
    } catch (error) {
      console.error("CONFIG_SAVE_ERROR", error);
    }
  }

  // Apply config to state
  function applyConfig(config: QuizConfig) {
    setQuestionType(config.question_type);
    setQuestionCount(config.question_count);
    setCoverage(config.coverage);
    setDifficulty(config.difficulty);

    if (config.question_type === "hybrid" && config.question_counts) {
      setMcqCount(config.question_counts.mcq);
      setTypingCount(config.question_counts.typing);
    } else {
      // Reset hybrid counts
      const defaultMcq = Math.ceil(config.question_count * 0.6);
      setMcqCount(defaultMcq);
      setTypingCount(config.question_count - defaultMcq);
    }
  }

  // Reset config to defaults
  function resetConfig() {
    applyConfig(DEFAULT_CONFIG);

    // Clear from localStorage
    try {
      const key = getConfigKey(classId);
      localStorage.removeItem(key);
    } catch (error) {
      console.error("CONFIG_RESET_ERROR", error);
    }

    track("quiz_config_reset", {
      context: classId || "standalone"
    });
  }

  // Section 7: Text-only mode toggle handler
  function handleTextOnlyToggle(enabled: boolean) {
    setTextOnlyMode(enabled);
    try {
      localStorage.setItem('text_only_mode', String(enabled));
    } catch (error) {
      console.error("TEXT_ONLY_MODE_SAVE_ERROR", error);
    }
    track("text_only_mode_toggled", { enabled });
  }

  // ChatGPA v1.12: Unified drag & drop handlers (works with directText)
  // ✅ Safe - simplified from mode-specific logic
  function onDragOver(e: any) {
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeave(e: any) {
    e.preventDefault();
    setDragOver(false);
  }

  async function onDrop(e: any) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    await extractTextFromFile(f);
  }

  async function submitGenerate() {
    // Section 4: Validate hybrid counts before submitting
    if (questionType === "hybrid" && mcqCount + typingCount !== questionCount) {
      push({
        kind: "error",
        text: `Hybrid question counts must sum to ${questionCount}. Currently: ${mcqCount} MCQ + ${typingCount} Typing = ${mcqCount + typingCount}`
      });
      return;
    }

    setLoading(true);

    // Track telemetry: start
    track("quiz_generated_start", {
      classId: classId ?? null,
      charCount: notesSource.length,
      autoQuestionCount,
      actualQuestionCount: questionCount
    });

    try {
      // ChatGPA v1.12: Simplified validation (no mode checks)
      // ✅ Safe - matches backend schema requirements
      if (!notesSource || notesSource.length < 20) {
        push({ kind: "error", text: "Notes too short (minimum 20 characters). Add more content." });
        setLoading(false);
        track("quiz_generated_failure", { reason: "notes_too_short" });
        return;
      }

      if (notesSource.length > 50000) {
        push({ kind: "error", text: "Notes too long (maximum 50,000 characters). Please shorten." });
        setLoading(false);
        track("quiz_generated_failure", { reason: "notes_too_long" });
        return;
      }

      // ⚠️ Verify - assumes classId will always be set by auto-selection logic
      if (!classId) {
        push({ kind: "error", text: "No class selected. Please try refreshing the page." });
        setLoading(false);
        track("quiz_generated_failure", { reason: "no_class_id" });
        return;
      }

      // auth token for RLS
      const session = (await supabase.auth.getSession()).data.session;
      const accessToken = session?.access_token;
      if (!accessToken) {
        push({ kind: "error", text: "You are signed out. Please sign in again." });
        setLoading(false);
        track("quiz_generated_failure", { reason: "no_token" });
        return;
      }

      // Section 4: Build config to send
      const configToSend = getCurrentConfig();

      // Call quiz generator API
      // ✅ Safe - existing API contract preserved
      const res = await fetch("/api/v1/ai?action=generate_quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          notes_text: notesSource,
          class_id: classId,
          config: configToSend,
        }),
      });

      const payload = await res.json();

      // ChatGPA v1.12: Improved error handling with specific messages
      if (!res.ok) {
        console.error("GENERATE_API_ERROR", { status: res.status, payload });

        // Track failure
        track("quiz_generated_failure", {
          status: res.status,
          code: payload?.code || "unknown",
          message: payload?.message
        });

        // ✅ Safe - Handle LIMIT_EXCEEDED as 429 per plan
        if (payload?.code === "USAGE_LIMIT_REACHED" || payload?.code === "LIMIT_EXCEEDED") {
          push({
            kind: "error",
            text: "Free plan limit (5 quizzes). Upgrade to continue or wait 24h."
          });
        } else if (payload?.code === "SCHEMA_INVALID") {
          push({ kind: "error", text: `Validation error: ${payload.message || "Invalid input"}` });
        } else if (!navigator.onLine) {
          push({ kind: "error", text: "Connection lost. Check your internet and try again." });
        } else {
          push({ kind: "error", text: payload?.message || "Failed to generate quiz. Please try again." });
        }

        setLoading(false);
        return;
      }

      const quizId: string | undefined = payload?.data?.quiz_id || payload?.data?.id;
      if (!quizId) {
        console.error("GENERATE_API_NO_ID", payload);
        track("quiz_generated_failure", { reason: "no_quiz_id" });
        push({ kind: "error", text: "Quiz created but no ID returned." });
        setLoading(false);
        return;
      }

      // ChatGPA v1.12: Save last used class to localStorage
      // ✅ Safe - enables auto-selection on next visit
      try {
        localStorage.setItem(LS_KEY_LAST_CLASS, classId);
      } catch (error) {
        console.error("LAST_CLASS_SAVE_ERROR", error);
      }

      // Track success
      track("quiz_generated_success", { quizId, classId });

      // Section 4: Check if fewer questions were generated due to insufficient notes
      const actualCount = payload?.data?.actual_question_count;
      if (actualCount && actualCount < questionCount) {
        push({
          kind: "success",
          text: `Quiz generated with ${actualCount} questions (requested ${questionCount}) due to limited material.`
        });
      } else {
        push({ kind: "success", text: "Quiz generated!" });
      }

      // Clear autosave
      try {
        localStorage.removeItem(LS_KEY_DIRECT);
      } catch {
        // no-op
      }

      navigate(`/quiz/${quizId}`);
    } catch (e: any) {
      console.error("GENERATE_SUBMIT_ERROR", e);

      // Track exception
      track("quiz_generated_failure", {
        reason: "exception",
        message: e?.message
      });

      push({ kind: "error", text: "Unexpected error. Please try again." });
      setLoading(false);
    }
  }

  // ChatGPA v1.12: Character count for UX feedback
  const charCount = directText.length;
  const isValid = charCount >= 20 && charCount <= 50000;

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-[32px] font-semibold tracking-[-.2px] m-0 mb-2">
            Generate Quiz
          </h2>
          <p className="text-[var(--text-muted)] m-0 text-[15px]">
            Paste your notes and we'll create a quiz in seconds.
          </p>
        </div>

        {/* Main Input Section */}
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-2xl p-6 md:p-8 mb-6">
          {/* Unified Notes Input with Drag & Drop */}
          <div className="mb-6">
            <label className="text-sm font-medium block mb-3 text-[var(--text)]">
              Your Notes
            </label>

            <div
              className={`relative transition-all duration-200 ${
                dragOver ? 'ring-2 ring-[var(--accent)] ring-opacity-50' : ''
              }`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <textarea
                rows={14}
                className="w-full bg-[var(--surface-raised)] border border-[var(--border-strong)] rounded-xl p-4 text-[14px] font-mono resize-y transition-all duration-200 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-opacity-20 outline-none"
                style={{
                  color: "var(--text)",
                  lineHeight: "1.6"
                }}
                placeholder="Paste your notes here or drag in a file...

Examples:
• Study notes for an exam
• Chapter summaries
• Lecture transcripts
• Your own written notes"
                value={directText}
                onChange={(e: any) => setDirectText(e.target.value)}
                aria-label="Notes input"
                aria-describedby="char-count auto-count-badge"
              />

              {/* Drag overlay hint */}
              {dragOver && (
                <div className="absolute inset-0 bg-[var(--accent)] bg-opacity-5 rounded-xl flex items-center justify-center pointer-events-none">
                  <div className="text-[var(--accent)] font-medium text-sm">
                    Drop file to import
                  </div>
                </div>
              )}
            </div>

            {/* Character count and auto question badge */}
            <div className="flex items-center justify-between mt-3">
              <div id="char-count" className="text-xs text-[var(--text-muted)]">
                {charCount.toLocaleString()} / 50,000 characters
                {charCount < 20 && charCount > 0 && (
                  <span className="ml-2 text-[var(--score-fail)]">
                    (minimum 20)
                  </span>
                )}
              </div>

              {charCount > 0 && (
                <div id="auto-count-badge" className="text-xs bg-[var(--accent-soft)] text-[var(--accent-text)] px-3 py-1 rounded-full font-medium">
                  We'll create ~{autoQuestionCount} questions
                </div>
              )}
            </div>

            {/* File input button (alternative to drag-drop) */}
            <div className="mt-4">
              <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--surface-raised)] hover:bg-[var(--surface-subtle)] border border-[var(--border-subtle)] rounded-lg cursor-pointer transition-colors duration-200">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
                Import File (.txt, .md)
                <input
                  type="file"
                  accept=".txt,.md"
                  className="hidden"
                  onChange={async (e: any) => {
                    const f = e.target.files?.[0];
                    if (f) await extractTextFromFile(f);
                  }}
                />
              </label>
            </div>
          </div>

          {/* Advanced Settings (Collapsed Accordion) */}
          <details
            open={showAdvanced}
            onToggle={(e: any) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
            className="mt-6"
          >
            <summary className="text-sm font-semibold cursor-pointer mb-4 text-[var(--text)] hover:text-[var(--accent)] transition-colors select-none">
              Advanced Settings
            </summary>

            <div className="pl-4 border-l-2 border-[var(--border-subtle)] space-y-5">
              {/* Class/Subject Selector */}
              <div>
                <label className="text-sm font-medium block mb-2 text-[var(--text-muted)]">
                  Subject <span className="font-normal">(optional)</span>
                </label>
                <select
                  className="w-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-lg p-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                  value={classId ?? ""}
                  onChange={(e: any) => {
                    const newClassId = e.target.value || null;
                    setClassId(newClassId);
                    if (newClassId) {
                      localStorage.setItem(LS_KEY_LAST_CLASS, newClassId);
                    }
                  }}
                  aria-label="Select subject"
                >
                  {classes.map((c: ClassRow) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {classId && (
                  <div className="text-xs text-[var(--text-soft)] mt-1.5">
                    Currently using: {classes.find((c: ClassRow) => c.id === classId)?.name}
                  </div>
                )}
              </div>

              {/* Question Count Override */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-[var(--text-muted)]">
                    Question Count
                  </label>
                  <span className="text-sm font-semibold text-[var(--text)]">
                    {questionCount}
                  </span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="20"
                  value={questionCount}
                  onChange={(e: any) => {
                    setQuestionCount(Number(e.target.value));
                    setUserOverrodeQuestionCount(true); // Mark as manually changed
                  }}
                  className="w-full accent-[var(--accent)]"
                  aria-label="Question count"
                  aria-valuemin={3}
                  aria-valuemax={20}
                  aria-valuenow={questionCount}
                />
                <div className="text-xs text-[var(--text-soft)] mt-1.5">
                  Range: 3-20 questions
                  {userOverrodeQuestionCount && autoQuestionCount !== questionCount && (
                    <span className="ml-2">
                      (suggested: {autoQuestionCount})
                    </span>
                  )}
                </div>
              </div>

              {/* Question Type */}
              <div>
                <label className="text-sm font-medium block mb-2 text-[var(--text-muted)]">
                  Question Type
                </label>
                <div className="flex gap-2" role="radiogroup" aria-label="Question type">
                  <button
                    className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border transition-all ${
                      questionType === "mcq"
                        ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                        : "bg-[var(--surface-raised)] text-[var(--text)] border-[var(--border-subtle)] hover:border-[var(--accent)]"
                    }`}
                    onClick={() => setQuestionType("mcq")}
                    role="radio"
                    aria-checked={questionType === "mcq"}
                  >
                    MCQ
                  </button>
                  <button
                    className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border transition-all ${
                      questionType === "typing"
                        ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                        : "bg-[var(--surface-raised)] text-[var(--text)] border-[var(--border-subtle)] hover:border-[var(--accent)]"
                    }`}
                    onClick={() => setQuestionType("typing")}
                    role="radio"
                    aria-checked={questionType === "typing"}
                  >
                    Typing
                  </button>
                  <button
                    className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border transition-all ${
                      questionType === "hybrid"
                        ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                        : "bg-[var(--surface-raised)] text-[var(--text)] border-[var(--border-subtle)] hover:border-[var(--accent)]"
                    }`}
                    onClick={() => setQuestionType("hybrid")}
                    role="radio"
                    aria-checked={questionType === "hybrid"}
                  >
                    Hybrid
                  </button>
                </div>
              </div>

              {/* Hybrid Distribution (only if hybrid selected) */}
              {questionType === "hybrid" && (
                <div className="bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-lg p-4">
                  <label className="text-sm font-medium block mb-3 text-[var(--text)]">
                    Question Distribution
                  </label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-[var(--text-muted)] w-20">
                        MCQ:
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={questionCount}
                        value={mcqCount}
                        onChange={(e: any) => {
                          const val = Number(e.target.value);
                          if (val >= 0 && val <= questionCount) {
                            setMcqCount(val);
                            setTypingCount(questionCount - val);
                          }
                        }}
                        className="flex-1 bg-[var(--surface)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                        aria-label="MCQ question count"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-[var(--text-muted)] w-20">
                        Typing:
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={questionCount}
                        value={typingCount}
                        onChange={(e: any) => {
                          const val = Number(e.target.value);
                          if (val >= 0 && val <= questionCount) {
                            setTypingCount(val);
                            setMcqCount(questionCount - val);
                          }
                        }}
                        className="flex-1 bg-[var(--surface)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                        aria-label="Typing question count"
                      />
                    </div>
                    {mcqCount + typingCount !== questionCount && (
                      <div className="text-xs text-[var(--score-fail)] font-medium">
                        Total must equal {questionCount}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Difficulty */}
              <div>
                <label className="text-sm font-medium block mb-2 text-[var(--text-muted)]">
                  Difficulty
                </label>
                <div className="flex gap-2" role="radiogroup" aria-label="Difficulty level">
                  {(["low", "medium", "high"] as DifficultyLevel[]).map((level) => (
                    <button
                      key={level}
                      className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border transition-all capitalize ${
                        difficulty === level
                          ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                          : "bg-[var(--surface-raised)] text-[var(--text)] border-[var(--border-subtle)] hover:border-[var(--accent)]"
                      }`}
                      onClick={() => setDifficulty(level)}
                      role="radio"
                      aria-checked={difficulty === level}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Coverage */}
              <div>
                <label className="text-sm font-medium block mb-2 text-[var(--text-muted)]">
                  Coverage Strategy
                </label>
                <div className="flex gap-2" role="radiogroup" aria-label="Coverage strategy">
                  <button
                    className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border transition-all ${
                      coverage === "key_concepts"
                        ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                        : "bg-[var(--surface-raised)] text-[var(--text)] border-[var(--border-subtle)] hover:border-[var(--accent)]"
                    }`}
                    onClick={() => setCoverage("key_concepts")}
                    role="radio"
                    aria-checked={coverage === "key_concepts"}
                  >
                    Key Concepts
                  </button>
                  <button
                    className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border transition-all ${
                      coverage === "broad_sample"
                        ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                        : "bg-[var(--surface-raised)] text-[var(--text)] border-[var(--border-subtle)] hover:border-[var(--accent)]"
                    }`}
                    onClick={() => setCoverage("broad_sample")}
                    role="radio"
                    aria-checked={coverage === "broad_sample"}
                  >
                    Broad Sample
                  </button>
                </div>
              </div>

              {/* Text-only mode toggle */}
              <div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={textOnlyMode}
                    onChange={(e: any) => handleTextOnlyToggle(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[var(--accent)]"
                    aria-label="Enable text-only mode"
                  />
                  <div>
                    <div className="text-sm font-medium text-[var(--text)]">
                      Text-only mode
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      Disable decorative visuals on quiz pages
                    </div>
                  </div>
                </label>
              </div>

              {/* Reset button */}
              <button
                className="text-sm text-[var(--text-muted)] hover:text-[var(--accent)] font-medium transition-colors"
                onClick={resetConfig}
                aria-label="Reset configuration to defaults"
              >
                Reset to Defaults
              </button>
            </div>
          </details>

          {/* Primary CTA */}
          <div className="mt-6 flex gap-3 items-center">
            <button
              className={`flex-1 px-6 py-3.5 text-base font-semibold rounded-xl transition-all ${
                loading || !isValid
                  ? "bg-[var(--surface-subtle)] text-[var(--text-soft)] cursor-not-allowed"
                  : "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] active:scale-[0.98]"
              }`}
              onClick={submitGenerate}
              disabled={loading || !isValid}
              aria-busy={loading}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </span>
              ) : (
                "Generate Quiz"
              )}
            </button>
          </div>

          {/* Cost estimate */}
          <div className="mt-3 text-xs text-[var(--text-soft)] text-center">
            Est. ~{estimatedTokens.toLocaleString()} tokens
          </div>
        </div>
      </div>
    </PageShell>
  );
}
