import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/telemetry";

export function Breadcrumbs() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [className, setClassName] = useState<string | null>(null);
  const [attemptInfo, setAttemptInfo] = useState<{ title: string; classId?: string } | null>(null);

  // Fetch class name if we're in a class route
  useEffect(() => {
    if (params.id && location.pathname.startsWith("/classes/")) {
      let alive = true;
      (async () => {
        const { data, error } = await supabase
          .from("classes")
          .select("name")
          .eq("id", params.id)
          .single();

        if (!alive) return;
        if (!error && data) {
          setClassName(data.name);
        }
      })();
      return () => {
        alive = false;
      };
    } else {
      setClassName(null);
    }
  }, [params.id, location.pathname]);

  // Fetch attempt info if we're viewing an attempt
  useEffect(() => {
    if (params.id && location.pathname.startsWith("/attempts/")) {
      let alive = true;
      (async () => {
        const { data, error } = await supabase
          .from("attempts")
          .select("title, class_id")
          .eq("id", params.id)
          .single();

        if (!alive) return;
        if (!error && data) {
          setAttemptInfo({ title: data.title || "Untitled Quiz", classId: data.class_id });
        }
      })();
      return () => {
        alive = false;
      };
    } else {
      setAttemptInfo(null);
    }
  }, [params.id, location.pathname]);

  // Build breadcrumb segments
  const segments: Array<{ label: string; path?: string; depth: number }> = [];

  // Dashboard is always available
  if (location.pathname !== "/dashboard") {
    segments.push({ label: "Dashboard", path: "/dashboard", depth: 0 });
  }

  // Class routes
  if (location.pathname.startsWith("/classes/") && params.id) {
    segments.push({
      label: className || "...",
      path: `/classes/${params.id}/notes`,
      depth: 1,
    });

    if (location.pathname.includes("/notes")) {
      segments.push({ label: "Notes", depth: 2 });
    }
  }

  // Results routes
  if (location.pathname.startsWith("/results")) {
    segments.push({ label: "Results", depth: 1 });
  }

  // Attempt detail routes
  if (location.pathname.startsWith("/attempts/") && params.id) {
    segments.push({ label: "Results", path: "/results", depth: 1 });
    segments.push({ label: attemptInfo?.title || "...", depth: 2 });
  }

  // Quiz routes
  if (location.pathname.startsWith("/quiz/") && params.id) {
    segments.push({ label: "Taking Quiz", depth: 1 });
  }

  // Generate routes
  if (location.pathname.startsWith("/tools/generate") || location.pathname === "/generate") {
    segments.push({ label: "Generate Quiz", depth: 1 });
  }

  // Settings routes
  if (location.pathname.startsWith("/settings/")) {
    segments.push({ label: "Settings", path: "/settings", depth: 1 });
    if (location.pathname.includes("/appearance")) {
      segments.push({ label: "Appearance", depth: 2 });
    }
  }

  // Don't render breadcrumbs if we're on dashboard or have no segments
  if (segments.length === 0) {
    return null;
  }

  function handleBreadcrumbClick(path: string, depth: number) {
    track("breadcrumb_clicked", { path, depth });
    navigate(path);
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
      {segments.map((segment, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && (
            <span
              aria-hidden="true"
              style={{
                color: "var(--text-soft)",
                fontSize: "12px",
              }}
            >
              ›
            </span>
          )}
          {segment.path ? (
            <button
              onClick={() => handleBreadcrumbClick(segment.path!, segment.depth)}
              className="hover:underline focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] rounded px-1"
              style={{
                color: "var(--text-muted)",
                transition: "color var(--motion-duration-normal) var(--motion-ease)",
              }}
            >
              {segment.label}
            </button>
          ) : (
            <span
              style={{
                color: "var(--text)",
                fontWeight: 500,
              }}
            >
              {segment.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
