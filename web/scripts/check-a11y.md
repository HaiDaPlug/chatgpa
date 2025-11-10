# Accessibility Testing Setup (TODO)

## Goal
Add automated WCAG AA accessibility testing using axe-core or Pa11y.

## Target Pages
- `/tools/generate` - Quiz generation page
- `/results` - Results page with quiz attempts

## Implementation Steps

### Option 1: axe-core (Recommended)
```bash
# Install dependencies
pnpm add -D @axe-core/cli puppeteer

# Create test script
# web/scripts/check-a11y.ts

# Add to package.json
"test:a11y": "axe http://localhost:3000/tools/generate http://localhost:3000/results --exit"
```

### Option 2: Pa11y
```bash
# Install dependencies
pnpm add -D pa11y pa11y-ci

# Create config
# web/.pa11yci.json

# Add to package.json
"test:a11y": "pa11y-ci"
```

## CI Integration
Add to GitHub Actions workflow:
```yaml
- name: Run accessibility tests
  run: |
    npm run dev &
    sleep 5
    npm run test:a11y
```

## WCAG AA Requirements
- Color contrast ≥4.5:1 (normal text) ✅ Already validated
- Color contrast ≥3:1 (large text)
- All images have alt text
- Form labels present
- Keyboard navigation works
- Focus indicators visible
- No automatic audio/video
- Semantic HTML structure

## Notes
- Deferred to later phase due to setup complexity
- Contrast validation already passing (see check-contrast.ts)
- Manual testing sufficient for Phase 1
