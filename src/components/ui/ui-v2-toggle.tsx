/**
 * UiV2Toggle — runtime flip between polished UI (default) and classic UI.
 *
 * Stored in localStorage as `ui-v2` ("off" disables polish). Adds/removes
 * the `.ui-v2` class on <html>. Lives in the manager header for quick rollback.
 */
import { useEffect, useState } from "react";
import { Sparkles, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "ui-v2";

function read(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(KEY) !== "off";
}

function apply(on: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("ui-v2", on);
}

export function UiV2Toggle({ className = "" }: { className?: string }) {
  const [on, setOn] = useState(true);

  useEffect(() => {
    const v = read();
    setOn(v);
    apply(v);
  }, []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      aria-label={on ? "Switch to classic UI" : "Switch to new UI"}
      title={on ? "New UI — click to switch to classic" : "Classic UI — click to switch back"}
      onClick={() => {
        const next = !on;
        setOn(next);
        apply(next);
        window.localStorage.setItem(KEY, next ? "on" : "off");
      }}
    >
      {on ? <Sparkles className="size-4" /> : <SparklesIcon className="size-4 opacity-50" />}
      <span className="hidden sm:inline">{on ? "New UI" : "Classic UI"}</span>
    </Button>
  );
}

/**
 * Bootstraps the `.ui-v2` class on first paint so polished styles apply
 * without a flash. Mount once at the root.
 */
export function UiV2Bootstrap() {
  useEffect(() => {
    apply(read());
  }, []);
  return null;
}
