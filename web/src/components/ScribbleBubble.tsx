// src/components/ScribbleBubble.tsx
import Scribble from './Scribble';

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-white text-black px-4 py-2 shadow">
        <p className="whitespace-pre-wrap text-sm">{text}</p>
      </div>
    </div>
  );
}

export function BotBubble({ seed }: { seed?: number }) {
  // Vary strokes based on seed for variety (2-4 strokes)
  const strokes = seed ? 2 + (seed % 3) : 3;

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm border border-white/15 bg-white/5 px-3 py-2 backdrop-blur">
        <div className="text-orange-300">
          <Scribble width={220} height={70} strokes={strokes} seed={seed} />
        </div>
      </div>
    </div>
  );
}
