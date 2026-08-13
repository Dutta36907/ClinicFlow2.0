/**
 * Tiny form building blocks used by every editor in the clinic manager.
 *
 *  - `Sub`           — small uppercase subheading inside a Card.
 *  - `Grid`          — 1-column → 2-column responsive grid for paired fields.
 *  - `Field`         — labelled `<Input>` with optional inline error + counter.
 *  - `TextAreaField` — same contract as `Field`, but wraps `<Textarea>`.
 *
 * The two field components are intentionally dumb / presentational. They take
 * an `error` string from the parent (which runs validation), and a `maxLength`
 * to hard-cap input. When `maxLength` is set, a `current/max` counter is shown
 * on the right of the label — going over flips it to the destructive color.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function Sub({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

interface FieldBaseProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Inline error message shown under the input (red). */
  error?: string;
  /** Hard cap on input length; also drives the counter shown by the label. */
  maxLength?: number;
  /** Adds a small `*` next to the label and `required` on the input. */
  required?: boolean;
  placeholder?: string;
  /** Optional helper text below the input when there's no error. */
  help?: string;
}

interface FieldProps extends FieldBaseProps {
  type?: string;
  /** Used for `type="number"` so the browser shows the numeric keyboard. */
  inputMode?: "numeric" | "decimal" | "tel" | "email" | "url" | "text";
}

function LabelRow({
  label,
  required,
  value,
  maxLength,
}: {
  label: string;
  required?: boolean;
  value: string;
  maxLength?: number;
}) {
  const over = maxLength != null && value.length > maxLength;
  const near = maxLength != null && !over && value.length >= Math.floor(maxLength * 0.8);
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {maxLength != null && (
        <span
          className={cn(
            "text-[10px] tabular-nums text-muted-foreground transition-colors",
            near && "text-amber-600",
            over && "font-semibold text-destructive",
          )}
        >
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  type,
  inputMode,
  error,
  maxLength,
  required,
  placeholder,
  help,
}: FieldProps) {
  return (
    <div>
      <LabelRow
        label={label}
        required={required}
        value={value}
        maxLength={maxLength}
      />
      <Input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        required={required}
        placeholder={placeholder}
        aria-invalid={!!error}
        className={cn(
          error &&
            "border-destructive focus-visible:ring-destructive/40",
        )}
      />
      {error ? (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      ) : help ? (
        <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      ) : null}
    </div>
  );
}

interface TextAreaFieldProps extends FieldBaseProps {
  rows?: number;
}

export function TextAreaField({
  label,
  value,
  onChange,
  error,
  maxLength,
  required,
  placeholder,
  help,
  rows = 3,
}: TextAreaFieldProps) {
  return (
    <div>
      <LabelRow
        label={label}
        required={required}
        value={value}
        maxLength={maxLength}
      />
      <Textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        required={required}
        placeholder={placeholder}
        aria-invalid={!!error}
        className={cn(
          error &&
            "border-destructive focus-visible:ring-destructive/40",
        )}
      />
      {error ? (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      ) : help ? (
        <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      ) : null}
    </div>
  );
}
