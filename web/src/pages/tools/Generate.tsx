// Purpose: Generate Quiz tool page - 3 modes: paste text, import file, or from class notes
// Connects to: /api/generate-quiz, quiz results
// Features: Drag-and-drop file upload, localStorage autosave, telemetry tracking

import { useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { useNavigate } from "react-router-dom";
import { track } from "@/lib/telemetry";
import type { QuizConfig, QuestionType, CoverageStrategy, DifficultyLevel, Folder } from "../../../shared/types";

type ClassRow = { id: string; name: string };
type Mode = "direct" | "file" | "class";

const LS_KEY_DIRECT = "generate.directText";
const LS_KEY_CONFIG_DEFAULT = "quiz_config_default";
const LS_KEY_CONFIG_STANDALONE = "quiz_config_standalone";

// Helper to get config localStorage key
function getConfigKey(classId: string | null): string {
  if (classId) {
    return `quiz_config_class_${classId}`;
  }
  return LS_KEY_CONFIG_STANDALONE;
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

  const [mode, setMode] = useState<Mode>("direct");

  // classes (for class mode)
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string | null>(null);

  // folders (for class mode folder filter)
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // direct mode
  const [directText, setDirectText] = useState("");

  // file mode
  const [file, setFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState("");
  const [dragOver, setDragOver] = useState(false);

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

  // load classes for class mode
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error} = await supabase
        .from("classes")
        .select("id,name")
        .order("created_at", { ascending: false});

      if (!alive) return;
      if (error) {
        console.error("GENERATE_LOAD_CLASSES_ERROR", error);
        setClasses([]);
      } else {
        setClasses(data ?? []);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // load folders when class changes (if workspace folders enabled)
  useEffect(() => {
    if (!classId) {
      setFolders([]);
      setSelectedFolderId(null);
      return;
    }

    const workspaceFoldersEnabled = import.meta.env.VITE_FEATURE_WORKSPACE_FOLDERS === "true";
    if (!workspaceFoldersEnabled) return;

    let alive = true;
    (async () => {
      try {
        const token = localStorage.getItem("supabase.auth.token");
        if (!token) return;

        const response = await fetch(`/api/folders/flat?class_id=${classId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!alive) return;

        if (response.ok) {
          const data = await response.json();
          setFolders(data.folders || []);
        } else {
          console.error("GENERATE_LOAD_FOLDERS_ERROR", { status: response.status });
          setFolders([]);
        }
      } catch (err) {
        console.error("GENERATE_LOAD_FOLDERS_ERROR", err);
        setFolders([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [classId]);

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

  // unified current text for direct/file
  const notesSource = useMemo(() => {
    if (mode === "direct") return directText.trim();
    if (mode === "file") return fileText.trim();
    return ""; // class mode resolves on submit
  }, [mode, directText, fileText]);

  async function extractTextFromFile(f: File) {
    const name = f.name.toLowerCase();
    // lightweight, safe support: .txt / .md
    if (name.endsWith(".txt") || name.endsWith(".md")) {
      try {
        const text = await f.text();
        setFileText(text);
      } catch (err) {
        console.error("FILE_READ_ERROR", { file: f.name, error: err });
        push({ kind: "error", text: "Could not read file. Please try again." });
        setFile(null);
        setFileText("");
      }
      return;
    }
    // later (Phase 2): PDFs/Docs with server parsing
    setFile(null);
    setFileText("");
    push({ kind: "error", text: "Unsupported file format. Use .txt or .md, or paste text directly." });
  }

  async function buildClassNotesText(selectedClassId: string, folderId: string | null = null) {
    try {
      let data: Array<{ content: string }> = [];

      if (!folderId) {
        // No folder filter - get all notes in class (default behavior)
        const { data: notesData, error } = await supabase
          .from("notes")
          .select("content")
          .eq("class_id", selectedClassId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        data = notesData ?? [];
      } else if (folderId === "uncategorized") {
        // Special case: uncategorized notes (no mapping in note_folders)
        const token = localStorage.getItem("supabase.auth.token");
        if (!token) throw new Error("Not authenticated");

        const response = await fetch(
          `/api/classes/notes-uncategorized?class_id=${selectedClassId}&limit=1000`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!response.ok) throw new Error("Failed to load uncategorized notes");
        const result = await response.json();
        data = (result.notes || []).map((n: any) => ({ content: n.content }));
      } else {
        // Specific folder - get descendant folders and query recursively
        const { data: descendantData, error: rpcError } = await supabase
          .rpc("get_descendant_folders", { parent_folder_id: folderId });

        if (rpcError) throw rpcError;

        const folderIds = (descendantData || []).map((f: any) => f.folder_id);

        // Fetch notes in any of these folders
        const { data: notesData, error: notesError } = await supabase
          .from("notes")
          .select("content, note_folders!inner(folder_id)")
          .eq("class_id", selectedClassId)
          .in("note_folders.folder_id", folderIds)
          .order("created_at", { ascending: true });

        if (notesError) throw notesError;
        data = (notesData ?? []).map(n => ({ content: n.content }));
      }

      const text = data.map(n => n.content || "").join("\n\n").trim();
      return { text, ok: true };
    } catch (error: any) {
      console.error("GENERATE_LOAD_NOTES_ERROR", { selectedClassId, folderId, error });
      return { text: "", ok: false };
    }
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

  // Drag & drop handlers
  function onDragOver(e: React.DragEvent) {
    if (mode !== "file") return;
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeave(e: React.DragEvent) {
    if (mode !== "file") return;
    e.preventDefault();
    setDragOver(false);
  }

  async function onDrop(e: React.DragEvent) {
    if (mode !== "file") return;
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    setFile(f);
    setFileText("");
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
      mode,
      classId: classId ?? null,
      hasNotes: !!notesSource,
      charCount: mode === "direct" || mode === "file" ? notesSource.length : 0
    });

    try {
      let notes_text = "";
      let quiz_class_id: string | null = null;

      if (mode === "direct") {
        if (!notesSource) {
          push({ kind: "error", text: "Paste your study material first." });
          setLoading(false);
          track("quiz_generated_failure", { reason: "empty_direct" });
          return;
        }
        notes_text = notesSource;
      } else if (mode === "file") {
        if (!notesSource) {
          push({ kind: "error", text: "Import a supported file or paste text." });
          setLoading(false);
          track("quiz_generated_failure", { reason: "empty_file" });
          return;
        }
        notes_text = notesSource;
      } else {
        // class mode
        if (!classId) {
          push({ kind: "error", text: "Choose a class." });
          setLoading(false);
          track("quiz_generated_failure", { reason: "no_class" });
          return;
        }
        const { text, ok } = await buildClassNotesText(classId, selectedFolderId);
        if (!ok) {
          push({ kind: "error", text: "Could not load class notes." });
          setLoading(false);
          track("quiz_generated_failure", { reason: "notes_fetch_error" });
          return;
        }
        if (!text) {
          push({ kind: "error", text: "This class has no notes yet." });
          setLoading(false);
          track("quiz_generated_failure", { reason: "empty_class_notes" });
          return;
        }
        notes_text = text;
        quiz_class_id = classId; // associate quiz with class
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
      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          notes_text,
          class_id: quiz_class_id, // null for paste/file, string for class mode
          config: configToSend, // Section 4: Include quiz config
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        console.error("GENERATE_API_ERROR", { status: res.status, payload });

        // Track failure
        track("quiz_generated_failure", {
          status: res.status,
          code: payload?.code || "unknown",
          message: payload?.message
        });

        // Handle USAGE_LIMIT_REACHED specially
        if (payload?.code === "USAGE_LIMIT_REACHED") {
          push({
            kind: "error",
            text: `${payload.message} ${payload.upgrade_hint || ""}`
          });
        } else {
          push({ kind: "error", text: payload?.message || "Failed to generate quiz." });
        }

        setLoading(false);
        return;
      }

      const quizId: string | undefined = payload?.quiz_id || payload?.id;
      if (!quizId) {
        console.error("GENERATE_API_NO_ID", payload);
        track("quiz_generated_failure", { reason: "no_quiz_id" });
        push({ kind: "error", text: "Quiz created but no ID returned." });
        setLoading(false);
        return;
      }

      // Track success
      track("quiz_generated_success", { mode, quizId });

      // Section 4: Check if fewer questions were generated due to insufficient notes
      const actualCount = payload?.actual_question_count;
      if (actualCount && actualCount < questionCount) {
        push({
          kind: "success",
          text: `Quiz generated with ${actualCount} questions (requested ${questionCount}) due to limited material.`
        });
      } else {
        push({ kind: "success", text: "Quiz generated!" });
      }

      // Clear autosave
      if (mode === "direct") {
        try {
          localStorage.removeItem(LS_KEY_DIRECT);
        } catch {
          // no-op
        }
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

  return (
    <PageShell>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-[32px] font-semibold tracking-[-.2px] m-0 mb-2">Generate Quiz</h2>
          <p className="text-muted m-0">
            Create a quiz by pasting study material, importing a file, or pulling from an existing class.
          </p>
        </div>

        <div className="surface bdr radius p-6">
          {/* Mode switcher */}
          <div className="flex gap-2 mb-6">
            <button
              className={`btn ${mode === "direct" ? "primary" : "ghost"}`}
              onClick={() => setMode("direct")}
              aria-pressed={mode === "direct"}
            >
              Paste Text
            </button>
            <button
              className={`btn ${mode === "file" ? "primary" : "ghost"}`}
              onClick={() => setMode("file")}
              aria-pressed={mode === "file"}
            >
              Import File
            </button>
            <button
              className={`btn ${mode === "class" ? "primary" : "ghost"}`}
              onClick={() => setMode("class")}
              aria-pressed={mode === "class"}
            >
              From Class Notes
            </button>
          </div>

          {/* Section 4: Quiz Config Controls */}
          <div
            className="surface-2 bdr radius p-4 mb-6"
            style={{ transition: "all 0.2s cubic-bezier(0.2, 0, 0, 1)" }}
          >
            {/* Question Type Hotbar */}
            <div className="mb-4">
              <label className="text-sm font-medium block mb-2">Question Type</label>
              <div className="flex gap-2" role="radiogroup" aria-label="Question type">
                <button
                  className={`btn ${questionType === "mcq" ? "primary" : "ghost"}`}
                  onClick={() => setQuestionType("mcq")}
                  role="radio"
                  aria-checked={questionType === "mcq"}
                >
                  MCQ
                </button>
                <button
                  className={`btn ${questionType === "typing" ? "primary" : "ghost"}`}
                  onClick={() => setQuestionType("typing")}
                  role="radio"
                  aria-checked={questionType === "typing"}
                >
                  Typing
                </button>
                <button
                  className={`btn ${questionType === "hybrid" ? "primary" : "ghost"}`}
                  onClick={() => setQuestionType("hybrid")}
                  role="radio"
                  aria-checked={questionType === "hybrid"}
                >
                  Hybrid
                </button>
              </div>
            </div>

            {/* Question Count Slider */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium">Question Count</label>
                <span
                  className="text-sm font-semibold"
                  style={{
                    transition: "transform 0.15s cubic-bezier(0.2, 0, 0, 1)",
                    display: "inline-block",
                  }}
                  key={questionCount}
                >
                  {questionCount}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full"
                style={{ transition: "all 0.15s ease" }}
                aria-label="Question count"
                aria-valuemin={1}
                aria-valuemax={10}
                aria-valuenow={questionCount}
              />
            </div>

            {/* Coverage Strategy Toggle */}
            <div className="mb-4">
              <label className="text-sm font-medium block mb-2">Coverage Strategy</label>
              <div className="flex gap-2" role="radiogroup" aria-label="Coverage strategy">
                <button
                  className={`btn ${coverage === "key_concepts" ? "primary" : "ghost"}`}
                  onClick={() => setCoverage("key_concepts")}
                  role="radio"
                  aria-checked={coverage === "key_concepts"}
                >
                  Cover Key Concepts
                </button>
                <button
                  className={`btn ${coverage === "broad_sample" ? "primary" : "ghost"}`}
                  onClick={() => setCoverage("broad_sample")}
                  role="radio"
                  aria-checked={coverage === "broad_sample"}
                >
                  Sample Broadly
                </button>
              </div>
            </div>

            {/* Advanced Options */}
            <details
              open={showAdvanced}
              onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
              style={{ transition: "all 0.2s cubic-bezier(0.2, 0, 0, 1)" }}
            >
              <summary
                className="text-sm font-medium cursor-pointer mb-3"
                style={{
                  transition: "color 0.15s ease",
                  color: showAdvanced ? "var(--text)" : "var(--text-muted)",
                }}
              >
                Advanced Options
              </summary>

              <div
                className="pl-3 border-l-2 border-border"
                style={{
                  transition: "opacity 0.2s ease, transform 0.2s cubic-bezier(0.2, 0, 0, 1)",
                  opacity: showAdvanced ? 1 : 0,
                }}
              >
                {/* Hybrid Counts (only show if hybrid) */}
                {questionType === "hybrid" && (
                  <div className="mb-4">
                    <label className="text-sm font-medium block mb-2">Question Distribution</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-muted w-20">MCQ:</label>
                        <input
                          type="number"
                          min="0"
                          max={questionCount}
                          value={mcqCount}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (val >= 0 && val <= questionCount) {
                              setMcqCount(val);
                              setTypingCount(questionCount - val);
                            }
                          }}
                          className="surface bdr radius px-2 py-1 w-20 text-sm"
                          aria-label="MCQ question count"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-muted w-20">Typing:</label>
                        <input
                          type="number"
                          min="0"
                          max={questionCount}
                          value={typingCount}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (val >= 0 && val <= questionCount) {
                              setTypingCount(val);
                              setMcqCount(questionCount - val);
                            }
                          }}
                          className="surface bdr radius px-2 py-1 w-20 text-sm"
                          aria-label="Typing question count"
                        />
                      </div>
                      {mcqCount + typingCount !== questionCount && (
                        <div
                          className="text-xs"
                          style={{
                            color: "#dc2626",
                            transition: "opacity 0.2s ease",
                            animation: "fadeIn 0.2s ease",
                          }}
                        >
                          Total must equal {questionCount}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Difficulty Selector */}
                <div className="mb-4">
                  <label className="text-sm font-medium block mb-2">Difficulty</label>
                  <div className="flex gap-2" role="radiogroup" aria-label="Difficulty level">
                    <button
                      className={`btn ${difficulty === "low" ? "primary" : "ghost"}`}
                      onClick={() => setDifficulty("low")}
                      role="radio"
                      aria-checked={difficulty === "low"}
                    >
                      Low
                    </button>
                    <button
                      className={`btn ${difficulty === "medium" ? "primary" : "ghost"}`}
                      onClick={() => setDifficulty("medium")}
                      role="radio"
                      aria-checked={difficulty === "medium"}
                    >
                      Medium
                    </button>
                    <button
                      className={`btn ${difficulty === "high" ? "primary" : "ghost"}`}
                      onClick={() => setDifficulty("high")}
                      role="radio"
                      aria-checked={difficulty === "high"}
                    >
                      High
                    </button>
                  </div>
                </div>

                {/* Section 7: Text-Only Mode Toggle */}
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={textOnlyMode}
                      onChange={(e) => handleTextOnlyToggle(e.target.checked)}
                      className="w-4 h-4"
                      aria-label="Enable text-only mode"
                    />
                    <span className="text-sm">
                      Text-only mode (disable decorative visuals)
                    </span>
                  </label>
                  <p className="text-xs text-muted mt-1 ml-6">
                    When enabled, quiz pages will show clean text without decorative elements
                  </p>
                </div>
              </div>
            </details>

            {/* Reset Button */}
            <button
              className="btn ghost text-sm mt-2"
              onClick={resetConfig}
              aria-label="Reset configuration to defaults"
            >
              Reset to Defaults
            </button>
          </div>

          {/* Mode panels */}
          {mode === "direct" && (
            <div className="mb-6">
              <label className="text-sm text-muted block mb-2">Paste your study material</label>
              <textarea
                rows={12}
                className="w-full surface-2 bdr radius p-3 text-[14px]"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontFamily: "inherit"
                }}
                placeholder="Paste text here…"
                value={directText}
                onChange={(e) => setDirectText(e.target.value)}
              />
              {directText && (
                <div className="text-xs text-muted mt-2">
                  {directText.length.toLocaleString()} characters
                </div>
              )}
            </div>
          )}

          {mode === "file" && (
            <div
              className={`mb-6 p-3 radius bdr transition-colors ${dragOver ? "surface-3" : "surface-2"}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <label className="text-sm text-muted block mb-2">Upload a .txt or .md file</label>
              <input
                type="file"
                accept=".txt,.md"
                className="block mb-3"
                onChange={async (e) => {
                  const f = e.target.files?.[0] || null;
                  setFile(f);
                  setFileText("");
                  if (f) await extractTextFromFile(f);
                }}
              />
              <div className="text-xs text-muted mb-2">Or drag & drop a file here</div>

              {file && (
                <div className="text-sm text-muted mb-3">
                  Selected: <span className="text-foreground font-medium">{file.name}</span>
                </div>
              )}
              {fileText && (
                <>
                  <div className="text-sm text-muted mb-2">Preview (editable)</div>
                  <textarea
                    rows={10}
                    className="w-full surface-2 bdr radius p-3 text-[14px]"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                      fontFamily: "inherit"
                    }}
                    value={fileText}
                    onChange={(e) => setFileText(e.target.value)}
                  />
                  <div className="text-xs text-muted mt-2">
                    {fileText.length.toLocaleString()} characters
                  </div>
                </>
              )}
            </div>
          )}

          {mode === "class" && (
            <div className="mb-6">
              <label className="text-sm text-muted block mb-2">Choose a class</label>
              <select
                className="surface-2 bdr radius p-2 text-[14px] w-full"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)"
                }}
                value={classId ?? ""}
                onChange={(e) => setClassId(e.target.value || null)}
              >
                <option value="">— Select —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Folder filter (optional) - only show if class selected and folders available */}
              {classId && folders.length > 0 && (
                <div className="mt-4">
                  <label className="text-sm text-muted block mb-2">Filter by folder (optional)</label>
                  <select
                    className="surface-2 bdr radius p-2 text-[14px] w-full"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--text)"
                    }}
                    value={selectedFolderId ?? ""}
                    onChange={(e) => setSelectedFolderId(e.target.value || null)}
                  >
                    <option value="">All notes</option>
                    <option value="uncategorized">Uncategorized</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted mt-2 mb-0">
                    {selectedFolderId
                      ? selectedFolderId === "uncategorized"
                        ? "Only notes without a folder"
                        : "Includes notes in this folder and all subfolders"
                      : "All notes in the class"}
                  </p>
                </div>
              )}

              <p className="text-sm text-muted mt-3 mb-0">
                We'll combine all notes in the selected class to build your quiz.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button className="btn primary" onClick={submitGenerate} disabled={loading} aria-busy={loading}>
              {loading ? "Generating…" : "Generate Quiz"}
            </button>
            <button className="btn ghost" onClick={() => navigate("/")}>
              Back
            </button>
          </div>

          {/* Cost Estimate */}
          <div
            className="text-xs text-muted mt-3"
            style={{
              transition: "opacity 0.2s ease",
              opacity: 0.7,
            }}
          >
            Est. ~{estimatedTokens.toLocaleString()} tokens
          </div>
        </div>
      </div>
    </PageShell>
  );
}
