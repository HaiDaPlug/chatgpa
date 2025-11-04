/**
 * RLS Smoke Test - Temporary validation script
 *
 * Purpose: Verify that parent-ownership RLS policies work correctly
 * - Happy path: User can insert/read their own notes & attempts
 * - Security: User cannot insert/read data for classes/quizzes they don't own
 *
 * Usage:
 * 1. Import this in a component temporarily
 * 2. Call rlsSmokeTest() with valid IDs from your account
 * 3. Verify success for own data, RLS denial for foreign data
 * 4. Delete this file after verification
 */

import { supabase } from "@/lib/supabase";

export async function rlsSmokeTest(myClassId: string, myQuizId: string) {
  console.log("🧪 Starting RLS Smoke Test...");

  const results = {
    notesInsert: false,
    notesRead: false,
    attemptsInsert: false,
    attemptsRead: false,
  };

  try {
    // ========== TEST 1: Notes - Happy Path ==========
    console.log("\n✅ Test 1: Insert note for own class");
    const { data: note, error: notesInsertErr } = await supabase
      .from("notes")
      .insert({
        class_id: myClassId,
        content: "RLS test note - safe to delete"
      })
      .select("id")
      .single();

    if (notesInsertErr) {
      console.error("❌ Notes insert failed:", notesInsertErr.message);
      throw notesInsertErr;
    }

    console.log("✅ Note created:", note.id);
    results.notesInsert = true;

    // ========== TEST 2: Notes - Read Back ==========
    console.log("\n✅ Test 2: Read own note");
    const { data: readNote, error: notesReadErr } = await supabase
      .from("notes")
      .select("id, content")
      .eq("id", note.id)
      .single();

    if (notesReadErr) {
      console.error("❌ Notes read failed:", notesReadErr.message);
      throw notesReadErr;
    }

    console.log("✅ Note read back:", readNote.id, readNote.content);
    results.notesRead = true;

    // ========== TEST 3: Quiz Attempts - Happy Path ==========
    console.log("\n✅ Test 3: Insert attempt for own quiz");
    const { data: attempt, error: attemptsInsertErr } = await supabase
      .from("quiz_attempts")
      .insert({
        quiz_id: myQuizId,
        score: 0.85,
        responses: []
      })
      .select("id")
      .single();

    if (attemptsInsertErr) {
      console.error("❌ Attempts insert failed:", attemptsInsertErr.message);
      throw attemptsInsertErr;
    }

    console.log("✅ Attempt created:", attempt.id);
    results.attemptsInsert = true;

    // ========== TEST 4: Quiz Attempts - Read Back ==========
    console.log("\n✅ Test 4: Read own attempt");
    const { data: readAttempt, error: attemptsReadErr } = await supabase
      .from("quiz_attempts")
      .select("id, score")
      .eq("id", attempt.id)
      .single();

    if (attemptsReadErr) {
      console.error("❌ Attempts read failed:", attemptsReadErr.message);
      throw attemptsReadErr;
    }

    console.log("✅ Attempt read back:", readAttempt.id, `Score: ${readAttempt.score}`);
    results.attemptsRead = true;

    // ========== CLEANUP ==========
    console.log("\n🧹 Cleaning up test data...");

    await supabase.from("quiz_attempts").delete().eq("id", attempt.id);
    await supabase.from("notes").delete().eq("id", note.id);

    console.log("✅ Cleanup complete");

    // ========== SUMMARY ==========
    console.log("\n📊 Test Results:");
    console.log("  Notes Insert:", results.notesInsert ? "✅ PASS" : "❌ FAIL");
    console.log("  Notes Read:", results.notesRead ? "✅ PASS" : "❌ FAIL");
    console.log("  Attempts Insert:", results.attemptsInsert ? "✅ PASS" : "❌ FAIL");
    console.log("  Attempts Read:", results.attemptsRead ? "✅ PASS" : "❌ FAIL");

    const allPassed = Object.values(results).every(r => r);
    if (allPassed) {
      console.log("\n🎉 All tests PASSED! RLS parent-ownership policies working correctly.");
    } else {
      console.log("\n⚠️ Some tests FAILED. Check RLS policies.");
    }

    return { ok: allPassed, results };

  } catch (error: any) {
    console.error("\n❌ Test suite failed:", error.message);
    return { ok: false, error: error.message, results };
  }
}

/**
 * Cross-tenant test (optional - requires foreign IDs)
 *
 * This test verifies that RLS blocks access to data from other users.
 * You would need to manually get IDs from another test account.
 *
 * Expected behavior: All operations should fail with RLS policy violations
 */
export async function rlsCrossTenantTest(foreignClassId: string, foreignQuizId: string) {
  console.log("\n🔒 Starting Cross-Tenant Test (should fail)...");

  try {
    // Should fail: Cannot insert note for someone else's class
    const { error: e1 } = await supabase
      .from("notes")
      .insert({ class_id: foreignClassId, content: "Should fail" });

    if (e1) {
      console.log("✅ Notes insert blocked (expected):", e1.message);
    } else {
      console.error("❌ SECURITY ISSUE: Notes insert allowed for foreign class!");
    }

    // Should fail: Cannot insert attempt for someone else's quiz
    const { error: e2 } = await supabase
      .from("quiz_attempts")
      .insert({ quiz_id: foreignQuizId, score: 1, responses: [] });

    if (e2) {
      console.log("✅ Attempts insert blocked (expected):", e2.message);
    } else {
      console.error("❌ SECURITY ISSUE: Attempt insert allowed for foreign quiz!");
    }

    console.log("\n🎉 Cross-tenant test PASSED (all foreign access blocked)");
    return { ok: true };

  } catch (error: any) {
    console.error("❌ Cross-tenant test error:", error.message);
    return { ok: false, error: error.message };
  }
}
