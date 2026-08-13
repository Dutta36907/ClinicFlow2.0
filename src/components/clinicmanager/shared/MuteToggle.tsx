/**
 * MuteToggle — small bell button that controls whether the manager
 * hears the new-appointment chime. Persists per-device in localStorage.
 */
import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const MUTE_KEY = "mgr-mute";

export function MuteToggle() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    try {
      setMuted(window.localStorage.getItem(MUTE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggle() {
    const next = !muted;
    setMuted(next);
    try {
      window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={
        "size-8 transition-all " +
        (muted
          ? "bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/30 hover:bg-amber-500/20"
          : "hover:bg-primary/10")
      }
      onClick={toggle}
      title={muted ? "Booking sound muted" : "Booking sound on"}
      aria-label={muted ? "Unmute booking sound" : "Mute booking sound"}
      aria-pressed={muted}
    >
      {muted ? <BellOff className="size-4" /> : <Bell className="size-4" />}
    </Button>
  );
}
