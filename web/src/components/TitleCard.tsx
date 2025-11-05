import { ReactNode } from "react";

/**
 * TitleCard - A stricter Card component with required title prop.
 * Use this ONLY when you want the title/children structure enforced.
 *
 * For flexible layouts, use plain div wrappers:
 * <div className="surface bdr radius p-4">{children}</div>
 */
export function TitleCard({
  title,
  meta,
  children
}: {
  title: string;
  meta?: string;
  children?: ReactNode;
}) {
  return (
    <div className="surface bdr radius p-4">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      {meta && <div className="text-sm text-muted mb-2">{meta}</div>}
      {children}
    </div>
  );
}
