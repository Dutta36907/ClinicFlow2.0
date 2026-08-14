// Enquiry form used at the bottom of the landing page.
// Public submission → src/lib/enquiries.functions.ts (rate-limited).
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateEnquiry } from "@/hooks/useEnquiries";
import { ENQUIRY_TYPES, type EnquiryType } from "@/types/enquiry.types";

const schema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name").max(120),
  company_name: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(20, "Phone number is too long"),
  message: z.string().trim().max(2000, "Message is too long").optional().or(z.literal("")),
  enquiry_type: z.enum(ENQUIRY_TYPES),
});

type FormValues = z.infer<typeof schema>;

export function EnquiryForm({ defaultType = "request_demo" }: { defaultType?: EnquiryType }) {
  const mutation = useCreateEnquiry();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      company_name: "",
      email: "",
      phone: "",
      message: "",
      enquiry_type: defaultType,
    },
  });

  // Keep the form's enquiry_type in sync if the parent CTA changes it.
  useEffect(() => {
    form.setValue("enquiry_type", defaultType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultType]);

  const onSubmit = (values: FormValues) => {
    if (mutation.isPending) return;
    mutation.mutate(values, {
      onSuccess: () => {
        toast.success("Thanks — we'll be in touch shortly.");
        form.reset({
          full_name: "",
          company_name: "",
          email: "",
          phone: "",
          message: "",
          enquiry_type: defaultType,
        });
      },
      onError: (err: unknown) => {
        toast.error(
          err instanceof Error ? err.message : "Couldn't submit your enquiry. Please try again.",
        );
      },
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-5 rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8"
        noValidate
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name *</FormLabel>
                <FormControl>
                  <Input placeholder="Jane Doe" autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="company_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company / Clinic</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Clinic" autoComplete="organization" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email *</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@clinic.com"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone *</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="+91 98765 43210" autoComplete="tel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="enquiry_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Enquiry type *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose one" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="request_demo">Request Demo</SelectItem>
                  <SelectItem value="sign_up">Sign Up</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Requirement / Message</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="Tell us a bit about your clinic and what you'd like to achieve."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" size="lg" disabled={mutation.isPending} className="w-full sm:w-auto">
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            "Submit enquiry"
          )}
        </Button>
      </form>
    </Form>
  );
}
