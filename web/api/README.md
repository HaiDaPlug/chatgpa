# API Gateway - Node ESM Requirements

This directory contains serverless API functions that run on Vercel using **Node.js ES Modules (ESM)**. ESM has strict requirements that differ from CommonJS - following these rules is critical to avoid runtime `ERR_MODULE_NOT_FOUND` errors.

## Core ESM Rules

### 1. **Explicit `.js` Extensions Required**

Node ESM **requires** explicit `.js` extensions on all relative imports, even when importing `.ts` files. TypeScript compiles `.ts` → `.js`, and the compiled JavaScript must reference `.js` files.

```typescript
// ✅ CORRECT - Will work in Node ESM
import { track } from './track.js';
import type { GatewayContext } from '../../_types.js';
import { validateAIConfig } from '../../../_lib/ai.js';
import { TrackInput } from '../_schemas.js';

// ❌ WRONG - Will cause ERR_MODULE_NOT_FOUND
import { track } from './track';
import type { GatewayContext } from '../../_types';
import { validateAIConfig } from '../../../_lib/ai';
import { TrackInput } from '../_schemas';
```

**This applies to:**
- Action imports: `from './track.js'`
- Schema imports: `from '../_schemas.js'`
- Lib imports: `from '../../_lib/ai.js'`
- Type imports: `from '../../_types.js'` (even for type-only imports!)

### 2. **No Directory Imports**

ESM does not support importing from directories. You **must** explicitly import the index file.

```typescript
// ✅ CORRECT
import * as actions from './_actions/index.js';

// ❌ WRONG - ERR_UNSUPPORTED_DIR_IMPORT
import * as actions from './_actions';
```

### 3. **TypeScript Configuration**

Our `tsconfig.json` is configured with `moduleResolution: "NodeNext"` specifically to preserve `.js` extensions during compilation:

```json
{
  "compilerOptions": {
    "moduleResolution": "NodeNext",  // Preserves .js extensions
    "module": "ESNext"
  }
}
```

**DO NOT** change `moduleResolution` to `"Bundler"` - it will strip `.js` extensions and break Node ESM!

## File Organization

### Underscore Prefix (`_`) Convention

Files/directories starting with underscore are **hidden from Vercel's API routing**:

- `_middleware.ts` - Shared gateway middleware
- `_types.ts` - Shared TypeScript types
- `_lib/` - Shared library functions
- `_schemas/` - Zod validation schemas per gateway
- `_actions/` - Action handler implementations per gateway

This prevents accidental route exposure and keeps routing clean (e.g., `/api/v1/util?action=track` instead of `/api/v1/util/_actions/track`).

## Import Patterns by Category

### Gateway Entry Points
**Location**: `web/api/v1/{gateway}/index.ts`

```typescript
import { handleGatewayRequest } from '../_middleware.js';
import * as actions from './_actions/index.js';

export default async function handler(req, res) {
  return handleGatewayRequest(req, res, {
    namespace: 'util',
    actions
  });
}
```

### Action Handlers
**Location**: `web/api/v1/{gateway}/_actions/{action}.ts`

```typescript
import type { GatewayContext } from '../../_types.js';
import { SomeInput } from '../_schemas.js';
import { someHelper } from '../../../_lib/helper.js';

export async function action_name(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  // Implementation
}
```

### Action Index (Re-exports)
**Location**: `web/api/v1/{gateway}/_actions/index.ts`

```typescript
export { track } from './track.js';
export { health } from './health.js';
export { ping } from './ping.js';
```

**Rules:**
- Only export actions that actually exist as `.ts` files
- Always include `.js` extension
- Remove dead exports immediately

### Schema Definitions
**Location**: `web/api/v1/{gateway}/_schemas.ts`

```typescript
import { z } from 'zod';
import { sharedSchema } from '../../_lib/shared-schema.js';

export const TrackInput = z.object({
  event: z.string(),
  data: z.record(z.any()).optional()
});
```

## Common Errors & Fixes

### Error: `ERR_MODULE_NOT_FOUND: Cannot find module '/var/task/api/v1/util/_schemas'`

**Cause**: Missing `.js` extension on import

**Fix**:
```typescript
// Before
import { TrackInput } from '../_schemas';

// After
import { TrackInput } from '../_schemas.js';
```

### Error: `ERR_UNSUPPORTED_DIR_IMPORT: Directory import '/var/task/api/v1/util/_actions' is not supported`

**Cause**: Importing from directory instead of index file

**Fix**:
```typescript
// Before
import * as actions from './_actions';

// After
import * as actions from './_actions/index.js';
```

### Error: Typescript complains about `.js` extensions

**Cause**: Using wrong `moduleResolution` setting

**Fix**: Ensure `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "moduleResolution": "NodeNext"
  }
}
```

## Verification Checklist

Before committing changes to this directory:

- [ ] All relative imports have `.js` extensions
- [ ] No directory imports (use `./dir/index.js` instead)
- [ ] `_actions/index.ts` only exports actions that exist
- [ ] No import cycles between files
- [ ] TypeScript compiles without errors (`tsc --noEmit`)

## Testing Imports Locally

After making changes, verify compiled output preserves `.js` extensions:

```bash
# Check compiled JavaScript has .js extensions
grep -r "from ['\"]\.\./" .next/server/chunks/ --include="*.js" | head -5

# Should see .js extensions like:
# from "../_schemas.js"
# from "../../_types.js"
```

## Related Documentation

- [SESSION_16_ESM_MODULE_FIXES_COMPLETE.md](/nextsession/SESSION_16_ESM_MODULE_FIXES_COMPLETE.md) - Complete history of ESM migration
- [Node ESM Documentation](https://nodejs.org/api/esm.html)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)

## Quick Reference

| Import Type | Pattern | Example |
|------------|---------|---------|
| Action | `./file.js` | `import { track } from './track.js'` |
| Schema | `../_schemas.js` | `import { Input } from '../_schemas.js'` |
| Types | `../../_types.js` | `import type { Context } from '../../_types.js'` |
| Lib | `../../../_lib/file.js` | `import { helper } from '../../../_lib/ai.js'` |
| Action Index | `./_actions/index.js` | `import * as actions from './_actions/index.js'` |
| Middleware | `../_middleware.js` | `import { handler } from '../_middleware.js'` |

---

**Remember**: When in doubt, add the `.js` extension. Node ESM requires it, and TypeScript with `NodeNext` will preserve it in the compiled output.
