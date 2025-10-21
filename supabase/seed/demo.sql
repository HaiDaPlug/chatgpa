-- ============================================
-- ChatGPA Demo Seed Data
-- Optional: Use this to populate demo class and quiz for testing
-- ============================================

-- NOTE: Replace 'YOUR_USER_ID' with an actual user ID from auth.users
-- You can get this by signing up and checking the auth.users table

begin;

-- Demo user ID (replace with real UUID after signup)
-- Example: select id from auth.users where email = 'demo@example.com';
-- \set demo_user_id 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

-- Demo Class: Biology 101
insert into classes (id, user_id, name, description)
values (
  'demo-class-001'::uuid,
  'YOUR_USER_ID'::uuid,  -- Replace with real user_id
  'Biology 101',
  'Introduction to Cell Biology and Genetics'
) on conflict (id) do nothing;

-- Demo Notes: Mitosis Chapter
insert into notes (id, class_id, user_id, title, content, file_type)
values (
  'demo-note-001'::uuid,
  'demo-class-001'::uuid,
  'YOUR_USER_ID'::uuid,  -- Replace with real user_id
  'Chapter 5: Cell Division - Mitosis',
  $content$
# Mitosis: Cell Division

## Overview
Mitosis is the process by which a eukaryotic cell divides to produce two identical daughter cells. Each daughter cell receives an exact copy of the parent cell's genetic material.

## Phases of Mitosis

### 1. Prophase
- Chromatin condenses into visible chromosomes
- Each chromosome consists of two sister chromatids joined at the centromere
- Nuclear envelope begins to break down
- Spindle apparatus begins to form from centrosomes
- Centrioles move to opposite poles of the cell

### 2. Metaphase
- Chromosomes align at the cell's equator (metaphase plate)
- Spindle fibers attach to kinetochores at the centromeres
- This is the checkpoint where the cell ensures all chromosomes are properly attached

### 3. Anaphase
- Sister chromatids separate and move to opposite poles
- Spindle fibers shorten, pulling chromatids apart
- Cell elongates
- This ensures each daughter cell will receive identical genetic material

### 4. Telophase
- Chromosomes begin to decondense
- Nuclear envelopes reform around each set of chromosomes
- Spindle apparatus disassembles
- Two distinct nuclei form

## Cytokinesis
- Division of the cytoplasm
- In animal cells: cleavage furrow forms
- In plant cells: cell plate forms
- Results in two separate daughter cells

## Key Terms
- **Chromatin**: DNA-protein complex
- **Chromatid**: One half of a duplicated chromosome
- **Centromere**: Region where sister chromatids are joined
- **Spindle apparatus**: Microtubule structure that separates chromosomes
- **Kinetochore**: Protein structure on centromere where spindle fibers attach

## Importance of Mitosis
1. Growth and development
2. Tissue repair and regeneration
3. Asexual reproduction in some organisms
4. Maintains chromosome number across generations

## Common Misconceptions
- Mitosis ≠ Meiosis (meiosis produces gametes with half the chromosomes)
- DNA replication occurs BEFORE mitosis in S phase of interphase
- Cytokinesis is separate from mitosis but occurs concurrently with telophase
  $content$,
  'text'
) on conflict (id) do nothing;

-- Demo Quiz: Mitosis Quiz
insert into quizzes (id, class_id, user_id, note_id, title, questions)
values (
  'demo-quiz-001'::uuid,
  'demo-class-001'::uuid,
  'YOUR_USER_ID'::uuid,  -- Replace with real user_id
  'demo-note-001'::uuid,
  'Mitosis Understanding Check',
  '[
    {
      "id": "q1",
      "question": "What is the main purpose of mitosis?",
      "type": "multiple_choice",
      "options": [
        "To produce gametes for sexual reproduction",
        "To produce two identical daughter cells",
        "To reduce chromosome number by half",
        "To create genetic variation"
      ],
      "correct_answer": "To produce two identical daughter cells"
    },
    {
      "id": "q2",
      "question": "In which phase do chromosomes align at the cell equator?",
      "type": "multiple_choice",
      "options": [
        "Prophase",
        "Metaphase",
        "Anaphase",
        "Telophase"
      ],
      "correct_answer": "Metaphase"
    },
    {
      "id": "q3",
      "question": "What happens during anaphase?",
      "type": "short_answer",
      "correct_answer": "Sister chromatids separate and move to opposite poles of the cell"
    },
    {
      "id": "q4",
      "question": "What is the difference between mitosis and meiosis?",
      "type": "short_answer",
      "correct_answer": "Mitosis produces two identical diploid cells; meiosis produces four haploid gametes with genetic variation"
    },
    {
      "id": "q5",
      "question": "True or False: DNA replication occurs during mitosis.",
      "type": "true_false",
      "correct_answer": "False"
    }
  ]'::jsonb
) on conflict (id) do nothing;

-- Demo Quiz Attempt (with adaptive grading example)
insert into quiz_attempts (id, quiz_id, user_id, answers, grading_results, score)
values (
  'demo-attempt-001'::uuid,
  'demo-quiz-001'::uuid,
  'YOUR_USER_ID'::uuid,  -- Replace with real user_id
  '[
    {
      "question_id": "q1",
      "user_answer": "To produce two identical daughter cells"
    },
    {
      "question_id": "q2",
      "user_answer": "Metaphase"
    },
    {
      "question_id": "q3",
      "user_answer": "The chromatids split apart and go to different sides"
    },
    {
      "question_id": "q4",
      "user_answer": "Mitosis makes regular cells, meiosis makes sex cells"
    },
    {
      "question_id": "q5",
      "user_answer": "True"
    }
  ]'::jsonb,
  '[
    {
      "question_id": "q1",
      "correct": true,
      "concept_understood": "Perfect understanding of mitosis purpose",
      "terminology_precision": "Excellent use of technical terminology",
      "feedback": "✅ Correct! You nailed this one."
    },
    {
      "question_id": "q2",
      "correct": true,
      "concept_understood": "Correct identification of metaphase",
      "terminology_precision": "Precise terminology",
      "feedback": "✅ Correct! Metaphase is when chromosomes line up at the equator."
    },
    {
      "question_id": "q3",
      "correct": true,
      "concept_understood": "You understand what happens in anaphase",
      "terminology_precision": "Good concept, could use more precise terms",
      "feedback": "✅ Concept correct: You understand that chromatids separate and move apart.\n⚠️ Terminology precision: The technical term is ''sister chromatids'' and they move to ''opposite poles''.\n💡 What to remember: You''ve got the WHAT (separation and movement), tighten the terminology (sister chromatids → opposite poles)."
    },
    {
      "question_id": "q4",
      "correct": true,
      "concept_understood": "You grasp the basic difference",
      "terminology_precision": "Informal but functionally correct",
      "feedback": "✅ Concept correct: You understand mitosis produces body cells and meiosis produces gametes.\n⚠️ Terminology precision: ''Regular cells'' → ''diploid cells'' (same chromosome number); ''sex cells'' → ''haploid gametes'' (half the chromosomes).\n💡 What to remember: Your understanding is solid! Now add the technical vocabulary (diploid vs haploid) for exam precision."
    },
    {
      "question_id": "q5",
      "correct": false,
      "concept_understood": "Common misconception",
      "terminology_precision": "N/A",
      "feedback": "❌ Incorrect: DNA replication happens BEFORE mitosis during the S phase of interphase, not during mitosis itself.\n💡 Remember: Mitosis divides already-duplicated chromosomes. The duplication (replication) happened earlier in the cell cycle."
    }
  ]'::jsonb,
  80.00
) on conflict (id) do nothing;

commit;

-- ============================================
-- Usage Instructions:
-- 1. Sign up for a ChatGPA account
-- 2. Get your user_id: SELECT id FROM auth.users WHERE email = 'your@email.com';
-- 3. Replace all instances of 'YOUR_USER_ID' with your actual UUID
-- 4. Run this SQL in Supabase SQL Editor
-- 5. You'll see a demo Biology 101 class with a mitosis quiz!
-- ============================================
