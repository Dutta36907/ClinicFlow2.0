import { Link } from "@tanstack/react-router";
import { Stethoscope, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#faq", label: "FAQ" },
  { href: "#contact", label: "Contact" },
];

export function LandingHeader({ onCta }: { onCta: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Stethoscope className="size-4" aria-hidden />
          </span>
          ClinicFlow Suite
        </Link>

        <nav className="hidden items-center gap-7 text-sm md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild size="sm" variant="ghost">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button size="sm" onClick={onCta}>
            Request Demo
          </Button>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          className="rounded-md p-2 md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-3 text-sm">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {n.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2">
              <Button asChild size="sm" variant="outline" className="flex-1">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  setOpen(false);
                  onCta();
                }}
              >
                Request Demo
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
