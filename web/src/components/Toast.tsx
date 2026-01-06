import React from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Info,
  ExternalLink
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* TYPES                                   */
/* -------------------------------------------------------------------------- */

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  /** The visual style of the toast */
  variant?: ToastVariant;
  /** Primary message text */
  title: string;
  /** Secondary descriptive text */
  description?: string;
  /** Optional icon override */
  icon?: React.ReactNode;
  /** Label for the action button */
  actionLabel?: string;
  /** Handler for the action button */
  onAction?: () => void;
  /** Handler for the close button */
  onClose: () => void;
  /** Additional class names for the container */
  className?: string;
}

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

/**
 * Maps abstract variants to semantic design tokens.
 * Assumes the existence of semantic colors in tailwind.config.js:
 * - success, destructive, warning, info (for borders/text)
 * - background/foreground (for base)
 * - muted/muted-foreground (for secondary text)
 */
const getVariantClasses = (variant: ToastVariant) => {
  const base = "border-2 backdrop-blur-md shadow-xl";

  // ✅ Safe - Using CSS custom properties via arbitrary values
  // ⚠️ ALPHA OPACITY CAVEAT: bg-[var(--card)]/95 may fail in some Tailwind versions
  // Fallback: use bg-[var(--surface-raised)] if build fails
  const variants = {
    default: `
      ${base}
      bg-[var(--card)]/95 border-[var(--border-subtle)]
      text-[var(--text)]
    `,
    success: `
      ${base}
      bg-[var(--card)]/95 border-[var(--text-success)]
      text-[var(--text)]
    `,
    error: `
      ${base}
      bg-[var(--card)]/95 border-[var(--text-danger)]
      text-[var(--text)]
    `,
    warning: `
      ${base}
      bg-[var(--card)]/95 border-[var(--text-warning)]
      text-[var(--text)]
    `,
    info: `
      ${base}
      bg-[var(--card)]/95 border-[var(--info)]
      text-[var(--text)]
    `
  };

  return variants[variant] || variants.default;
};

const getIconContainerClasses = (variant: ToastVariant) => {
  const base = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border";

  // ✅ Safe - Using neutral bg for all variants (status differentiated by border + icon color)
  // Avoids bg-[var(--token)]/10 alpha syntax which may not compile reliably
  const variants = {
    default: `${base} bg-[var(--chip-bg)] border-[var(--chip-border)] text-[var(--text-muted)]`,
    success: `${base} bg-[var(--chip-bg)] border-[var(--chip-border)] text-[var(--text-success)]`,
    error: `${base} bg-[var(--chip-bg)] border-[var(--chip-border)] text-[var(--text-danger)]`,
    warning: `${base} bg-[var(--chip-bg)] border-[var(--chip-border)] text-[var(--text-warning)]`,
    info: `${base} bg-[var(--chip-bg)] border-[var(--chip-border)] text-[var(--info)]`,
  };

  return variants[variant] || variants.default;
};

const getDefaultIcon = (variant: ToastVariant) => {
  switch (variant) {
    case 'success': return <CheckCircle2 className="h-5 w-5" />;
    case 'error': return <AlertCircle className="h-5 w-5" />;
    case 'warning': return <AlertTriangle className="h-5 w-5" />;
    case 'info': return <Info className="h-5 w-5" />;
    default: return <Info className="h-5 w-5" />;
  }
};

/* -------------------------------------------------------------------------- */
/* COMPONENT                                 */
/* -------------------------------------------------------------------------- */

export const Toast: React.FC<ToastProps> = ({
  variant = 'default',
  title,
  description,
  icon,
  actionLabel,
  onAction,
  onClose,
  className = ''
}) => {
  const containerClasses = getVariantClasses(variant);
  const iconClasses = getIconContainerClasses(variant);
  const IconComponent = icon || getDefaultIcon(variant);

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`
        pointer-events-auto
        relative flex w-full max-w-sm items-start gap-4 overflow-hidden rounded-2xl p-4 pr-10
        transition-all duration-300 ease-out
        ${containerClasses}
        ${className}
      `}
    >
      {/* Icon Area */}
      <div className={iconClasses}>
        {IconComponent}
      </div>

      {/* Content Area */}
      <div className="flex flex-1 flex-col justify-center pt-0.5">
        <h3 className="text-sm font-semibold leading-tight tracking-tight">
          {title}
        </h3>
        
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
            {description}
          </p>
        )}

        {/* Optional Action Button */}
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="group mt-3 flex items-center gap-1.5 self-start rounded-md text-xs font-medium text-[var(--text)]/80 hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {actionLabel}
            <ExternalLink className="h-3 w-3 opacity-50 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute right-3 top-3 rounded-md p-1 text-[var(--text-muted)]/50 opacity-70 transition-opacity hover:bg-[var(--surface-subtle)] hover:text-[var(--text)] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default Toast;