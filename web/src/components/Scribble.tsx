// src/components/Scribble.tsx
import { useMemo } from 'react';

type Props = {
  width?: number;
  height?: number;
  strokes?: number;   // how many squiggles
  seed?: number;      // stable randomness per render
};

export default function Scribble({ width = 180, height = 60, strokes = 3, seed }: Props) {
  // tiny PRNG for stable-ish doodles
  const rnd = useMemo(() => {
    let s = (seed ?? Math.random()) + 1;
    return () => (s = (s * 9301 + 49297) % 233280) / 233280;
  }, [seed]);

  const paths = useMemo(() => {
    const p: string[] = [];
    for (let i = 0; i < strokes; i++) {
      const y = 10 + (height - 20) * ((i + 0.5) / strokes);
      const segments = 8 + Math.floor(rnd() * 6);
      const stepX = width / segments;
      let d = `M 8 ${y.toFixed(2)}`;
      let x = 8;
      for (let s = 0; s < segments; s++) {
        const nx = x + stepX;
        const amp = 4 + rnd() * 10; // wiggle amplitude
        const ctlY = y + (rnd() > 0.5 ? amp : -amp);
        d += ` Q ${(x + nx) / 2} ${ctlY.toFixed(2)} ${nx.toFixed(2)} ${y.toFixed(2)}`;
        x = nx;
      }
      p.push(d);
    }
    return p;
  }, [width, height, strokes, rnd]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="opacity-80">
      <defs>
        <filter id="scribbleShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.25" />
        </filter>
      </defs>
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          filter="url(#scribbleShadow)"
          opacity={0.85 - i * 0.15}
        />
      ))}
    </svg>
  );
}
