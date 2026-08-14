/**
 * useClinicAppointments — the single source of truth for appointment data
 * across the clinic manager dashboard.
 *
 * Every section (Dashboard stats, Appointments list, Overview tiles, sidebar
 * counter) reads from this hook so the numbers and rows displayed are always
 * consistent. Filtering (status / doctor / date / range) is applied
 * client-side by the consumer.
 *
 * One realtime subscription per clinic invalidates this cache when any
 * appointment row changes.
 */

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { AppointmentRow } from "../types";
import chimeAsset from "@/assets/sounds/new-appointment.mp3.asset.json";

export const clinicAppointmentsKey = (clinicId: string | null | undefined) =>
  ["mgr-appts", clinicId] as const;

const MUTE_KEY = "mgr-mute";

function isMuted() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function playChime() {
  if (typeof window === "undefined" || isMuted()) return;
  try {
    const audio = new Audio(chimeAsset.url);
    audio.volume = 0.6;
    void audio.play().catch(() => {
      /* autoplay blocked — ignore */
    });
  } catch {
    /* ignore */
  }
}

export function useClinicAppointments(clinicId: string | null | undefined) {
  const qc = useQueryClient();
  // Tracks whether the realtime subscription has fully attached. Inserts
  // received before this point are part of the initial backlog and must
  // not trigger a chime.
  const armedRef = useRef(false);

  const query = useQuery({
    queryKey: clinicAppointmentsKey(clinicId),
    enabled: !!clinicId,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, patient_name, patient_phone, patient_email, scheduled_at, status, doctor_id, notes, created_at",
        )
        .eq("clinic_id", clinicId!)
        .order("scheduled_at", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as AppointmentRow[];
    },
  });

  useEffect(() => {
    if (!clinicId) return;
    armedRef.current = false;
    const suffix =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    const channel = supabase.channel(`mgr-appts-${clinicId}-${suffix}`);
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `clinic_id=eq.${clinicId}`,
        },
        (payload) => {
          qc.invalidateQueries({ queryKey: clinicAppointmentsKey(clinicId) });
          qc.invalidateQueries({ queryKey: ["mgr-appts-page", clinicId] });

          if (payload.eventType === "INSERT" && armedRef.current) {
            const row = payload.new as Partial<AppointmentRow> | null;
            playChime();
            toast.success(`New booking${row?.patient_name ? ` — ${row.patient_name}` : ""}`, {
              description: row?.scheduled_at
                ? new Date(row.scheduled_at).toLocaleString()
                : undefined,
            });
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Small delay to ignore any backlog flush right after subscribe.
          setTimeout(() => {
            armedRef.current = true;
          }, 400);
        }
      });
    return () => {
      armedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [clinicId, qc]);

  return query;
}

/** Invalidate the shared appointments cache (use after mutations). */
export function invalidateClinicAppointments(
  qc: ReturnType<typeof useQueryClient>,
  clinicId: string,
) {
  qc.invalidateQueries({ queryKey: clinicAppointmentsKey(clinicId) });
  qc.invalidateQueries({ queryKey: ["mgr-appts-page", clinicId] });
}
