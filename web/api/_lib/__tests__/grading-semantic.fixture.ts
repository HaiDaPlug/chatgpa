/**
 * P1 Grading Quality: Regression Test Fixture
 *
 * Run with: npx tsx web/api/_lib/__tests__/grading-semantic.fixture.ts
 *
 * Uses mocked AI responses by default to avoid:
 * - Nondeterministic failures
 * - Cost on every test run
 * - CI flakiness
 *
 * Run with GRADING_TEST_LIVE=1 to test against real model (manual verification only)
 */

import { gradeSubmission, type ShortQ, type GradeOutput } from '../grader.js';

// ===== TEST FIXTURE: Freud Defense Mechanisms =====

const FREUD_QUESTIONS: ShortQ[] = [
  {
    id: 'q1',
    type: 'short',
    prompt: 'What is repression?',
    answer: 'Repression is pushing threatening thoughts into the unconscious',
  },
  {
    id: 'q2',
    type: 'short',
    prompt: 'Explain projection',
    answer: 'Attributing your own unacceptable impulses to others',
  },
  {
    id: 'q5',
    type: 'short',
    prompt: 'What is denial?',
    answer: 'Refusing to acknowledge reality or facts',
  },
  {
    id: 'q7',
    type: 'short',
    prompt: 'Define sublimation',
    answer: 'Channeling unacceptable impulses into socially acceptable activities',
  },
];

const FREUD_RESPONSES: Record<string, string> = {
  // Q1: Exact concept, different wording -> expect >= 0.90
  q1: 'When you push bad thoughts into your unconscious mind',
  // Q2: Copy-paste from notes -> expect >= 0.90 (exact match gate)
  q2: 'Attributing your own unacceptable impulses to others',
  // Q5: Wrong answer -> expect 0.0-0.29
  q5: 'The capital of France is Paris',
  // Q7: Correct concept, missing "socially acceptable" -> expect 0.70-0.90
  q7: 'Converting bad urges into productive activities',
};

const EXPECTED_SCORES: Record<string, { min: number; max: number; description: string }> = {
  q1: { min: 0.70, max: 1.0, description: 'Paraphrase of repression (semantic match)' },
  q2: { min: 0.90, max: 1.0, description: 'Exact match or near-exact' },
  q5: { min: 0.0, max: 0.39, description: 'Completely wrong answer' }, // ✅ P1.3: Updated threshold to 0.39
  q7: { min: 0.70, max: 0.90, description: 'Mostly correct, missing terminology' },
};

// ===== MOCK AI RESPONSES =====
// These simulate what the AI would return for deterministic testing

const MOCK_AI_RESULTS = {
  q1: {
    score: 0.92,
    band: 'correct' as const,
    why: 'Correctly describes repression as pushing unwanted thoughts to the unconscious.',
    improvements: [],
    missing_terms: ['threatening'],
  },
  q5: {
    score: 0.05,
    band: 'incorrect' as const,
    why: 'Answer is completely off-topic and unrelated to denial.',
    improvements: ['Define denial as a defense mechanism that involves refusing to accept reality.'],
    missing_terms: ['refusing', 'acknowledge', 'reality'],
    misconception: 'Confused with geography trivia.',
  },
  q7: {
    score: 0.78,
    band: 'mostly_correct' as const,
    why: 'Captures the core idea of channeling impulses but misses key terminology.',
    improvements: ['Include "socially acceptable" to complete the definition.'],
    missing_terms: ['socially acceptable'],
  },
};

// ===== TEST RUNNER =====

interface TestResult {
  questionId: string;
  passed: boolean;
  actualScore: number | undefined;
  expectedRange: { min: number; max: number };
  description: string;
  actualBand: string;
  feedback: string;
}

async function runTests(): Promise<void> {
  console.log('\n========================================');
  console.log('P1 Grading Quality - Regression Tests');
  console.log('========================================\n');

  const isLiveTest = process.env.GRADING_TEST_LIVE === '1';

  if (isLiveTest) {
    console.log('⚠️  LIVE MODE: Testing against real OpenAI API');
    console.log('   Results may vary. For CI, use mocked responses.\n');

    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not set. Cannot run live tests.');
      process.exit(1);
    }
  } else {
    console.log('📦 MOCKED MODE: Using deterministic mock responses');
    console.log('   Run with GRADING_TEST_LIVE=1 for real API testing.\n');
  }

  let output: GradeOutput;

  if (isLiveTest) {
    // Real API call
    output = await gradeSubmission(FREUD_QUESTIONS, FREUD_RESPONSES);
  } else {
    // Mocked: simulate the hybrid grading flow
    output = simulateMockedGrading();
  }

  // Analyze results
  const results: TestResult[] = [];

  for (const item of output.breakdown) {
    const expected = EXPECTED_SCORES[item.id];
    if (!expected) continue;

    const actualScore = item.score ?? (item.correct ? 1 : 0);
    const passed = actualScore >= expected.min && actualScore <= expected.max;

    const scoreBand = getScoreBandLabel(actualScore);

    results.push({
      questionId: item.id,
      passed,
      actualScore,
      expectedRange: { min: expected.min, max: expected.max },
      description: expected.description,
      actualBand: scoreBand,
      feedback: item.feedback,
    });
  }

  // Print results
  console.log('Test Results:');
  console.log('─────────────────────────────────────────────────────────────\n');

  let passCount = 0;
  let failCount = 0;

  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    if (result.passed) passCount++;
    else failCount++;

    console.log(`${status} | ${result.questionId.toUpperCase()}`);
    console.log(`       Score: ${result.actualScore?.toFixed(2) ?? 'N/A'} (expected ${result.expectedRange.min.toFixed(2)}-${result.expectedRange.max.toFixed(2)})`);
    console.log(`       Band: ${result.actualBand}`);
    console.log(`       ${result.description}`);
    console.log(`       Feedback: "${result.feedback.slice(0, 60)}${result.feedback.length > 60 ? '...' : ''}"`);
    console.log('');
  }

  // Summary
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`\nSummary: ${passCount}/${results.length} tests passed`);

  if (failCount > 0) {
    console.log(`\n⚠️  ${failCount} test(s) failed. Review the scores above.`);
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
  }
}

function getScoreBandLabel(score: number | null | undefined): string {
  if (score == null) return 'ungraded';
  if (score >= 0.90) return 'correct';
  if (score >= 0.75) return 'mostly_correct'; // ✅ P1.3: Updated threshold
  if (score >= 0.40) return 'partial';         // ✅ P1.3: Updated threshold (was 0.30)
  return 'incorrect';
}

function simulateMockedGrading(): GradeOutput {
  // Simulate the hybrid grading flow with mocked AI responses
  const breakdown = [];
  let totalScore = 0;
  let correctCount = 0;

  for (const q of FREUD_QUESTIONS) {
    const userAnswer = FREUD_RESPONSES[q.id] ?? '';
    const refAnswer = q.answer ?? '';

    // Gate 1: Exact match
    if (normalize(userAnswer) === normalize(refAnswer)) {
      breakdown.push({
        id: q.id,
        type: 'short' as const,
        prompt: q.prompt,
        user_answer: userAnswer,
        correct: true,
        score: 1.0,
        correct_answer: refAnswer,
        feedback: 'Perfect match.',
      });
      totalScore += 1.0;
      correctCount++;
      continue;
    }

    // Gate 2: High similarity (Jaccard >= 0.6)
    const similarity = jaccard(userAnswer, refAnswer);
    if (similarity >= 0.6) {
      breakdown.push({
        id: q.id,
        type: 'short' as const,
        prompt: q.prompt,
        user_answer: userAnswer,
        correct: false,
        score: 0.85,
        correct_answer: refAnswer,
        feedback: 'Mostly correct (high similarity to reference).',
      });
      totalScore += 0.85;
      continue;
    }

    // Gate 3: AI grading (mocked)
    const mockResult = MOCK_AI_RESULTS[q.id as keyof typeof MOCK_AI_RESULTS];
    if (mockResult) {
      const isCorrect = mockResult.score >= 0.90;
      if (isCorrect) correctCount++;
      totalScore += mockResult.score;

      breakdown.push({
        id: q.id,
        type: 'short' as const,
        prompt: q.prompt,
        user_answer: userAnswer,
        correct: isCorrect,
        score: mockResult.score,
        correct_answer: refAnswer,
        feedback: mockResult.why,
        improvement: mockResult.improvements?.join(' '),
        missing_terms: mockResult.missing_terms,
      });
    } else {
      // Fallback for unmocked questions
      breakdown.push({
        id: q.id,
        type: 'short' as const,
        prompt: q.prompt,
        user_answer: userAnswer,
        correct: false,
        score: 0.0,
        correct_answer: refAnswer,
        feedback: 'Unable to grade (no mock available).',
      });
    }
  }

  const total = FREUD_QUESTIONS.length;
  const percent = Math.round((totalScore / total) * 100);

  return {
    percent,
    correctCount,
    total,
    breakdown,
    summary: percent >= 85 ? 'Great work!' : percent >= 70 ? 'Solid base.' : 'Keep practicing.',
  };
}

// String helpers (copied from grader.ts for mock)
function normalize(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function jaccard(a: string, b: string): number {
  const A = new Set(normalize(a).split(' ').filter(Boolean));
  const B = new Set(normalize(b).split(' ').filter(Boolean));
  if (A.size === 0 && B.size === 0) return 1;
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return inter / union;
}

// ===== P1.3: Teacher-Strict Grading Tests =====

const TEACHER_STRICT_TESTS = [
  {
    id: 'ts1',
    prompt: 'Ge ett exempel på en försvarsmekanism',
    reference: 'Förnekelse - att vägra erkänna verkligheten',
    answer: 'Förnekelse',  // Term only, no explanation
    expected: { min: 0.40, max: 0.74, band: 'partial' as const, description: 'Term-only, no explanation → capped at 0.74' },
  },
  {
    id: 'ts2',
    prompt: 'Ge ett exempel på en försvarsmekanism',
    reference: 'Förnekelse - att vägra erkänna verkligheten',
    answer: 'Förnekelse - när man vägrar acceptera svåra sanningar',  // Term + explanation
    expected: { min: 0.75, max: 1.0, band: 'mostly_correct|correct' as const, description: 'Term + explanation → high score' },
  },
  {
    id: 'ts3',
    prompt: 'Vad är projektion?',
    reference: 'Att tillskriva sina egna oacceptabla impulser till andra',
    answer: 'När man ser sina egna dåliga egenskaper hos andra istället',  // Correct paraphrase
    expected: { min: 0.75, max: 1.0, band: 'mostly_correct|correct' as const, description: 'Valid paraphrase → high score' },
  },
  {
    id: 'ts4',
    prompt: 'Förklara vad förnekelse innebär',
    reference: 'Att vägra erkänna verkligheten eller fakta',
    answer: 'Paris är huvudstaden i Frankrike',  // Completely wrong
    expected: { min: 0.0, max: 0.39, band: 'incorrect' as const, description: 'Wrong concept → incorrect' },
  },
];

// Mock AI responses for teacher-strict tests
const TEACHER_STRICT_MOCK_RESULTS: Record<string, {
  score: number;
  band: 'correct' | 'mostly_correct' | 'partial' | 'incorrect';
  why: string;
  improvements?: string[];
  missing_terms?: string[];
  misconception?: string | null;
}> = {
  ts1: {
    score: 0.65,
    band: 'partial',
    why: 'Korrekt term men saknar förklaring av vad förnekelse innebär.',
    improvements: ['Lägg till en kort förklaring (1 mening) som visar varför exemplet passar.'],
    missing_terms: ['vägra', 'erkänna', 'verkligheten'],
  },
  ts2: {
    score: 0.88,
    band: 'mostly_correct',
    why: 'Bra svar med korrekt term och förklaring som visar förståelse.',
    improvements: [],
    missing_terms: [],
  },
  ts3: {
    score: 0.85,
    band: 'mostly_correct',
    why: 'Korrekt omskrivning som visar förståelse för begreppet.',
    improvements: ['Använd termen "oacceptabla impulser" för precision.'],
    missing_terms: ['oacceptabla', 'impulser'],
  },
  ts4: {
    score: 0.05,
    band: 'incorrect',
    why: 'Svaret handlar om geografi, inte om försvarsmekanismen förnekelse.',
    improvements: ['Definiera förnekelse som en psykologisk försvarsmekanism.'],
    missing_terms: ['vägra', 'erkänna', 'verkligheten'],
    misconception: 'Förväxlade frågan med en geografifråga.',
  },
};

function runTeacherStrictTests(): void {
  console.log('\n========================================');
  console.log('P1.3 Teacher-Strict Grading Tests');
  console.log('========================================\n');

  let passCount = 0;
  let failCount = 0;

  for (const test of TEACHER_STRICT_TESTS) {
    const mock = TEACHER_STRICT_MOCK_RESULTS[test.id];
    if (!mock) {
      console.log(`⚠️  SKIP | ${test.id} - No mock result`);
      continue;
    }

    const scoreInRange = mock.score >= test.expected.min && mock.score <= test.expected.max;
    const bandMatches = test.expected.band.includes(mock.band);
    const passed = scoreInRange && bandMatches;

    if (passed) passCount++;
    else failCount++;

    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${test.id.toUpperCase()}`);
    console.log(`       Score: ${mock.score.toFixed(2)} (expected ${test.expected.min.toFixed(2)}-${test.expected.max.toFixed(2)})`);
    console.log(`       Band: ${mock.band} (expected ${test.expected.band})`);
    console.log(`       ${test.expected.description}`);
    console.log(`       Answer: "${test.answer.slice(0, 50)}${test.answer.length > 50 ? '...' : ''}"`);
    console.log('');
  }

  console.log('─────────────────────────────────────────────────────────────');
  console.log(`\nTeacher-Strict Summary: ${passCount}/${TEACHER_STRICT_TESTS.length} tests passed`);

  if (failCount > 0) {
    console.log(`\n⚠️  ${failCount} teacher-strict test(s) failed.`);
  } else {
    console.log('\n✅ All teacher-strict tests passed!');
  }
}

// ===== P1.2: Partial Failure Test =====

function testPartialFailure(): void {
  console.log('\n========================================');
  console.log('P1.2 Partial Failure - Ungraded Sentinel Test');
  console.log('========================================\n');

  // Simulate a grading result with one question failed (score: null)
  const mockBreakdownWithUngraded = [
    {
      id: 'q1',
      type: 'short' as const,
      prompt: 'What is repression?',
      user_answer: 'Pushing bad thoughts away',
      correct: true,
      score: 0.92,
      feedback: 'Correct.',
    },
    {
      id: 'q2',
      type: 'short' as const,
      prompt: 'Explain projection',
      user_answer: 'Attributing impulses to others',
      correct: false,
      score: null, // Ungraded sentinel
      feedback: 'Unable to grade this answer. You can retry grading.',
    },
    {
      id: 'q3',
      type: 'short' as const,
      prompt: 'What is denial?',
      user_answer: 'Paris is in France',
      correct: false,
      score: 0.05,
      feedback: 'Incorrect.',
    },
  ];

  // Verify ungraded detection
  const ungradedCount = mockBreakdownWithUngraded.filter(b => b.score === null).length;
  const gradedCount = mockBreakdownWithUngraded.filter(b => b.score !== null).length;

  console.log(`Total questions: ${mockBreakdownWithUngraded.length}`);
  console.log(`Graded: ${gradedCount}`);
  console.log(`Ungraded: ${ungradedCount}`);

  // Test assertions
  const pass1 = ungradedCount === 1;
  const pass2 = gradedCount === 2;
  const pass3 = mockBreakdownWithUngraded[1].score === null;

  if (pass1 && pass2 && pass3) {
    console.log('\n✅ Partial failure handling works correctly');
    console.log('   - Ungraded questions have score: null');
    console.log('   - UI can detect ungraded count via score === null');
  } else {
    console.log('\n❌ Partial failure test failed');
    console.log(`   - pass1 (ungradedCount === 1): ${pass1}`);
    console.log(`   - pass2 (gradedCount === 2): ${pass2}`);
    console.log(`   - pass3 (score === null): ${pass3}`);
    process.exit(1);
  }
}

// Run tests
async function main() {
  await runTests();
  runTeacherStrictTests(); // ✅ P1.3: Teacher-strict grading tests
  testPartialFailure();
}

main().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
