/**
 * WCAG AA Contrast Checker for Design Tokens
 *
 * Validates all token pairs defined in the Allowed Pair Matrix
 * Fails CI if any pair doesn't meet WCAG AA requirements:
 * - Normal text: ≥4.5:1 contrast ratio
 * - Large text (≥18pt bold): ≥3:1 contrast ratio
 *
 * Usage: npm run check-contrast
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES module __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// WCAG AA requirements
const CONTRAST_AA_NORMAL = 4.5;
const CONTRAST_AA_LARGE = 3.0;

// Token definitions (parsed from theme-tokens.css)
interface TokenPair {
  bg: string;
  fg: string;
  label: string;
  isLarge?: boolean;  // Large text has lower threshold
}

/**
 * Parse hex color to RGB
 */
function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return [r, g, b];
}

/**
 * Calculate relative luminance (WCAG formula)
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function getLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const sRGB = channel / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * https://www.w3.org/TR/WCAG20/#contrast-ratiodef
 */
function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(hexToRgb(color1));
  const lum2 = getLuminance(hexToRgb(color2));
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parse token values from CSS file
 */
function parseTokens(cssContent: string): Map<string, string> {
  const tokens = new Map<string, string>();
  // Match: --token-name-123: #hex or var(--other-token)
  const varRegex = /--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6}|var\(--[a-z0-9-]+\));/g;

  let match;
  while ((match = varRegex.exec(cssContent)) !== null) {
    const [, name, value] = match;
    tokens.set(name, value);
  }

  return tokens;
}

/**
 * Resolve CSS variables to hex values
 */
function resolveTokenValue(value: string, tokens: Map<string, string>): string {
  if (value.startsWith('#')) {
    return value;
  }

  // Extract var name: var(--token-name-123) -> token-name-123
  const varMatch = value.match(/var\(--([a-z0-9-]+)\)/);
  if (varMatch) {
    const varName = varMatch[1];
    const resolved = tokens.get(varName);
    if (resolved) {
      return resolveTokenValue(resolved, tokens);
    }
  }

  throw new Error(`Could not resolve token: ${value}`);
}

/**
 * Allowed token pairs from theme-tokens.css comment
 */
const ALLOWED_PAIRS: TokenPair[] = [
  { bg: 'brand-500', fg: 'brand-contrast', label: 'Brand button text' },
  { bg: 'accent-500', fg: 'accent-contrast', label: 'Accent button text' },
  { bg: 'bg', fg: 'fg', label: 'Primary body text' },
  { bg: 'bg', fg: 'fg-muted', label: 'Muted body text' },
  { bg: 'surface', fg: 'fg', label: 'Surface primary text' },
  { bg: 'surface', fg: 'fg-muted', label: 'Surface muted text' },
  { bg: 'card', fg: 'fg', label: 'Card primary text' },
  { bg: 'card', fg: 'fg-muted', label: 'Card muted text' },
  { bg: 'card', fg: 'quiz-mcq', label: 'MCQ badge on card' },
  { bg: 'card', fg: 'quiz-typing', label: 'Typing badge on card' },
  { bg: 'card', fg: 'quiz-hybrid', label: 'Hybrid badge on card' },
  { bg: 'card', fg: 'score-pass', label: 'Pass score badge' },
  { bg: 'card', fg: 'score-fail', label: 'Fail score badge' },
  { bg: 'card', fg: 'success', label: 'Success state on card' },
  { bg: 'card', fg: 'warning', label: 'Warning state on card' },
  { bg: 'card', fg: 'danger', label: 'Danger state on card' },
  { bg: 'card', fg: 'info', label: 'Info state on card' },
];

/**
 * Main validation function
 */
function checkContrast() {
  console.log('🎨 WCAG AA Contrast Validation\n');

  // Read token file
  const tokenPath = join(__dirname, '..', 'src', 'theme-tokens.css');
  const cssContent = readFileSync(tokenPath, 'utf-8');
  const tokens = parseTokens(cssContent);

  console.log(`✓ Loaded ${tokens.size} tokens from theme-tokens.css\n`);

  let passCount = 0;
  let failCount = 0;
  const failures: string[] = [];

  // Check each pair
  for (const pair of ALLOWED_PAIRS) {
    try {
      const bgValue = tokens.get(pair.bg);
      const fgValue = tokens.get(pair.fg);

      if (!bgValue || !fgValue) {
        console.error(`❌ Missing token: ${pair.bg} or ${pair.fg}`);
        failCount++;
        continue;
      }

      const bgHex = resolveTokenValue(bgValue, tokens);
      const fgHex = resolveTokenValue(fgValue, tokens);
      const ratio = getContrastRatio(bgHex, fgHex);

      const threshold = pair.isLarge ? CONTRAST_AA_LARGE : CONTRAST_AA_NORMAL;
      const pass = ratio >= threshold;

      if (pass) {
        console.log(`✓ ${pair.label.padEnd(30)} ${ratio.toFixed(2)}:1 (AA ${threshold}:1)`);
        passCount++;
      } else {
        const msg = `✗ ${pair.label.padEnd(30)} ${ratio.toFixed(2)}:1 (AA ${threshold}:1) - FAIL`;
        console.error(`❌ ${msg}`);
        failures.push(msg);
        failCount++;
      }
    } catch (error) {
      console.error(`❌ Error checking pair ${pair.label}:`, error);
      failCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passCount} passed, ${failCount} failed`);
  console.log('='.repeat(60) + '\n');

  if (failCount > 0) {
    console.error('❌ WCAG AA validation FAILED\n');
    console.error('Failing pairs:');
    failures.forEach((f) => console.error(`  ${f}`));
    process.exit(1);
  } else {
    console.log('✅ All token pairs pass WCAG AA contrast requirements\n');
    process.exit(0);
  }
}

// Run check
checkContrast();
