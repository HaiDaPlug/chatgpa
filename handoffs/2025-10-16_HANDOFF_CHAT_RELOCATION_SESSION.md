# 🔄 Session Handoff: Chat Relocation V16

**Generated:** October 16, 2025
**Session Status:** Prompts 1-4 Complete | Ready for Prompt 5
**Branch:** `main`
**Last Commit:** Chat components + useLedger hook integrated

---

## 🎯 Quick Context

You are working on **Chat Relocation** for Carpool AI (V16 unified test mode).

### What We're Doing
Following a **9-prompt incremental build** to modernize the chat interface with:
- Modular React components
- Mock mode for development
- Dual balance tracking (useAccount + useLedger)
- Non-streaming chat API integration

### Progress
- ✅ **Prompts 1-4 Complete** (see details below)
- 🔜 **Prompts 5-9 Remaining** (awaiting user specification)

---

## ✅ What's Been Completed (Prompts 1-4)

### Prompt 1: Chat Page Shell ✅
**File:** `web/src/pages/Chat.tsx` (177 lines)

**What it does:**
- Sticky header with "Chat" title + test mode badge
- Right-aligned FuelMeter component
- Scrollable main area for messages
- Fixed footer with composer
- Handles `?new_purchase=1` query param → shows toast + refreshes balances

**Key hooks used:**
- `useAccount(userId)` - V15 hook, 5s polling, real Supabase data
- `useLedger()` - New hook, 20-30s polling, fallback stub data
- `useSearchParams()` - Query param handling

---

### Prompt 2: Modular Components ✅
**Files Created:**
1. `web/src/components/ChatBubble.tsx` (35 lines)
   - User: coral/orange bubble, right-aligned
   - Assistant: stone bubble, left-aligned
   - Optional warning chip below message

2. `web/src/components/MessageList.tsx` (48 lines)
   - Auto-scroll to latest message
   - Maps ChatBubble components
   - Shows "Thinking..." when loading

3. `web/src/components/ChatComposer.tsx` (80 lines)
   - Input field + Send button
   - Spinner animation during send
   - Enter to send, manages own state
   - Restores input on error

**Type Export:**
```tsx
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  warning?: string;
};
```

---

### Prompt 3: sendChat Helper ✅
**File:** `web/src/lib/sendChat.ts` (132 lines)

**What it does:**
- **Mock mode:** If `VITE_CHAT_MOCK=1`, returns canned response (800ms delay)
- **Real mode:** POST to `/api/chat` with 60s timeout
- **Error handling:** Normalizes all errors to `SendResult` type

**Usage in Chat.tsx:**
```tsx
const result = await sendChat(messages, userId);
if (result.ok) {
  // Show assistant reply
} else {
  // Show error bubble with result.error + result.detail
}
```

---

### Prompt 4: useLedger Hook ✅
**File:** `web/src/hooks/useLedger.ts` (143 lines)

**What it does:**
- Fetches balance from `/api/account` or falls back to stub (200k/356k)
- **Polls every 20-30s in test mode only** (random interval to prevent thundering herd)
- Provides `refresh()` for manual updates (e.g., after purchase)
- Provides `bump(amount)` for optimistic balance changes

**Console output in test mode:**
```
[useLedger] Starting polling every 24s
[useLedger] Polling for balance update...
[useLedger] Using stub data (API unavailable): { balance: 200000, tierCap: 356000 }
```

**Integration in Chat.tsx:**
- Shows balance in header (test mode only)
- Refreshes on `?new_purchase=1`

---

## 🗂️ Current File Structure

```
web/src/
├── components/
│   ├── ChatBubble.tsx       ✅ NEW (Prompt 2)
│   ├── ChatComposer.tsx     ✅ NEW (Prompt 2)
│   ├── MessageList.tsx      ✅ NEW (Prompt 2)
│   ├── FuelMeter.tsx        (Existing V15)
│   └── Chat.tsx             (Old component, unused by new page)
├── pages/
│   └── Chat.tsx             ✅ UPDATED (Prompts 1-4, 177 lines)
├── hooks/
│   ├── useAccount.ts        (Existing V15, 5s polling)
│   └── useLedger.ts         ✅ UPDATED (Prompt 4, 143 lines)
├── lib/
│   ├── sendChat.ts          ✅ NEW (Prompt 3, 132 lines)
│   └── supabase.ts          (Existing)
└── config/
    └── appMode.ts           (Existing V16, exports IS_TEST)
```

---

## 🔧 Environment Variables

**Required for testing:**
```env
# In web/.env.local
VITE_APP_MODE=test           # Enables test mode indicators + polling
VITE_CHAT_MOCK=1             # Optional: 1=mock responses, 0=real API

# Supabase
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

**How to toggle mock mode:**
- `VITE_CHAT_MOCK=1` → Returns canned responses (for UI dev without backend)
- `VITE_CHAT_MOCK=0` or unset → Calls real `/api/chat` endpoint

---

## 🧪 How to Test Current State

1. **Start dev server:**
   ```bash
   cd web && pnpm dev
   ```

2. **Navigate to:** `http://localhost:5173/chat`

3. **Expected behavior:**
   - ✅ Header shows "Chat" + yellow "Test Mode" badge
   - ✅ Balance displays in header: "Balance: 200,000 / 356,000"
   - ✅ FuelMeter renders on right
   - ✅ Empty state: "Start a conversation with GPT-5"
   - ✅ Type message → coral bubble appears (right)
   - ✅ After 800ms → mock response appears (left, stone bubble)
   - ✅ Console logs polling activity every 20-30s

4. **Test post-purchase:**
   - Navigate to `/chat?new_purchase=1`
   - ✅ Console: "Toast: Fuel added! 🚗"
   - ✅ URL cleans to `/chat`
   - ✅ Balance refreshes

---

## 🚨 Important Notes for Next Session

### Don't Change These
- ❌ **Don't alter V15 schema** - DB structure is locked
- ❌ **Don't remove test mode logic** - Keep IS_TEST checks
- ❌ **Don't change API contracts** - `/api/chat` must stay compatible
- ❌ **Don't break useAccount hook** - Used throughout app

### Always Do This
- ✅ **Test in mock mode first** - Set `VITE_CHAT_MOCK=1`
- ✅ **Check test mode badge** - Should be yellow when `VITE_APP_MODE=test`
- ✅ **Verify auto-scroll** - Messages should scroll to bottom
- ✅ **Check console logs** - Polling should log in test mode

### Code Style to Follow
- ✅ **Modular components** - One responsibility per file
- ✅ **TypeScript strict** - No `any` types without reason
- ✅ **Tailwind for styling** - No inline styles
- ✅ **Copy-paste ready code** - Provide exact file paths and line numbers

---

## 📋 Remaining Work (Prompts 5-9)

**User will provide specifications for:**
- Prompt 5: TBD
- Prompt 6: TBD
- Prompt 7: TBD
- Prompt 8: TBD
- Prompt 9: TBD

**When user provides next prompt:**
1. Read this handoff document first
2. Reference the detailed context file: `doc/2025-10-16_CONTEXT_CHAT_RELOCATION_PROMPTS_1-4.md`
3. Follow the established patterns (modular components, mock mode support, etc.)
4. Update the context file after completion

---

## 🔍 Quick Reference

### Key Types
```tsx
// From MessageList.tsx
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  warning?: string;
};

// From sendChat.ts
type SendResult = {
  ok: boolean;
  reply?: string;
  usage?: { total_tokens: number; ... };
  warnings?: string[];
  error?: string;
  detail?: string;
};
```

### Key Functions
```tsx
// Send a chat message (mock or real)
const result = await sendChat(messages: ChatMessage[], userId: string): Promise<SendResult>

// Ledger hook
const { balance, tierCap, refresh, bump } = useLedger()

// Account hook (V15)
const { account, loading, refresh } = useAccount(userId)
```

### Key Components
```tsx
<ChatBubble role="user" content="Hello" warning="optional" />
<MessageList messages={[...]} isLoading={false} />
<ChatComposer disabled={false} onSend={async (text) => {...}} />
```

---

## 🎯 Success Criteria

**Each prompt should deliver:**
1. ✅ **Copy-paste ready code** with exact file paths
2. ✅ **Test steps** to verify functionality
3. ✅ **Revert steps** in case of issues
4. ✅ **No breaking changes** to existing features
5. ✅ **Console logs** for debugging (test mode only)

**After completing a prompt:**
1. Test in browser
2. Check console for errors
3. Verify test mode indicators
4. Update context file if major changes

---

## 🐛 Known Issues (Non-blocking)

- ⚠️ **Toast notifications:** Using `console.log` instead of proper toast library (TODO)
- ⚠️ **Single-line input:** Composer uses `<input>` not `<textarea>` (can upgrade later)
- ⚠️ **No markdown:** ChatBubble renders plain text only (can add later)
- ⚠️ **Dual hooks:** Both `useAccount` and `useLedger` fetch balances (may consolidate)

---

## 📚 Related Documentation

If you need more details, read these in order:

1. **This file** - Quick handoff (you are here)
2. `doc/2025-10-16_CONTEXT_CHAT_RELOCATION_PROMPTS_1-4.md` - Detailed breakdown (640 lines)
3. `doc/2025-10-14_CONTEXT_V16_UNIFIED_TEST_MODE.md` - V16 test mode pattern
4. `doc/2025-10-13_CONTEXT_FULL_REPO_V15_CLEANED.md` - V15 schema reference

---

## 🚀 Starting Checklist for Next Session

```
□ Read this handoff document
□ Check current branch (should be 'main')
□ Verify environment variables set (VITE_APP_MODE=test)
□ Start dev server: cd web && pnpm dev
□ Navigate to /chat and verify it works
□ Check console for polling logs
□ Ask user for Prompt 5 specification
□ Follow established patterns from Prompts 1-4
```

---

## 💬 Common User Phrases & What They Mean

| User Says | They Mean |
|-----------|-----------|
| "Wire it up" | Connect component/function to existing code |
| "Stub it" | Create placeholder/mock implementation |
| "Drop-in" | Modular code that's easy to add/remove |
| "Copy-paste ready" | Provide complete code blocks with file paths |
| "Test steps" | How to verify the feature works |
| "Revert steps" | How to undo changes if needed |
| "Mock mode" | Use fake data for development |
| "Real mode" | Use actual API/database |

---

**Session End:** October 16, 2025
**Next Session:** Ready for Prompt 5
**Status:** ✅ All systems operational

**Quick verification command:**
```bash
cd web && pnpm dev
# Then navigate to http://localhost:5173/chat
```

---

**End of Handoff Document**
