/**
 * Brand Asset Management System
 *
 * Handles loading and caching of Canva-exported frames and patterns
 * with automatic fallbacks and performance monitoring.
 *
 * Usage:
 *   import { getAssetUrl, preloadAsset } from '@/lib/brand-assets';
 *   const frameUrl = getAssetUrl('frame-basic-01');
 */

// Manifest types
export interface FrameAsset {
  id: string;
  path: string;
  hash: string;
  bytes: number;
  tintable: boolean;
  aspect: string;
  alt: string;
}

export interface PatternAsset {
  id: string;
  path: string;
  hash: string;
  bytes: number;
  tile: 'repeat' | 'no-repeat';
  opacity: number;
  alt: string;
}

export interface AssetManifest {
  version: number;
  updatedAt: string;
  frames: FrameAsset[];
  patterns: PatternAsset[];
}

// Performance tracking
const MAX_ASSET_SIZE_BYTES = 200 * 1024; // 200KB warning threshold
const MANIFEST_URL = '/brand/manifest.json';

// In-memory cache
let manifestCache: AssetManifest | null = null;
const preloadedAssets = new Set<string>();

/**
 * Load asset manifest from public folder
 */
export async function loadManifest(): Promise<AssetManifest> {
  if (manifestCache) {
    return manifestCache;
  }

  try {
    const response = await fetch(MANIFEST_URL);
    if (!response.ok) {
      throw new Error(`Failed to load manifest: ${response.status}`);
    }

    const manifest: AssetManifest = await response.json();
    manifestCache = manifest;
    return manifest;
  } catch (error) {
    console.error('[brand-assets] Failed to load manifest:', error);
    // Return empty manifest as fallback
    return {
      version: 0,
      updatedAt: new Date().toISOString(),
      frames: [],
      patterns: [],
    };
  }
}

/**
 * Get asset URL by semantic ID
 * Falls back to empty string if asset not found
 */
export async function getAssetUrl(assetId: string): Promise<string> {
  const manifest = await loadManifest();

  // Search frames
  const frame = manifest.frames.find((f) => f.id === assetId);
  if (frame) {
    validateAssetSize(frame.bytes, assetId);
    return frame.path;
  }

  // Search patterns
  const pattern = manifest.patterns.find((p) => p.id === assetId);
  if (pattern) {
    validateAssetSize(pattern.bytes, assetId);
    return pattern.path;
  }

  console.warn(`[brand-assets] Asset not found in manifest: ${assetId}`);
  return ''; // Fallback to empty (component will handle gracefully)
}

/**
 * Get asset metadata (for alt text, tinting, etc.)
 */
export async function getAssetMetadata(
  assetId: string
): Promise<FrameAsset | PatternAsset | null> {
  const manifest = await loadManifest();
  const frame = manifest.frames.find((f) => f.id === assetId);
  if (frame) return frame;

  const pattern = manifest.patterns.find((p) => p.id === assetId);
  if (pattern) return pattern;

  return null;
}

/**
 * Validate asset size and warn if exceeds threshold
 */
function validateAssetSize(bytes: number, assetId: string): void {
  if (bytes > MAX_ASSET_SIZE_BYTES) {
    console.warn(
      `[brand-assets] Asset "${assetId}" is ${(bytes / 1024).toFixed(
        1
      )}KB (threshold: ${MAX_ASSET_SIZE_BYTES / 1024}KB). Consider optimizing.`
    );
  }
}

/**
 * Preload critical assets for faster initial render
 * Call this for above-the-fold frames/patterns
 */
export function preloadAsset(assetId: string): void {
  if (preloadedAssets.has(assetId)) {
    return; // Already preloaded
  }

  getAssetUrl(assetId)
    .then((url) => {
      if (!url) return;

      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);

      preloadedAssets.add(assetId);
    })
    .catch((error) => {
      console.error(`[brand-assets] Failed to preload asset "${assetId}":`, error);
    });
}

/**
 * Retry asset load with cache-busting query param
 * Used when first attempt fails (network issue, stale cache, etc.)
 */
export async function retryAssetLoad(url: string): Promise<Response> {
  const manifest = await loadManifest();

  // Find asset hash for cache-busting
  let hash = 'retry';
  for (const frame of manifest.frames) {
    if (frame.path === url) {
      hash = frame.hash;
      break;
    }
  }
  for (const pattern of manifest.patterns) {
    if (pattern.path === url) {
      hash = pattern.hash;
      break;
    }
  }

  const cacheBustUrl = `${url}?cb=${hash}`;
  const response = await fetch(cacheBustUrl);

  if (!response.ok) {
    throw new Error(`Asset load failed after retry: ${response.status}`);
  }

  return response;
}

/**
 * Get default frame ID (for when no preference set)
 */
export function getDefaultFrameId(): string {
  return 'frame-basic-01';
}

/**
 * Get default pattern ID (for when no preference set)
 */
export function getDefaultPatternId(): string {
  return 'dots-02';
}

/**
 * Check if visuals are enabled globally (feature flag)
 */
export function visualsEnabled(): boolean {
  // Check environment variable (Vite exposes VITE_* vars)
  return import.meta.env.VITE_FEATURE_VISUALS === 'true';
}

/**
 * Dev helper: Log all available assets
 */
export async function logAvailableAssets(): Promise<void> {
  const manifest = await loadManifest();
  console.group('📦 Brand Assets');
  console.log('Version:', manifest.version);
  console.log('Updated:', manifest.updatedAt);
  console.log('Frames:', manifest.frames.map((f) => f.id));
  console.log('Patterns:', manifest.patterns.map((p) => p.id));
  console.groupEnd();
}
