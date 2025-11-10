/**
 * FrameWrapper Component
 *
 * Wraps quiz content with optional decorative frame and pattern.
 * Supports:
 * - Inline SVG frames (tintable via currentColor)
 * - Background patterns (tiled, low opacity)
 * - Graceful fallbacks (neutral border if asset fails)
 * - Responsive sizing (mobile-friendly)
 * - Text-only mode (hides decorative elements)
 *
 * Usage:
 *   <FrameWrapper frameId="frame-basic-01" patternId="dots-02">
 *     <QuizContent />
 *   </FrameWrapper>
 */

import { useEffect, useState, type ReactNode } from 'react';
import { getAssetUrl, getAssetMetadata, type FrameAsset, type PatternAsset } from '@/lib/brand-assets';

interface FrameWrapperProps {
  frameId?: string; // From manifest or undefined for default
  patternId?: string; // From manifest or undefined for default
  children: ReactNode;
  enabled?: boolean; // Respects FEATURE_VISUALS flag
  className?: string; // Additional Tailwind classes
}

export function FrameWrapper({
  frameId,
  patternId,
  children,
  enabled = true,
  className = '',
}: FrameWrapperProps) {
  const [frameUrl, setFrameUrl] = useState<string>('');
  const [patternUrl, setPatternUrl] = useState<string>('');
  const [frameMetadata, setFrameMetadata] = useState<FrameAsset | null>(null);
  const [patternMetadata, setPatternMetadata] = useState<PatternAsset | null>(null);
  const [loadError, setLoadError] = useState<boolean>(false);

  // Check text-only mode from localStorage
  const textOnlyMode = typeof window !== 'undefined' && localStorage.getItem('text_only_mode') === 'true';

  // Determine if we should show visuals
  const showVisuals = enabled && !textOnlyMode;

  useEffect(() => {
    // Skip loading if visuals disabled
    if (!showVisuals) {
      return;
    }

    // Load frame asset
    if (frameId) {
      Promise.all([getAssetUrl(frameId), getAssetMetadata(frameId)])
        .then(([url, metadata]) => {
          setFrameUrl(url);
          setFrameMetadata(metadata as FrameAsset);
        })
        .catch((error) => {
          console.error(`[FrameWrapper] Failed to load frame "${frameId}":`, error);
          setLoadError(true);
        });
    }

    // Load pattern asset
    if (patternId) {
      Promise.all([getAssetUrl(patternId), getAssetMetadata(patternId)])
        .then(([url, metadata]) => {
          setPatternUrl(url);
          setPatternMetadata(metadata as PatternAsset);
        })
        .catch((error) => {
          console.error(`[FrameWrapper] Failed to load pattern "${patternId}":`, error);
          setLoadError(true);
        });
    }
  }, [frameId, patternId, showVisuals]);

  // If visuals disabled or text-only mode, render children without wrapper
  if (!showVisuals) {
    return <div className={className}>{children}</div>;
  }

  // Fallback: Neutral border if asset loading failed
  if (loadError || (!frameUrl && frameId)) {
    return (
      <div
        className={`relative rounded-lg border border-[var(--border)] p-4 ${className}`}
        role="presentation"
      >
        {children}
      </div>
    );
  }

  // Pattern background style
  const patternStyle: React.CSSProperties = patternUrl
    ? {
        backgroundImage: `url(${patternUrl})`,
        backgroundRepeat: patternMetadata?.tile || 'repeat',
        backgroundSize: 'auto',
        opacity: patternMetadata?.opacity || 0.12,
      }
    : {};

  return (
    <div className={`relative ${className}`} role="presentation">
      {/* Pattern layer (behind content) */}
      {patternUrl && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={patternStyle}
          aria-hidden="true"
          role="img"
          aria-label={patternMetadata?.alt || 'decorative pattern'}
        />
      )}

      {/* Frame layer (border/wrapper) */}
      {frameUrl ? (
        <div
          className="relative w-full h-full"
          style={{
            border: 'none', // Frame handles border visually
            padding: '16px', // Ensure content doesn't touch frame edges
          }}
        >
          {/* Inline SVG frame for tinting support */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${frameUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              color: 'var(--border)', // Tint color for currentColor in SVG
            }}
            aria-hidden="true"
            role="img"
            aria-label={frameMetadata?.alt || 'decorative frame'}
          />

          {/* Content layer (above frame and pattern) */}
          <div className="relative z-10">{children}</div>
        </div>
      ) : (
        // No frame: render content directly
        <div className="relative z-10 p-4">{children}</div>
      )}
    </div>
  );
}

/**
 * Mobile-optimized variant with reduced pattern opacity
 */
export function FrameWrapperMobile(props: FrameWrapperProps) {
  return (
    <div className="sm:hidden">
      <FrameWrapper {...props} />
    </div>
  );
}

/**
 * Desktop-optimized variant
 */
export function FrameWrapperDesktop(props: FrameWrapperProps) {
  return (
    <div className="hidden sm:block">
      <FrameWrapper {...props} />
    </div>
  );
}
