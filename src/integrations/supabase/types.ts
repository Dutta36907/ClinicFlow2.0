export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      appointments: {
        Row: {
          clinic_id: string;
          consent_at: string | null;
          created_at: string;
          created_by_user_id: string | null;
          doctor_id: string;
          duration_minutes: number;
          id: string;
          notes: string | null;
          patient_email: string | null;
          patient_name: string;
          patient_phone: string;
          scheduled_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          updated_at: string;
        };
        Insert: {
          clinic_id: string;
          consent_at?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
          doctor_id: string;
          duration_minutes?: number;
          id?: string;
          notes?: string | null;
          patient_email?: string | null;
          patient_name: string;
          patient_phone: string;
          scheduled_at: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
        };
        Update: {
          clinic_id?: string;
          consent_at?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
          doctor_id?: string;
          duration_minutes?: number;
          id?: string;
          notes?: string | null;
          patient_email?: string | null;
          patient_name?: string;
          patient_phone?: string;
          scheduled_at?: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey";
            columns: ["doctor_id"];
            isOneToOne: false;
            referencedRelation: "doctors";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_user_id: string | null;
          clinic_id: string | null;
          created_at: string;
          id: string;
          metadata: Json | null;
          target_id: string | null;
          target_type: string | null;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          clinic_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          target_id?: string | null;
          target_type?: string | null;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          clinic_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          target_id?: string | null;
          target_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      clinic_gallery: {
        Row: {
          caption: string | null;
          clinic_id: string;
          created_at: string;
          display_order: number;
          id: string;
          image_url: string;
        };
        Insert: {
          caption?: string | null;
          clinic_id: string;
          created_at?: string;
          display_order?: number;
          id?: string;
          image_url: string;
        };
        Update: {
          caption?: string | null;
          clinic_id?: string;
          created_at?: string;
          display_order?: number;
          id?: string;
          image_url?: string;
        };
        Relationships: [];
      };
      clinic_testimonials: {
        Row: {
          clinic_id: string;
          created_at: string;
          display_order: number;
          id: string;
          is_featured: boolean;
          patient_name: string;
          photo_url: string | null;
          quote: string;
          rating: number;
          review_date: string | null;
        };
        Insert: {
          clinic_id: string;
          created_at?: string;
          display_order?: number;
          id?: string;
          is_featured?: boolean;
          patient_name: string;
          photo_url?: string | null;
          quote: string;
          rating: number;
          review_date?: string | null;
        };
        Update: {
          clinic_id?: string;
          created_at?: string;
          display_order?: number;
          id?: string;
          is_featured?: boolean;
          patient_name?: string;
          photo_url?: string | null;
          quote?: string;
          rating?: number;
          review_date?: string | null;
        };
        Relationships: [];
      };
      clinic_treatments: {
        Row: {
          clinic_id: string;
          created_at: string;
          description: string | null;
          display_order: number;
          icon: string | null;
          id: string;
          is_active: boolean;
          title: string;
        };
        Insert: {
          clinic_id: string;
          created_at?: string;
          description?: string | null;
          display_order?: number;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          title: string;
        };
        Update: {
          clinic_id?: string;
          created_at?: string;
          description?: string | null;
          display_order?: number;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          title?: string;
        };
        Relationships: [];
      };
      clinics: {
        Row: {
          address: string | null;
          appointment_duration_minutes: number;
          cover_image_url: string | null;
          created_at: string;
          description: string | null;
          email: string | null;
          expires_at: string | null;
          google_map_url: string | null;
          id: string;
          is_active: boolean;
          logo_url: string | null;
          name: string;
          notify_clinic_new_booking_email: boolean;
          notify_clinic_new_booking_sms: boolean;
          notify_email: boolean;
          notify_patient_booking_email: boolean;
          notify_patient_booking_sms: boolean;
          notify_patient_booking_whatsapp: boolean;
          notify_patient_reschedule_email: boolean;
          notify_patient_reschedule_sms: boolean;
          notify_patient_reschedule_whatsapp: boolean;
          notify_sms: boolean;
          notify_whatsapp: boolean;
          performance_stats: Json;
          phone: string | null;
          plan: string | null;
          slug: string;
          tagline: string | null;
          timezone: string;
          trial_ends_at: string | null;
          website: string | null;
          whatsapp: string | null;
          working_hours: Json;
        };
        Insert: {
          address?: string | null;
          appointment_duration_minutes?: number;
          cover_image_url?: string | null;
          created_at?: string;
          description?: string | null;
          email?: string | null;
          expires_at?: string | null;
          google_map_url?: string | null;
          id?: string;
          is_active?: boolean;
          logo_url?: string | null;
          name: string;
          notify_clinic_new_booking_email?: boolean;
          notify_clinic_new_booking_sms?: boolean;
          notify_email?: boolean;
          notify_patient_booking_email?: boolean;
          notify_patient_booking_sms?: boolean;
          notify_patient_booking_whatsapp?: boolean;
          notify_patient_reschedule_email?: boolean;
          notify_patient_reschedule_sms?: boolean;
          notify_patient_reschedule_whatsapp?: boolean;
          notify_sms?: boolean;
          notify_whatsapp?: boolean;
          performance_stats?: Json;
          phone?: string | null;
          plan?: string | null;
          slug: string;
          tagline?: string | null;
          timezone?: string;
          trial_ends_at?: string | null;
          website?: string | null;
          whatsapp?: string | null;
          working_hours?: Json;
        };
        Update: {
          address?: string | null;
          appointment_duration_minutes?: number;
          cover_image_url?: string | null;
          created_at?: string;
          description?: string | null;
          email?: string | null;
          expires_at?: string | null;
          google_map_url?: string | null;
          id?: string;
          is_active?: boolean;
          logo_url?: string | null;
          name?: string;
          notify_clinic_new_booking_email?: boolean;
          notify_clinic_new_booking_sms?: boolean;
          notify_email?: boolean;
          notify_patient_booking_email?: boolean;
          notify_patient_booking_sms?: boolean;
          notify_patient_booking_whatsapp?: boolean;
          notify_patient_reschedule_email?: boolean;
          notify_patient_reschedule_sms?: boolean;
          notify_patient_reschedule_whatsapp?: boolean;
          notify_sms?: boolean;
          notify_whatsapp?: boolean;
          performance_stats?: Json;
          phone?: string | null;
          plan?: string | null;
          slug?: string;
          tagline?: string | null;
          timezone?: string;
          trial_ends_at?: string | null;
          website?: string | null;
          whatsapp?: string | null;
          working_hours?: Json;
        };
        Relationships: [];
      };
      doctor_schedules: {
        Row: {
          created_at: string;
          doctor_id: string;
          end_time: string;
          id: string;
          is_active: boolean;
          start_time: string;
          weekday: number;
        };
        Insert: {
          created_at?: string;
          doctor_id: string;
          end_time: string;
          id?: string;
          is_active?: boolean;
          start_time: string;
          weekday: number;
        };
        Update: {
          created_at?: string;
          doctor_id?: string;
          end_time?: string;
          id?: string;
          is_active?: boolean;
          start_time?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "doctor_schedules_doctor_id_fkey";
            columns: ["doctor_id"];
            isOneToOne: false;
            referencedRelation: "doctors";
            referencedColumns: ["id"];
          },
        ];
      };
      doctor_slot_overrides: {
        Row: {
          created_at: string;
          date: string;
          doctor_id: string;
          end_time: string | null;
          id: string;
          is_blocked: boolean;
          reason: string | null;
          start_time: string | null;
        };
        Insert: {
          created_at?: string;
          date: string;
          doctor_id: string;
          end_time?: string | null;
          id?: string;
          is_blocked?: boolean;
          reason?: string | null;
          start_time?: string | null;
        };
        Update: {
          created_at?: string;
          date?: string;
          doctor_id?: string;
          end_time?: string | null;
          id?: string;
          is_blocked?: boolean;
          reason?: string | null;
          start_time?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "doctor_slot_overrides_doctor_id_fkey";
            columns: ["doctor_id"];
            isOneToOne: false;
            referencedRelation: "doctors";
            referencedColumns: ["id"];
          },
        ];
      };
      doctors: {
        Row: {
          appointment_duration_minutes: number;
          clinic_id: string;
          created_at: string;
          degree: string | null;
          description: string | null;
          id: string;
          is_active: boolean;
          languages: string[] | null;
          name: string;
          photo_url: string | null;
          specialization: string | null;
          specialties: string[] | null;
          years_experience: number | null;
        };
        Insert: {
          appointment_duration_minutes?: number;
          clinic_id: string;
          created_at?: string;
          degree?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          languages?: string[] | null;
          name: string;
          photo_url?: string | null;
          specialization?: string | null;
          specialties?: string[] | null;
          years_experience?: number | null;
        };
        Update: {
          appointment_duration_minutes?: number;
          clinic_id?: string;
          created_at?: string;
          degree?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          languages?: string[] | null;
          name?: string;
          photo_url?: string | null;
          specialization?: string | null;
          specialties?: string[] | null;
          years_experience?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "doctors_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      email_send_log: {
        Row: {
          clinic_id: string | null;
          created_at: string;
          error: string | null;
          event_type: string;
          id: string;
          idempotency_key: string;
          metadata: Json;
          provider_message_id: string | null;
          recipient_email: string;
          sent_at: string | null;
          status: string;
        };
        Insert: {
          clinic_id?: string | null;
          created_at?: string;
          error?: string | null;
          event_type: string;
          id?: string;
          idempotency_key: string;
          metadata?: Json;
          provider_message_id?: string | null;
          recipient_email: string;
          sent_at?: string | null;
          status?: string;
        };
        Update: {
          clinic_id?: string | null;
          created_at?: string;
          error?: string | null;
          event_type?: string;
          id?: string;
          idempotency_key?: string;
          metadata?: Json;
          provider_message_id?: string | null;
          recipient_email?: string;
          sent_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_send_log_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      enquiries: {
        Row: {
          assigned_to: string | null;
          company_name: string | null;
          created_at: string;
          email: string;
          enquiry_type: string;
          full_name: string;
          id: string;
          message: string | null;
          phone: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          company_name?: string | null;
          created_at?: string;
          email: string;
          enquiry_type: string;
          full_name: string;
          id?: string;
          message?: string | null;
          phone: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          company_name?: string | null;
          created_at?: string;
          email?: string;
          enquiry_type?: string;
          full_name?: string;
          id?: string;
          message?: string | null;
          phone?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_log: {
        Row: {
          channel: string;
          clinic_id: string | null;
          created_at: string;
          error_message: string | null;
          event_type: string;
          id: string;
          metadata: Json | null;
          provider: string | null;
          provider_msg_id: string | null;
          recipient_email: string | null;
          recipient_phone: string | null;
          skip_reason: string | null;
          status: string;
        };
        Insert: {
          channel: string;
          clinic_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          event_type: string;
          id?: string;
          metadata?: Json | null;
          provider?: string | null;
          provider_msg_id?: string | null;
          recipient_email?: string | null;
          recipient_phone?: string | null;
          skip_reason?: string | null;
          status?: string;
        };
        Update: {
          channel?: string;
          clinic_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          event_type?: string;
          id?: string;
          metadata?: Json | null;
          provider?: string | null;
          provider_msg_id?: string | null;
          recipient_email?: string | null;
          recipient_phone?: string | null;
          skip_reason?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_log_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      patient_otp: {
        Row: {
          attempts: number;
          code_hash: string;
          consumed_at: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          method: string;
          phone: string;
          session_id_hash: string | null;
        };
        Insert: {
          attempts?: number;
          code_hash: string;
          consumed_at?: string | null;
          created_at?: string;
          expires_at: string;
          id?: string;
          method?: string;
          phone: string;
          session_id_hash?: string | null;
        };
        Update: {
          attempts?: number;
          code_hash?: string;
          consumed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          method?: string;
          phone?: string;
          session_id_hash?: string | null;
        };
        Relationships: [];
      };
      platform_settings: {
        Row: {
          email: Json;
          general: Json;
          id: string;
          notifications: Json;
          sms: Json;
          updated_at: string;
          updated_by: string | null;
          whatsapp: Json;
        };
        Insert: {
          email?: Json;
          general?: Json;
          id?: string;
          notifications?: Json;
          sms?: Json;
          updated_at?: string;
          updated_by?: string | null;
          whatsapp?: Json;
        };
        Update: {
          email?: Json;
          general?: Json;
          id?: string;
          notifications?: Json;
          sms?: Json;
          updated_at?: string;
          updated_by?: string | null;
          whatsapp?: Json;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          phone?: string | null;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
        };
        Relationships: [];
      };
      rate_limit_buckets: {
        Row: {
          key: string;
          refilled_at: string;
          tokens: number;
        };
        Insert: {
          key: string;
          refilled_at?: string;
          tokens: number;
        };
        Update: {
          key?: string;
          refilled_at?: string;
          tokens?: number;
        };
        Relationships: [];
      };
      role_templates: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          is_system: boolean;
          name: string;
          permissions: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          name: string;
          permissions?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          name?: string;
          permissions?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      security_scan_findings: {
        Row: {
          category: string;
          check_id: string;
          created_at: string;
          detail: Json;
          evidence: Json;
          id: string;
          run_id: string;
          severity: string;
          status: string;
          title: string;
        };
        Insert: {
          category: string;
          check_id: string;
          created_at?: string;
          detail?: Json;
          evidence?: Json;
          id?: string;
          run_id: string;
          severity: string;
          status: string;
          title: string;
        };
        Update: {
          category?: string;
          check_id?: string;
          created_at?: string;
          detail?: Json;
          evidence?: Json;
          id?: string;
          run_id?: string;
          severity?: string;
          status?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "security_scan_findings_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "security_scan_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      security_scan_runs: {
        Row: {
          commit_sha: string | null;
          errored: number;
          failed: number;
          finished_at: string | null;
          id: string;
          passed: number;
          started_at: string;
          status: string;
          total: number;
          trigger: string;
          warned: number;
        };
        Insert: {
          commit_sha?: string | null;
          errored?: number;
          failed?: number;
          finished_at?: string | null;
          id?: string;
          passed?: number;
          started_at?: string;
          status?: string;
          total?: number;
          trigger: string;
          warned?: number;
        };
        Update: {
          commit_sha?: string | null;
          errored?: number;
          failed?: number;
          finished_at?: string | null;
          id?: string;
          passed?: number;
          started_at?: string;
          status?: string;
          total?: number;
          trigger?: string;
          warned?: number;
        };
        Relationships: [];
      };
      super_admin_permissions: {
        Row: {
          can_appointments: boolean;
          can_audit: boolean;
          can_clinic_settings: boolean;
          can_clinics: boolean;
          can_customers: boolean;
          can_dashboard: boolean;
          can_doctors: boolean;
          can_enquiries: boolean;
          can_monitoring: boolean;
          can_subscriptions: boolean;
          can_user_roles: boolean;
          can_users: boolean;
          created_at: string;
          is_disabled: boolean;
          phone: string | null;
          role_template_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          can_appointments?: boolean;
          can_audit?: boolean;
          can_clinic_settings?: boolean;
          can_clinics?: boolean;
          can_customers?: boolean;
          can_dashboard?: boolean;
          can_doctors?: boolean;
          can_enquiries?: boolean;
          can_monitoring?: boolean;
          can_subscriptions?: boolean;
          can_user_roles?: boolean;
          can_users?: boolean;
          created_at?: string;
          is_disabled?: boolean;
          phone?: string | null;
          role_template_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          can_appointments?: boolean;
          can_audit?: boolean;
          can_clinic_settings?: boolean;
          can_clinics?: boolean;
          can_customers?: boolean;
          can_dashboard?: boolean;
          can_doctors?: boolean;
          can_enquiries?: boolean;
          can_monitoring?: boolean;
          can_subscriptions?: boolean;
          can_user_roles?: boolean;
          can_users?: boolean;
          created_at?: string;
          is_disabled?: boolean;
          phone?: string | null;
          role_template_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      system_alerts: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          level: string;
          resolved_at: string | null;
          resolved_by: string | null;
          source: string | null;
          title: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          level: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          source?: string | null;
          title: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          level?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          source?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          clinic_id: string | null;
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          clinic_id?: string | null;
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          clinic_id?: string | null;
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      appt_time_range: {
        Args: { _mins: number; _scheduled: string };
        Returns: unknown;
      };
      bootstrap_first_super_admin: {
        Args: { _email: string; _user_id: string };
        Returns: Json;
      };
      consume_rate_limit: {
        Args: { _capacity: number; _key: string; _refill_seconds: number };
        Returns: boolean;
      };
      get_emails_for_ids: {
        Args: { _ids: string[] };
        Returns: {
          email: string;
          id: string;
        }[];
      };
      get_rls_status: {
        Args: never;
        Returns: {
          rowsecurity: boolean;
          tablename: string;
        }[];
      };
      get_user_auth_context: {
        Args: { _uid: string };
        Returns: {
          clinic_ids: string[];
          is_disabled: boolean;
          is_super: boolean;
        }[];
      };
      get_user_id_by_email: { Args: { _email: string }; Returns: string };
      has_clinic_role: {
        Args: {
          _clinic_id: string;
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_clinic_member: {
        Args: { _clinic_id: string; _user_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "super_admin" | "clinic_manager" | "clinic_user";
      appointment_status: "pending" | "confirmed" | "rescheduled" | "cancelled" | "completed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "clinic_manager", "clinic_user"],
      appointment_status: ["pending", "confirmed", "rescheduled", "cancelled", "completed"],
    },
  },
} as const;
