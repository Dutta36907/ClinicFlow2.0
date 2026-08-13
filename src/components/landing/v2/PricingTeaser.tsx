import { Check, Sparkles } from "lucide-react";
import { Reveal } from "./Reveal";

const TIERS = [
  {
    name: "Starter",
    price: "₹0",
    period: "for 30 days",
    body: "Try every feature with one doctor and unlimited bookings.",
    cta: "Start free",
    highlight: false,
    features: ["1 doctor", "Branded booking page", "SMS verification", "Email reminders"],
  },
  {
    name: "Growth",
    price: "₹1,499",
    period: "/ month",
    body: "Best for busy multi-doctor clinics that want fewer no-shows.",
    cta: "Request demo",
    highlight: true,
    features: [
      "Up to 8 doctors",
      "WhatsApp reminders",
      "Advanced insights",
      "Role-based access",
      "Priority support",
    ],
  },
  {
    name: "Scale",
    price: "Custom",
    period: "for hospitals & chains",
    body: "Multi-branch, white-label, and dedicated onboarding for your team.",
    cta: "Talk to sales",
    highlight: false,
    features: ["Unlimited doctors", "Multi-branch", "API & integrations", "Dedicated CSM"],
  },
];

export function PricingTeaser({ onCta }: { onCta: () => void }) {
  return (
    <section id="pricing" className="bg-[#0c2340]/[0.025] px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="mb-14 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#2d8a9e]">
              Pricing
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold text-[#0c2340] md:text-5xl">
              Simple plans that grow with you.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[#1a4a6e]/70">
              No setup fee. Cancel anytime. Pick a plan, or chat with us for something custom.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-6 md:grid-cols-3">
          {TIERS.map((t, i) => (
            <Reveal key={t.name} delay={i * 100}>
              <div
                className={`relative flex h-full flex-col rounded-3xl p-8 transition-all hover:-translate-y-1 ${
                  t.highlight
                    ? "border-2 border-[#2d8a9e] bg-white shadow-2xl shadow-[#2d8a9e]/20"
                    : "border border-[#1a4a6e]/10 bg-white shadow-sm hover:shadow-xl"
                }`}
              >
                {t.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2d8a9e] px-3 py-1 text-xs font-bold text-white shadow-md">
                    <Sparkles className="mr-1 inline size-3" /> Most popular
                  </span>
                )}
                <div className="text-sm font-semibold text-[#2d8a9e]">{t.name}</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold text-[#0c2340]">
                    {t.price}
                  </span>
                  <span className="text-sm text-[#1a4a6e]/60">{t.period}</span>
                </div>
                <p className="mt-3 text-sm text-[#1a4a6e]/70">{t.body}</p>

                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[#1a4a6e]">
                      <Check className="mt-0.5 size-4 shrink-0 text-[#2d8a9e]" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={onCta}
                  className={`mt-8 rounded-xl px-5 py-3 font-bold transition-all hover:-translate-y-0.5 ${
                    t.highlight
                      ? "bg-[#2d8a9e] text-white shadow-lg shadow-[#2d8a9e]/30 hover:bg-[#1a4a6e]"
                      : "border border-[#1a4a6e]/15 bg-white text-[#1a4a6e] hover:border-[#2d8a9e]/40 hover:bg-[#5cbdb9]/5"
                  }`}
                >
                  {t.cta}
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
