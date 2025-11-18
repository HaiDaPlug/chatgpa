import { useState, useEffect } from 'react';
import { track } from '@/lib/telemetry';

// ===== Type Definitions =====

export type ThemeId = 'academic-dark' | 'academic-light' | 'midnight-focus';
export type AccentId = 'study-blue' | 'leaf';
export type FontId = 'inter' | 'georgia' | 'system';
export type ContrastLevel = 'normal' | 'high';
export type MotionPref = 'full' | 'reduced';

interface ThemePreferences {
  theme: ThemeId;
  accent: AccentId;
  font: FontId;
  contrast: ContrastLevel;
  motion: MotionPref;
}

interface ThemePreferencesHook extends ThemePreferences {
  setTheme: (theme: ThemeId) => void;
  setAccent: (accent: AccentId) => void;
  setFont: (font: FontId) => void;
  setContrast: (contrast: ContrastLevel) => void;
  setMotion: (motion: MotionPref) => void;
}

// ===== Validation Sets =====

const VALID_THEMES: ThemeId[] = ['academic-dark', 'academic-light', 'midnight-focus'];
const VALID_ACCENTS: AccentId[] = ['study-blue', 'leaf'];
const VALID_FONTS: FontId[] = ['inter', 'georgia', 'system'];
const VALID_CONTRASTS: ContrastLevel[] = ['normal', 'high'];
const VALID_MOTIONS: MotionPref[] = ['full', 'reduced'];

// ===== Defaults =====

const DEFAULTS: ThemePreferences = {
  theme: 'academic-dark',
  accent: 'study-blue',
  font: 'inter',
  contrast: 'normal',
  motion: 'full',
};

// ===== Helper Functions =====

function validateTheme(value: string | null): ThemeId {
  if (value && VALID_THEMES.includes(value as ThemeId)) {
    return value as ThemeId;
  }
  return DEFAULTS.theme;
}

function validateAccent(value: string | null): AccentId {
  if (value && VALID_ACCENTS.includes(value as AccentId)) {
    return value as AccentId;
  }
  return DEFAULTS.accent;
}

function validateFont(value: string | null): FontId {
  if (value && VALID_FONTS.includes(value as FontId)) {
    return value as FontId;
  }
  return DEFAULTS.font;
}

function validateContrast(value: string | null): ContrastLevel {
  if (value && VALID_CONTRASTS.includes(value as ContrastLevel)) {
    return value as ContrastLevel;
  }
  return DEFAULTS.contrast;
}

function validateMotion(value: string | null): MotionPref {
  if (value && VALID_MOTIONS.includes(value as MotionPref)) {
    return value as MotionPref;
  }
  return DEFAULTS.motion;
}

function readPreferencesFromStorage(): ThemePreferences {
  return {
    theme: validateTheme(localStorage.getItem('chatgpa.theme')),
    accent: validateAccent(localStorage.getItem('chatgpa.accent')),
    font: validateFont(localStorage.getItem('chatgpa.font')),
    contrast: validateContrast(localStorage.getItem('chatgpa.contrast')),
    motion: validateMotion(localStorage.getItem('chatgpa.motion')),
  };
}

// ===== Hook =====

/**
 * Centralized theme preference management hook
 *
 * Features:
 * - Reads from localStorage on mount (with validation + fallback to defaults)
 * - Updates React state, localStorage, and <html> data attributes
 * - Fires telemetry events for preference changes
 * - No database/network calls (localStorage only for now)
 *
 * Usage:
 * ```tsx
 * const { theme, setTheme, accent, setAccent, ... } = useThemePreferences();
 *
 * <button onClick={() => setTheme('academic-light')}>Light Mode</button>
 * ```
 */
export function useThemePreferences(): ThemePreferencesHook {
  const [preferences, setPreferences] = useState<ThemePreferences>(() => {
    // Read from localStorage on mount
    return readPreferencesFromStorage();
  });

  // Sync to data attributes on mount and when preferences change
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = preferences.theme;
    root.dataset.accent = preferences.accent;
    root.dataset.font = preferences.font;
    root.dataset.contrast = preferences.contrast;
    root.dataset.motion = preferences.motion;
  }, [preferences]);

  // ===== Setters =====

  const setTheme = (theme: ThemeId) => {
    const prev = preferences.theme;
    setPreferences((p: ThemePreferences) => ({ ...p, theme }));
    localStorage.setItem('chatgpa.theme', theme);

    // Track theme change
    track('theme_changed', { from: prev, to: theme });
  };

  const setAccent = (accent: AccentId) => {
    const prev = preferences.accent;
    setPreferences((p: ThemePreferences) => ({ ...p, accent }));
    localStorage.setItem('chatgpa.accent', accent);

    // Track accent change
    track('accent_changed', { from: prev, to: accent });
  };

  const setFont = (font: FontId) => {
    const prev = preferences.font;
    setPreferences((p: ThemePreferences) => ({ ...p, font }));
    localStorage.setItem('chatgpa.font', font);

    // Track font change
    track('font_changed', { from: prev, to: font });
  };

  const setContrast = (contrast: ContrastLevel) => {
    const prev = preferences.contrast;
    setPreferences((p: ThemePreferences) => ({ ...p, contrast }));
    localStorage.setItem('chatgpa.contrast', contrast);

    // Track contrast change
    track('contrast_changed', { from: prev, to: contrast });
  };

  const setMotion = (motion: MotionPref) => {
    const prev = preferences.motion;
    setPreferences((p: ThemePreferences) => ({ ...p, motion }));
    localStorage.setItem('chatgpa.motion', motion);

    // Track motion change
    track('motion_changed', { from: prev, to: motion });
  };

  return {
    ...preferences,
    setTheme,
    setAccent,
    setFont,
    setContrast,
    setMotion,
  };
}
