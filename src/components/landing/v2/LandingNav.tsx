import { Link } from "@tanstack/react-router";
import { Menu, Stethoscope, X } from "lucide-react";
import { useState } from "react";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNav({ onCta }: { onCta: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1a4a6e]/5 bg-[#fcfdfe]/80 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#2d8a9e] text-white shadow-sm shadow-[#2d8a9e]/30">
            <Stethoscope className="size-5" aria-hidden />
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-[#0c2340]">
            ClinicFlow
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-[#1a4a6e] md:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="transition-colors hover:text-[#2d8a9e]">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="text-sm font-semibold text-[#1a4a6e] transition-colors hover:text-[#2d8a9e]"
          >
            Sign in
          </Link>
          <button
            onClick={onCta}
            className="rounded-full bg-[#1a4a6e] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#1a4a6e]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0c2340]"
          >
            Request Demo
          </button>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          className="rounded-md p-2 text-[#0c2340] md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-[#1a4a6e]/5 bg-[#fcfdfe] md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-3 text-sm">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2 text-[#1a4a6e] hover:bg-[#5cbdb9]/10 hover:text-[#2d8a9e]"
              >
                {n.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2">
              <Link
                to="/login"
                className="flex-1 rounded-lg border border-[#1a4a6e]/15 px-4 py-2 text-center font-semibold text-[#1a4a6e]"
              >
                Sign in
              </Link>
              <button
                onClick={() => {
                  setOpen(false);
                  onCta();
                }}
                className="flex-1 rounded-lg bg-[#1a4a6e] px-4 py-2 text-center font-semibold text-white"
              >
                Request Demo
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
