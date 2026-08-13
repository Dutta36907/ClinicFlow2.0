import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { LandingNav } from "@/components/landing/v2/LandingNav";
import { HeroBento } from "@/components/landing/v2/HeroBento";
import { TrustStrip } from "@/components/landing/v2/TrustStrip";
import { BentoFeatures } from "@/components/landing/v2/BentoFeatures";
import { HowItWorks } from "@/components/landing/v2/HowItWorks";
import { PersonaCards } from "@/components/landing/v2/PersonaCards";
import { ResultsBand } from "@/components/landing/v2/ResultsBand";
import { TestimonialBento } from "@/components/landing/v2/TestimonialBento";
import { PricingTeaser } from "@/components/landing/v2/PricingTeaser";
import { FinalCTA } from "@/components/landing/v2/FinalCTA";
import { FAQSection } from "@/components/landing/FAQSection";
import { EnquiryForm } from "@/components/landing/EnquiryForm";
import { LandingFooter } from "@/components/landing/LandingFooter";
import type { EnquiryType } from "@/types/enquiry.types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ClinicFlow Suite — Online appointments for modern clinics" },
      {
        name: "description",
        content:
          "Publish a branded booking page, manage doctors and schedules, and accept verified patient appointments online. Request a demo today.",
      },
      { property: "og:title", content: "ClinicFlow Suite — Online appointments for modern clinics" },
      {
        property: "og:description",
        content:
          "Publish a booking page, manage doctors and schedules, and accept verified patient appointments online.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [enquiryType, setEnquiryType] = useState<EnquiryType>("request_demo");
  const formRef = useRef<HTMLDivElement | null>(null);

  const scrollToForm = (type: EnquiryType) => {
    setEnquiryType(type);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#fcfdfe] text-[#0c2340]">
      <LandingNav onCta={() => scrollToForm("request_demo")} />

      <main>
        <HeroBento
          onPrimary={() => scrollToForm("request_demo")}
          onSecondary={() => scrollToForm("sign_up")}
        />
        <TrustStrip />
        <BentoFeatures />
        <HowItWorks onCta={() => scrollToForm("sign_up")} />
        <PersonaCards onCta={() => scrollToForm("sign_up")} />
        <ResultsBand />
        <TestimonialBento />
        <PricingTeaser onCta={() => scrollToForm("request_demo")} />
        <FAQSection />
        <FinalCTA
          onPrimary={() => scrollToForm("sign_up")}
          onSecondary={() => scrollToForm("request_demo")}
        />

        <section
          id="contact"
          ref={formRef}
          className="border-t border-[#1a4a6e]/10 bg-[#0c2340]/[0.025] scroll-mt-20"
        >
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 sm:py-24 lg:grid-cols-2 lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#2d8a9e]">
                Get started
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-[#0c2340] sm:text-4xl">
                Ready to see ClinicFlow in action?
              </h2>
              <p className="mt-4 text-[#1a4a6e]/75">
                Tell us a bit about your clinic and we'll get back to you within one business day.
                Pick "Request Demo" for a guided walkthrough or "Sign Up" to start onboarding.
              </p>
            </div>
            <EnquiryForm defaultType={enquiryType} />
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
