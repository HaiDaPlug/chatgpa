/**
 * FollowUpFeedback Component
 * ChatGPA v1.12 - Shows weak questions + improvement tips + CTAs
 * Used in AttemptDetail.tsx for submitted quizzes
 */

import { useNavigate } from "react-router-dom";
import { track } from "@/lib/telemetry";

interface BreakdownItem {
  id: string;
  type: "mcq" | "short";
  prompt: string;
  user_answer: string;
  correct: boolean;
  correct_answer?: string;
  feedback: string;
  improvement?: string;
}

interface FollowUpFeedbackProps {
  breakdown: BreakdownItem[];
  attemptId: string;
  quizId: string;
  classId?: string;
  onRetakeSameQuiz: () => void; // ✅ NEW: True retake handler
  isRetaking?: boolean; // ✅ NEW: Loading state
}

export function FollowUpFeedback({ breakdown, attemptId, quizId, classId, onRetakeSameQuiz, isRetaking }: FollowUpFeedbackProps) {
  const navigate = useNavigate();

  // Filter weak questions (incorrect answers only)
  const weakQuestions = breakdown.filter((item: BreakdownItem) => !item.correct);

  // If perfect score, show encouragement instead
  if (weakQuestions.length === 0) {
    return (
      <div className="surface bdr radius p-6 mt-6">
        <h2 className="text-lg font-semibold mb-3">Perfect Score!</h2>
        <p className="text-muted mb-4">
          You got everything right! Retake the same quiz to reinforce your mastery, or generate a fresh quiz from the same notes.
        </p>
        <div className="flex gap-3">
          {/* ✅ Safe - Retake same quiz button */}
          <button
            className="btn flex-1"
            disabled={isRetaking}
            onClick={() => {
              track("retake_same_quiz_clicked", {
                context: "perfect_score",
                attempt_id: attemptId,
                quiz_id: quizId
              });
              onRetakeSameQuiz();
            }}
          >
            {isRetaking ? "Starting Quiz..." : "Retake This Quiz"}
          </button>
          {/* ✅ Safe - Generate new quiz from same notes */}
          <button
            className="btn flex-1"
            onClick={() => {
              track("generate_from_same_notes_clicked", {
                context: "perfect_score",
                attempt_id: attemptId,
                quiz_id: quizId
              });
              navigate(`/tools/generate?retake=${quizId}`);
            }}
          >
            Generate New Quiz
          </button>
          {/* ✅ Safe - Start fresh */}
          <button
            className="btn btn-ghost flex-1"
            onClick={() => {
              track("create_new_quiz_clicked", {
                context: "perfect_score",
                attempt_id: attemptId
              });
              navigate("/tools/generate");
            }}
          >
            Start Fresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="surface bdr radius p-6 mt-6">
      <h2 className="text-lg font-semibold mb-3">What to Focus On Next</h2>
      <p className="text-muted mb-4">
        {weakQuestions.length === 1
          ? "You missed 1 question. You can retake the same quiz to check your improvement, or generate a fresh quiz from the same notes."
          : `You missed ${weakQuestions.length} questions. You can retake the same quiz to check your improvement, or generate a fresh quiz from the same notes.`}
      </p>

      {/* Weak questions list */}
      <div className="space-y-4 mb-6">
        {weakQuestions.map((item: BreakdownItem, idx: number) => (
          <div key={item.id} className="p-4 bg-accent/5 rounded">
            <div className="font-semibold mb-2 text-sm">
              Question {breakdown.findIndex((b: BreakdownItem) => b.id === item.id) + 1}
            </div>
            <div className="text-sm mb-2 text-muted">{item.prompt}</div>

            {item.improvement && (
              <div className="text-sm">
                <span className="font-medium">💡 Tip: </span>
                <span>{item.improvement}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="flex gap-3">
        {/* ✅ Safe - Retake same quiz button */}
        <button
          className="btn flex-1"
          disabled={isRetaking}
          onClick={() => {
            track("retake_same_quiz_clicked", {
              attempt_id: attemptId,
              quiz_id: quizId
            });
            onRetakeSameQuiz();
          }}
        >
          {isRetaking ? "Starting Quiz..." : "Retake This Quiz"}
        </button>
        {/* ✅ Safe - Generate new quiz from same notes */}
        <button
          className="btn flex-1"
          onClick={() => {
            track("generate_from_same_notes_clicked", {
              attempt_id: attemptId,
              quiz_id: quizId
            });
            navigate(`/tools/generate?retake=${quizId}`);
          }}
        >
          Generate New Quiz
        </button>
        {/* ✅ Safe - Start fresh */}
        <button
          className="btn btn-ghost flex-1"
          onClick={() => {
            track("create_new_quiz_clicked", {
              context: "follow_up_feedback",
              attempt_id: attemptId
            });
            navigate("/tools/generate");
          }}
        >
          Start Fresh
        </button>
      </div>
    </div>
  );
}
