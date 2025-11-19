import { useThemePreferences, ThemeId, AccentId, FontId } from '@/hooks/useThemePreferences';

// ===== Type Definitions =====

interface ThemeOption {
  id: ThemeId;
  label: string;
  description: string;
}

interface AccentOption {
  id: AccentId;
  label: string;
  description?: string;
}

interface FontOption {
  id: FontId;
  label: string;
  description: string;
  previewFont: string;
}

// ===== Configuration =====

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'academic-dark',
    label: 'Academic Dark',
    description: 'Calm dark theme for long study sessions.',
  },
  {
    id: 'academic-light',
    label: 'Academic Light',
    description: 'Soft light theme for bright environments.',
  },
  {
    id: 'midnight-focus',
    label: 'Midnight Focus',
    description: 'Extra dark contrast for deep work sessions.',
  },
];

const ACCENT_OPTIONS: AccentOption[] = [
  {
    id: 'study-blue',
    label: 'Study Blue',
    description: 'Calm and professional blue highlight.',
  },
  {
    id: 'leaf',
    label: 'Leaf',
    description: 'Soft green highlight.',
  },
];

const FONT_OPTIONS: FontOption[] = [
  {
    id: 'inter',
    label: 'Inter',
    description: 'Modern, clean, and neutral.',
    previewFont: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  {
    id: 'georgia',
    label: 'Georgia',
    description: 'Classic academic serif.',
    previewFont: 'Georgia, "Times New Roman", serif',
  },
  {
    id: 'system',
    label: 'System',
    description: "Uses your device's UI font.",
    previewFont: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
];

// ===== Helper Component: Theme Color Swatch =====

function ThemeColorSwatch({ themeId }: { themeId: ThemeId }) {
  // Mini preview showing theme colors
  const colors: Record<ThemeId, { bg: string; surface: string; text: string }> = {
    'academic-dark': { bg: '#30302E', surface: '#3A3A38', text: '#FAFBFC' },
    'academic-light': { bg: '#FFFFFF', surface: '#F7F8F9', text: '#1A1D21' },
    'midnight-focus': { bg: '#0B0D11', surface: '#101217', text: '#FFFFFF' },
  };

  const theme = colors[themeId];

  return (
    <div className="flex gap-1.5">
      <div
        className="h-6 w-6 rounded border border-[color:var(--border-subtle)]"
        style={{ backgroundColor: theme.bg }}
        title="Background"
      />
      <div
        className="h-6 w-6 rounded border border-[color:var(--border-subtle)]"
        style={{ backgroundColor: theme.surface }}
        title="Surface"
      />
      <div
        className="h-6 w-3 rounded border border-[color:var(--border-subtle)]"
        style={{ backgroundColor: theme.text }}
        title="Text"
      />
    </div>
  );
}

// ===== Helper Component: Accent Color Dot =====

function AccentColorDot({ accentId }: { accentId: AccentId }) {
  const colors: Record<AccentId, string> = {
    'study-blue': '#4965cc',
    'leaf': '#48E28A',
  };

  return (
    <div
      className="h-6 w-6 rounded-full border border-[color:var(--border-subtle)]"
      style={{ backgroundColor: colors[accentId] }}
    />
  );
}

// ===== Main Panel Component =====

export function AppearanceSettingsPanel() {
  const {
    theme,
    setTheme,
    accent,
    setAccent,
    font,
    setFont,
    contrast,
    setContrast,
    motion,
    setMotion,
  } = useThemePreferences();

  return (
    <div className="space-y-8">
      {/* ===== Header ===== */}
      <header className="space-y-1">
        <h1 id="appearance-modal-title" className="text-2xl font-semibold text-[color:var(--text)]">
          Appearance
        </h1>
        <p className="text-sm text-[color:var(--text-muted)]">
          Control theme, fonts, contrast and motion to make studying comfortable.
        </p>
      </header>

      {/* ===== Section A: Theme ===== */}
      <section className="space-y-3" aria-labelledby="appearance-theme-heading">
        <div>
          <h2
            id="appearance-theme-heading"
            className="text-sm font-medium text-[color:var(--text)]"
          >
            Theme
          </h2>
          <p className="text-xs text-[color:var(--text-muted)]">
            Choose the base look and feel of ChatGPA.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-labelledby="appearance-theme-heading"
          className="grid gap-4 md:grid-cols-3"
        >
          {THEME_OPTIONS.map((option) => {
            const isActive = theme === option.id;

            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setTheme(option.id)}
                className={`
                  flex flex-col items-start rounded-xl border p-4 text-left transition
                  bg-[color:var(--surface)] border-[color:var(--border-subtle)]
                  hover:border-[color:var(--border-strong)]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                  focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-[color:var(--bg)]
                  ${isActive ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)]' : ''}
                `}
              >
                {/* Mini preview swatch */}
                <ThemeColorSwatch themeId={option.id} />

                {/* Label */}
                <h3 className="mt-3 text-sm font-medium text-[color:var(--text)]">
                  {option.label}
                </h3>

                {/* Description */}
                <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                  {option.description}
                </p>

                {/* Active indicator */}
                {isActive && (
                  <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--accent)]">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Active
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ===== Section B: Accent Color ===== */}
      <section className="space-y-3" aria-labelledby="appearance-accent-heading">
        <div>
          <h2
            id="appearance-accent-heading"
            className="text-sm font-medium text-[color:var(--text)]"
          >
            Accent color
          </h2>
          <p className="text-xs text-[color:var(--text-muted)]">
            Adjust highlight color without changing the overall theme.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-labelledby="appearance-accent-heading"
          className="flex gap-6 flex-wrap"
        >
          {ACCENT_OPTIONS.map((option) => {
            const isActive = accent === option.id;

            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setAccent(option.id)}
                className="flex flex-col items-center gap-2 text-xs
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                  focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-[color:var(--bg)]"
              >
                {/* Color swatch */}
                <span
                  className={`
                    inline-flex h-10 w-10 items-center justify-center rounded-full border-2 transition
                    ${isActive
                      ? 'border-[color:var(--accent)] shadow-[0_0_0_3px_var(--accent-soft)]'
                      : 'border-[color:var(--border-subtle)]'
                    }
                  `}
                >
                  <AccentColorDot accentId={option.id} />
                </span>

                {/* Label */}
                <span
                  className={`font-medium ${
                    isActive ? 'text-[color:var(--accent)]' : 'text-[color:var(--text-muted)]'
                  }`}
                >
                  {option.label}
                </span>

                {/* Description */}
                {option.description && (
                  <span className="text-[10px] text-[color:var(--text-soft)] max-w-[100px] text-center leading-tight">
                    {option.description}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ===== Section C: Font ===== */}
      <section className="space-y-3" aria-labelledby="appearance-font-heading">
        <div>
          <h2
            id="appearance-font-heading"
            className="text-sm font-medium text-[color:var(--text)]"
          >
            Font
          </h2>
          <p className="text-xs text-[color:var(--text-muted)]">
            Pick the typeface you want to read and write in.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-labelledby="appearance-font-heading"
          className="space-y-3"
        >
          {FONT_OPTIONS.map((option) => {
            const isActive = font === option.id;

            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setFont(option.id)}
                className={`
                  w-full flex flex-col items-start rounded-lg border p-4 text-left transition
                  bg-[color:var(--surface)] border-[color:var(--border-subtle)]
                  hover:border-[color:var(--border-strong)]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                  focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-[color:var(--bg)]
                  ${isActive ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)]' : ''}
                `}
              >
                <div className="flex items-center justify-between w-full">
                  <div>
                    {/* Label */}
                    <h3 className="text-sm font-medium text-[color:var(--text)]">
                      {option.label}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-[color:var(--text-muted)]">
                      {option.description}
                    </p>
                  </div>

                  {/* Active indicator */}
                  {isActive && (
                    <svg className="h-5 w-5 text-[color:var(--accent)]" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>

                {/* Font preview */}
                <p
                  className="mt-3 text-sm text-[color:var(--text-muted)] border-t border-[color:var(--border-subtle)] pt-3 w-full"
                  style={{ fontFamily: option.previewFont }}
                >
                  The quick brown fox jumps over the lazy dog.
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ===== Section D: Contrast ===== */}
      <section className="space-y-3" aria-labelledby="appearance-contrast-heading">
        <div>
          <h2
            id="appearance-contrast-heading"
            className="text-sm font-medium text-[color:var(--text)]"
          >
            Contrast
          </h2>
          <p className="text-xs text-[color:var(--text-muted)]">
            Increase contrast if text feels too soft on your display.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-labelledby="appearance-contrast-heading"
          className="inline-flex rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-subtle)] p-1"
        >
          <button
            type="button"
            role="radio"
            aria-checked={contrast === 'normal'}
            onClick={() => setContrast('normal')}
            className={`
              px-4 py-1.5 text-xs font-medium rounded-full transition
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
              focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-[color:var(--bg)]
              ${
                contrast === 'normal'
                  ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent)] border border-[color:var(--accent)]'
                  : 'text-[color:var(--text-muted)] hover:text-[color:var(--text)]'
              }
            `}
          >
            Normal
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={contrast === 'high'}
            onClick={() => setContrast('high')}
            className={`
              px-4 py-1.5 text-xs font-medium rounded-full transition
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
              focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-[color:var(--bg)]
              ${
                contrast === 'high'
                  ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent)] border border-[color:var(--accent)]'
                  : 'text-[color:var(--text-muted)] hover:text-[color:var(--text)]'
              }
            `}
          >
            High contrast
          </button>
        </div>
      </section>

      {/* ===== Section E: Motion ===== */}
      <section className="space-y-3" aria-labelledby="appearance-motion-heading">
        <div>
          <h2
            id="appearance-motion-heading"
            className="text-sm font-medium text-[color:var(--text)]"
          >
            Motion
          </h2>
          <p className="text-xs text-[color:var(--text-muted)]">
            Control animation intensity. Reduced motion is gentler on focus and sensitive eyes.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-labelledby="appearance-motion-heading"
          className="inline-flex rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-subtle)] p-1"
        >
          <button
            type="button"
            role="radio"
            aria-checked={motion === 'full'}
            onClick={() => setMotion('full')}
            className={`
              px-4 py-1.5 text-xs font-medium rounded-full transition
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
              focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-[color:var(--bg)]
              ${
                motion === 'full'
                  ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent)] border border-[color:var(--accent)]'
                  : 'text-[color:var(--text-muted)] hover:text-[color:var(--text)]'
              }
            `}
          >
            Full motion
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={motion === 'reduced'}
            onClick={() => setMotion('reduced')}
            className={`
              px-4 py-1.5 text-xs font-medium rounded-full transition
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
              focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-[color:var(--bg)]
              ${
                motion === 'reduced'
                  ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent)] border border-[color:var(--accent)]'
                  : 'text-[color:var(--text-muted)] hover:text-[color:var(--text)]'
              }
            `}
          >
            Reduced motion
          </button>
        </div>
      </section>
    </div>
  );
}
