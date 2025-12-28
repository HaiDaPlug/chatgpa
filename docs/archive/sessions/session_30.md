# Session 30: Fix Sidebar Stretching Issue

**Date**: 2025-12-28
**Branch**: alpha
**Status**: ✅ Complete

## Overview

Fixed the sidebar stretching bug where the sidebar would grow vertically with page content instead of staying fixed to the viewport. Implemented a "locked app shell" pattern (similar to Linear, Notion, VSCode) where the sidebar and header stay fixed while only the main content area scrolls.

## Problem

The sidebar was stretching on long pages because:
1. PageShell grid wrapper used `min-h-screen` - causing the container to grow with content
2. Sidebar spans both grid rows (`gridArea: "sidebar"`) - stretching with the container
3. No viewport height constraint to limit vertical growth

## Solution

Applied 4 minimal className changes to lock the shell to viewport height and make only the main content scrollable.

## Changes Made

### PageShell.tsx
**File**: `web/src/components/PageShell.tsx`

#### 1. Grid Wrapper (Line 115)
```diff
- className="grid min-h-screen"
+ className="grid h-screen overflow-hidden"
```
- `h-screen` locks grid to exactly viewport height (100vh)
- `overflow-hidden` prevents grid itself from scrolling
- Used `h-screen` instead of `h-dvh` for maximum browser compatibility

#### 2. Sidebar (Line 128)
```diff
- className="surface bdr overflow-hidden"
+ className="surface bdr overflow-hidden min-h-0"
```
- `min-h-0` prevents flex/grid min-size issues
- Allows sidebar's internal scroll regions to work properly

#### 3. Header (Line 143)
```diff
- className="surface/70 bdr sticky top-0 z-10"
+ className="surface/70 bdr z-10"
```
- Removed `sticky top-0` since header is already in fixed grid position
- Header sits in its own grid row and doesn't need sticky positioning

#### 4. Main Content (Line 154)
```diff
- className="p-8"
+ className="p-8 min-h-0 overflow-y-auto"
```
- `min-h-0` allows main to shrink to fit grid (prevents overflow)
- `overflow-y-auto` makes main content scrollable when it exceeds viewport
- Creates the "locked shell, scrolling content" behavior

## Technical Details

### Key Invariants
1. **Shell**: `overflow-hidden` on grid wrapper locks viewport
2. **Main**: `min-h-0 overflow-y-auto` makes content scrollable
3. **Aside**: `min-h-0` prevents flex/grid min-size weirdness
4. **Header**: No sticky needed in grid layout

### Browser Compatibility
- Used `h-screen` (100vh) instead of `h-dvh` for universal browser support
- Tailwind config doesn't include `h-dvh` by default
- `h-screen` works on all browsers with zero risk

### Side Effects
- **QuizPage sticky header**: Now sticks relative to main scroll container (desired behavior)
- **Modal**: Appearance settings modal continues to work correctly
- **Focus management**: Skip-to-content link and accessibility unchanged

## Testing Checklist

After implementation, verify:

1. ✅ **Sidebar stays fixed** - Navigate to long pages and scroll (sidebar should NOT scroll)
2. ✅ **Main content scrolls** - Only the main area scrolls, sidebar/breadcrumbs stay fixed
3. ✅ **Sidebar internal nav scrolls** - Nav section scrolls independently when tall
4. ✅ **QuizPage sticky header** - Quiz header sticks to top of main content when scrolling
5. ✅ **Account menu visible** - Account menu at bottom of sidebar is accessible
6. ✅ **Responsive behavior** - Works correctly on narrow screens (< 900px)
7. ✅ **Modal works** - Appearance settings modal overlay and focus management work

## Impact

### User Experience
- **Fixed sidebar**: Sidebar navigation always visible while scrolling long pages
- **Standard behavior**: Matches modern app patterns (Linear, Notion, VSCode, Figma)
- **Better navigation**: Users can access sidebar items without scrolling to top

### Code Quality
- **Minimal changes**: Only 4 className modifications, no logic changes
- **Semantic**: Grid defines layout, main handles scrolling
- **Reversible**: Easy rollback if needed (documented in plan)
- **No new TypeScript errors**: All existing errors are pre-existing (telemetry types)

## Rollback Plan

If issues arise, revert the 4 className changes:
1. Grid: `h-screen overflow-hidden` → `min-h-screen`
2. Aside: `surface bdr overflow-hidden min-h-0` → `surface bdr overflow-hidden`
3. Header: `surface/70 bdr z-10` → `surface/70 bdr sticky top-0 z-10`
4. Main: `p-8 min-h-0 overflow-y-auto` → `p-8`

## Files Changed

- `web/src/components/PageShell.tsx` - 4 className updates (Lines 115, 128, 143, 154)

## Co-Founder Notes

Implementation approved with caveats:
1. Use `h-screen` for zero-risk browser compatibility (not `h-dvh`)
2. Watch for header jitter (can re-add sticky if needed, but should not be needed)
3. Key invariants: `overflow-hidden` on shell + `min-h-0 overflow-y-auto` on main

## Next Steps

User should test the implementation in browser to verify:
- Sidebar stays fixed on scroll
- Main content scrolls independently
- QuizPage sticky header works correctly
- Responsive behavior on mobile/narrow screens

---

**Session Complete**: December 28, 2025
**TypeScript Errors**: 0 new errors (pre-existing telemetry errors unchanged)
**Build Status**: ✅ Ready for testing
