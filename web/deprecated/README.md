# Deprecated Files

**Date Moved**: 2025-11-11 (Session 14 - Section 7 TypeScript Cleanup)

**Purpose**: Files in this folder have TypeScript errors and are not actively used in the application. They have been moved here to achieve zero TS errors in active codebase while preserving historical code for reference.

## Status: Under Observation (72h)

**Monitoring Period**: 72 hours from 2025-11-11
**Delete After**: 2025-11-14 (if telemetry confirms zero hits)

## Files Moved

### Components
- `components/CreateClassDialog.tsx` - Incorrectly contained Dashboard code instead of dialog component. Actual functionality exists in Dashboard page.

### Layouts
- `layouts/AppLayout.tsx` - Imports from non-existent `@/lib/authGuard`. Replaced by other layout patterns.

### Pages
- `pages/Landing.old.tsx` - Old landing page with deprecated imports (signInWithGoogle, signOut, getUserId, TierCard, ChatPreview).

## Errors Fixed by Moving
1. ✅ Module '"@/components/CreateClassDialog"' has no exported member 'CreateClassDialog'
2. ✅ Cannot find module '@/lib/authGuard'
3. ✅ Module '"@/lib/supabase"' has no exported member 'signInWithGoogle'
4. ✅ Cannot find module '@/components/TierCard'
5. ✅ Cannot find module '@/components/ChatPreview'

## Already Deprecated
The following files were already in `disabled_api/` and also excluded:
- `disabled_api/stripe/stripe-webhook.ts` - Old Stripe webhook implementation (superseded by `/api/stripe-webhook`)

## Deletion Checklist

Before deleting on 2025-11-14, verify:
- [ ] Check telemetry for legacy route hits (should be zero)
- [ ] Confirm no imports from deprecated files in active code
- [ ] Verify tsc --noEmit returns 0 errors without these files
- [ ] Document any recovered patterns/code if needed

## Recovery

If any file is needed:
1. Move back to original location
2. Fix TypeScript errors
3. Update imports in dependent files
4. Remove from this deprecated folder
5. Update tsconfig.json exclude list

---

**Note**: These files are excluded from TypeScript compilation via `tsconfig.json` exclude list.
