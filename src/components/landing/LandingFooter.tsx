import { Link } from "@tanstack/react-router";
import { Stethoscope } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/30">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Stethoscope className="size-3.5" aria-hidden />
          </span>
          ClinicFlow Suite
        </Link>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#how" className="hover:text-foreground">
            How it works
          </a>
          <a href="#faq" className="hover:text-foreground">
            FAQ
          </a>
          <Link to="/login" className="hover:text-foreground">
            Clinic sign in
          </Link>
          <Link to="/superadmin/login" className="hover:text-foreground">
            Platform admin
          </Link>
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </div>
        <span className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} ClinicFlow Suite
        </span>
      </div>
    </footer>
  );
}
