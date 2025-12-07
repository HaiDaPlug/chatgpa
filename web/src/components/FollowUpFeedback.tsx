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
}

export function FollowUpFeedback({ breakdown, attemptId, quizId, classId }: FollowUpFeedbackProps) {
  const navigate = useNavigate();

  // Filter weak questions (incorrect answers only)
  const weakQuestions = breakdown.filter((item: BreakdownItem) => !item.correct);

  // If perfect score, show encouragement instead
  if (weakQuestions.length === 0) {
    return (
      <div className="surface bdr radius p-6 mt-6">
        <h2 className="text-lg font-semibold mb-3">Perfect Score!</h2>
        <p className="text-muted mb-4">
          You got everything right. Ready for the next challenge?
        </p>
        <div className="flex gap-3">
          <button
            className="btn flex-1"
            onClick={() => {
              track("create_new_quiz_clicked", {
                context: "follow_up_feedback",
                attempt_id: attemptId
              });
              navigate("/tools/generate");
            }}
          >
            Create New Quiz
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
          ? "You missed 1 question. Here's how to improve:"
          : `You missed ${weakQuestions.length} questions. Here's how to improve:`}
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
        <button
          className="btn flex-1"
          onClick={() => {
            track("retake_quiz_clicked", {
              attempt_id: attemptId,
              quiz_id: quizId
            });
            navigate(`/tools/generate?retake=${quizId}`);
          }}
        >
          Retake This Quiz
        </button>
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
          Create New Quiz
        </button>
      </div>
    </div>
  );
}
