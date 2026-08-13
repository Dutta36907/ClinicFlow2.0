import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "How long does setup take?",
    a: "Most clinics are live within 10–15 minutes. You add your clinic profile, doctors, and working hours, then share your booking link.",
  },
  {
    q: "Do my patients need to create an account?",
    a: "No. Patients book in a few taps and verify their phone with a one-time code. No accounts, no passwords.",
  },
  {
    q: "Can I add more than one doctor?",
    a: "Yes. Add unlimited doctors, each with their own schedule, photo, specialization, and slot length.",
  },
  {
    q: "How is my data secured?",
    a: "Every record is protected by row-level security and audited admin actions. Only your team can access your clinic data.",
  },
  {
    q: "Do you offer a demo?",
    a: "Yes — request a demo using the form below and we'll walk you through everything in 20 minutes.",
  },
];

export function FAQSection() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
      <div className="text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Frequently asked questions
        </h2>
        <p className="mt-4 text-muted-foreground">
          Can't find what you're looking for? Just ask using the form below.
        </p>
      </div>

      <Accordion type="single" collapsible className="mt-10">
        {FAQS.map((f, i) => (
          <AccordionItem key={f.q} value={`item-${i}`}>
            <AccordionTrigger className="text-left text-base">{f.q}</AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              {f.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
