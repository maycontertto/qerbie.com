/**
 * Qerbie — Auto-generated-style Database Types
 *
 * These types mirror the Supabase PostgreSQL schema defined in
 * /integrations/supabase/schema/*.sql
 *
 * Once a live Supabase project is connected you can regenerate
 * this file with:
 *   npx supabase gen types typescript --project-id <id> > src/lib/supabase/database.types.ts
 *
 * Until then these hand-crafted types keep the codebase fully typed.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ── Enums ────────────────────────────────────────────────────

export type MerchantStatus = "active" | "paused" | "disabled";
export type MerchantMemberRole = "admin" | "staff";
export type TableStatus = "available" | "occupied" | "reserved" | "inactive";
export type QueueStatus = "open" | "paused" | "closed";
export type QueueTicketStatus =
  | "waiting"
  | "called"
  | "serving"
  | "completed"
  | "cancelled"
  | "no_show";
export type AppointmentSlotStatus =
  | "available"
  | "pending"
  | "booked"
  | "cancelled";
export type AppointmentRequestStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled";
export type OptionGroupSelectionType = "single" | "multiple";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivered"
  | "completed"
  | "cancelled";
export type OrderType = "dine_in" | "takeaway" | "delivery";

export type HotelReservationStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled";

export type HousekeepingTaskStatus = "open" | "in_progress" | "done" | "cancelled";

export type ExchangeRequestStatus = "open" | "in_progress" | "done" | "cancelled";

export type GymMembershipStatus = "active" | "overdue" | "paused" | "cancelled";

// ── Database interface ───────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      merchants: {
        Row: {
          id: string;
          owner_user_id: string;
          name: string;
          slug: string;
          status: MerchantStatus;
          business_category: string | null;
          brand_display_name: string | null;
          brand_logo_url: string | null;
          brand_primary_color: string | null;
          customer_welcome_message: string | null;
          delivery_enabled: boolean;
          delivery_fee: number | null;
          delivery_note: string | null;
          delivery_eta_minutes: number | null;
          support_whatsapp_url: string | null;
          support_hours: string | null;
          support_email: string | null;
          support_phone: string | null;
          payment_pix_key: string | null;
          payment_pix_description: string | null;
          payment_card_url: string | null;
          payment_card_description: string | null;
          payment_cash_description: string | null;
          payment_disclaimer: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          name: string;
          slug: string;
          status?: MerchantStatus;
          business_category?: string | null;
          brand_display_name?: string | null;
          brand_logo_url?: string | null;
          brand_primary_color?: string | null;
          customer_welcome_message?: string | null;
          delivery_enabled?: boolean;
          delivery_fee?: number | null;
          delivery_note?: string | null;
          delivery_eta_minutes?: number | null;
          support_whatsapp_url?: string | null;
          support_hours?: string | null;
          support_email?: string | null;
          support_phone?: string | null;
          payment_pix_key?: string | null;
          payment_pix_description?: string | null;
          payment_card_url?: string | null;
          payment_card_description?: string | null;
          payment_cash_description?: string | null;
          payment_disclaimer?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          name?: string;
          slug?: string;
          status?: MerchantStatus;
          business_category?: string | null;
          brand_display_name?: string | null;
          brand_logo_url?: string | null;
          brand_primary_color?: string | null;
          customer_welcome_message?: string | null;
          delivery_enabled?: boolean;
          delivery_fee?: number | null;
          delivery_note?: string | null;
          delivery_eta_minutes?: number | null;
          support_whatsapp_url?: string | null;
          support_hours?: string | null;
          support_email?: string | null;
          support_phone?: string | null;
          payment_pix_key?: string | null;
          payment_pix_description?: string | null;
          payment_card_url?: string | null;
          payment_card_description?: string | null;
          payment_cash_description?: string | null;
          payment_disclaimer?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchants_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };

      merchant_members: {
        Row: {
          id: string;
          merchant_id: string;
          user_id: string;
          role: MerchantMemberRole;
          display_name: string | null;
          login: string | null;
          avatar_url: string | null;
          job_title: string | null;
          permissions: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          user_id: string;
          role?: MerchantMemberRole;
          display_name?: string | null;
          login?: string | null;
          avatar_url?: string | null;
          job_title?: string | null;
          permissions?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          user_id?: string;
          role?: MerchantMemberRole;
          display_name?: string | null;
          login?: string | null;
          avatar_url?: string | null;
          job_title?: string | null;
          permissions?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_members_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };

      merchant_subscriptions: {
        Row: {
          merchant_id: string;
          status: string;
          plan_amount_cents: number;
          currency: string;
          trial_ends_at: string;
          current_period_start: string | null;
          current_period_end: string | null;
          grace_until: string | null;
          last_payment_at: string | null;
          last_notice_stage: string | null;
          last_notice_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          merchant_id: string;
          status?: string;
          plan_amount_cents?: number;
          currency?: string;
          trial_ends_at: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          grace_until?: string | null;
          last_payment_at?: string | null;
          last_notice_stage?: string | null;
          last_notice_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          merchant_id?: string;
          status?: string;
          plan_amount_cents?: number;
          currency?: string;
          trial_ends_at?: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          grace_until?: string | null;
          last_payment_at?: string | null;
          last_notice_stage?: string | null;
          last_notice_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_subscriptions_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: true;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      billing_invoices: {
        Row: {
          id: string;
          merchant_id: string;
          amount_cents: number;
          currency: string;
          status: string;
          due_at: string;
          paid_at: string | null;
          provider: string;
          external_reference: string | null;
          provider_preference_id: string | null;
          payment_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          amount_cents: number;
          currency?: string;
          status?: string;
          due_at: string;
          paid_at?: string | null;
          provider?: string;
          external_reference?: string | null;
          provider_preference_id?: string | null;
          payment_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          amount_cents?: number;
          currency?: string;
          status?: string;
          due_at?: string;
          paid_at?: string | null;
          provider?: string;
          external_reference?: string | null;
          provider_preference_id?: string | null;
          payment_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_invoices_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      gym_additional_services: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          price_cents: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name: string;
          price_cents?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string;
          price_cents?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gym_additional_services_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      gym_memberships: {
        Row: {
          id: string;
          merchant_id: string;
          student_id: string;
          plan_id: string | null;
          status: GymMembershipStatus;
          next_due_at: string | null;
          last_paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          student_id: string;
          plan_id?: string | null;
          status?: GymMembershipStatus;
          next_due_at?: string | null;
          last_paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          student_id?: string;
          plan_id?: string | null;
          status?: GymMembershipStatus;
          next_due_at?: string | null;
          last_paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gym_memberships_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gym_memberships_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "gym_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gym_memberships_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "gym_students";
            referencedColumns: ["id"];
          },
        ];
      };

      gym_modalities: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gym_modalities_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      gym_payments: {
        Row: {
          id: string;
          merchant_id: string;
          student_id: string;
          membership_id: string | null;
          amount_cents: number;
          paid_at: string;
          note: string | null;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          student_id: string;
          membership_id?: string | null;
          amount_cents?: number;
          paid_at?: string;
          note?: string | null;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          student_id?: string;
          membership_id?: string | null;
          amount_cents?: number;
          paid_at?: string;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "gym_payments_membership_id_fkey";
            columns: ["membership_id"];
            isOneToOne: false;
            referencedRelation: "gym_memberships";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gym_payments_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gym_payments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "gym_students";
            referencedColumns: ["id"];
          },
        ];
      };

      gym_plans: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          price_cents: number;
          billing_period_months: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name: string;
          price_cents?: number;
          billing_period_months?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string;
          price_cents?: number;
          billing_period_months?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gym_plans_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      gym_qr_tokens: {
        Row: {
          id: string;
          merchant_id: string;
          label: string;
          qr_token: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          label?: string;
          qr_token: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          label?: string;
          qr_token?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gym_qr_tokens_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      gym_students: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          login: string;
          password_hash: string;
          session_token: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name: string;
          login: string;
          password_hash: string;
          session_token?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string;
          login?: string;
          password_hash?: string;
          session_token?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gym_students_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      barbershop_services: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          description: string | null;
          price_cents: number;
          duration_min: number;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name: string;
          description?: string | null;
          price_cents?: number;
          duration_min?: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string;
          description?: string | null;
          price_cents?: number;
          duration_min?: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "barbershop_services_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      barbershop_qr_tokens: {
        Row: {
          id: string;
          merchant_id: string;
          label: string;
          qr_token: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          label?: string;
          qr_token: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          label?: string;
          qr_token?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "barbershop_qr_tokens_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      aesthetic_services: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          description: string | null;
          important_notes: string | null;
          price_cents: number;
          duration_min: number;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name: string;
          description?: string | null;
          important_notes?: string | null;
          price_cents?: number;
          duration_min?: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string;
          description?: string | null;
          important_notes?: string | null;
          price_cents?: number;
          duration_min?: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aesthetic_services_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      aesthetic_qr_tokens: {
        Row: {
          id: string;
          merchant_id: string;
          label: string;
          qr_token: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          label?: string;
          qr_token: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          label?: string;
          qr_token?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aesthetic_qr_tokens_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      aesthetic_queue_services: {
        Row: {
          id: string;
          merchant_id: string;
          queue_id: string;
          service_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          queue_id: string;
          service_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          queue_id?: string;
          service_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aesthetic_queue_services_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "aesthetic_queue_services_queue_id_fkey";
            columns: ["queue_id"];
            isOneToOne: false;
            referencedRelation: "merchant_queues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "aesthetic_queue_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "aesthetic_services";
            referencedColumns: ["id"];
          },
        ];
      };

      beauty_services: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          description: string | null;
          notes: string | null;
          price_cents: number;
          duration_min: number;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name: string;
          description?: string | null;
          notes?: string | null;
          price_cents?: number;
          duration_min?: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string;
          description?: string | null;
          notes?: string | null;
          price_cents?: number;
          duration_min?: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "beauty_services_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      beauty_qr_tokens: {
        Row: {
          id: string;
          merchant_id: string;
          label: string;
          qr_token: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          label?: string;
          qr_token: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          label?: string;
          qr_token?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "beauty_qr_tokens_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      beauty_queue_services: {
        Row: {
          id: string;
          merchant_id: string;
          queue_id: string;
          service_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          queue_id: string;
          service_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          queue_id?: string;
          service_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "beauty_queue_services_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "beauty_queue_services_queue_id_fkey";
            columns: ["queue_id"];
            isOneToOne: false;
            referencedRelation: "merchant_queues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "beauty_queue_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "beauty_services";
            referencedColumns: ["id"];
          },
        ];
      };

      pet_services: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          description: string | null;
          notes: string | null;
          price_cents: number;
          duration_min: number;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name: string;
          description?: string | null;
          notes?: string | null;
          price_cents?: number;
          duration_min?: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string;
          description?: string | null;
          notes?: string | null;
          price_cents?: number;
          duration_min?: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pet_services_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      pet_qr_tokens: {
        Row: {
          id: string;
          merchant_id: string;
          label: string;
          qr_token: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          label?: string;
          qr_token: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          label?: string;
          qr_token?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pet_qr_tokens_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      pet_queue_services: {
        Row: {
          id: string;
          merchant_id: string;
          queue_id: string;
          service_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          queue_id: string;
          service_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          queue_id?: string;
          service_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pet_queue_services_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pet_queue_services_queue_id_fkey";
            columns: ["queue_id"];
            isOneToOne: false;
            referencedRelation: "merchant_queues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pet_queue_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "pet_services";
            referencedColumns: ["id"];
          },
        ];
      };

      pet_profiles: {
        Row: {
          id: string;
          merchant_id: string;
          pet_name: string;
          owner_name: string | null;
          owner_contact: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          pet_name: string;
          owner_name?: string | null;
          owner_contact?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          pet_name?: string;
          owner_name?: string | null;
          owner_contact?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pet_profiles_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      merchant_appointment_slots: {
        Row: {
          id: string;
          merchant_id: string;
          queue_id: string | null;
          starts_at: string;
          ends_at: string;
          status: AppointmentSlotStatus;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          queue_id?: string | null;
          starts_at: string;
          ends_at: string;
          status?: AppointmentSlotStatus;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          queue_id?: string | null;
          starts_at?: string;
          ends_at?: string;
          status?: AppointmentSlotStatus;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_appointment_slots_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_appointment_slots_queue_id_fkey";
            columns: ["queue_id"];
            isOneToOne: false;
            referencedRelation: "merchant_queues";
            referencedColumns: ["id"];
          },
        ];
      };

      merchant_appointment_requests: {
        Row: {
          id: string;
          merchant_id: string;
          slot_id: string;
          queue_id: string | null;
          service_id: string | null;
          aesthetic_service_id: string | null;
          beauty_service_id: string | null;
          pet_service_id: string | null;
          session_token: string;
          customer_name: string | null;
          customer_contact: string | null;
          customer_notes: string | null;
          pet_name: string | null;
          status: AppointmentRequestStatus;
          slot_starts_at: string;
          slot_ends_at: string;
          confirmed_at: string | null;
          declined_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          slot_id: string;
          queue_id?: string | null;
          service_id?: string | null;
          aesthetic_service_id?: string | null;
          beauty_service_id?: string | null;
          pet_service_id?: string | null;
          session_token: string;
          customer_name?: string | null;
          customer_contact?: string | null;
          customer_notes?: string | null;
          pet_name?: string | null;
          status?: AppointmentRequestStatus;
          slot_starts_at: string;
          slot_ends_at: string;
          confirmed_at?: string | null;
          declined_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          slot_id?: string;
          queue_id?: string | null;
          service_id?: string | null;
          aesthetic_service_id?: string | null;
          beauty_service_id?: string | null;
          pet_service_id?: string | null;
          session_token?: string;
          customer_name?: string | null;
          customer_contact?: string | null;
          customer_notes?: string | null;
          pet_name?: string | null;
          status?: AppointmentRequestStatus;
          slot_starts_at?: string;
          slot_ends_at?: string;
          confirmed_at?: string | null;
          declined_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_appointment_requests_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_appointment_requests_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "merchant_appointment_slots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_appointment_requests_queue_id_fkey";
            columns: ["queue_id"];
            isOneToOne: false;
            referencedRelation: "merchant_queues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_appointment_requests_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "barbershop_services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_appointment_requests_aesthetic_service_id_fkey";
            columns: ["aesthetic_service_id"];
            isOneToOne: false;
            referencedRelation: "aesthetic_services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_appointment_requests_beauty_service_id_fkey";
            columns: ["beauty_service_id"];
            isOneToOne: false;
            referencedRelation: "beauty_services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_appointment_requests_pet_service_id_fkey";
            columns: ["pet_service_id"];
            isOneToOne: false;
            referencedRelation: "pet_services";
            referencedColumns: ["id"];
          },
        ];
      };

      merchant_invites: {
        Row: {
          id: string;
          merchant_id: string;
          created_by_user_id: string;
          role: MerchantMemberRole;
          code: string;
          login: string | null;
          display_name: string | null;
          job_title: string | null;
          max_uses: number;
          used_count: number;
          expires_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          created_by_user_id: string;
          role?: MerchantMemberRole;
          code: string;
          login?: string | null;
          display_name?: string | null;
          job_title?: string | null;
          max_uses?: number;
          used_count?: number;
          expires_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          created_by_user_id?: string;
          role?: MerchantMemberRole;
          code?: string;
          login?: string | null;
          display_name?: string | null;
          job_title?: string | null;
          max_uses?: number;
          used_count?: number;
          expires_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_invites_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_invites_created_by_user_id_fkey";
            columns: ["created_by_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };

      menus: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          description: string | null;
          slug: string;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name: string;
          description?: string | null;
          slug: string;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string;
          description?: string | null;
          slug?: string;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menus_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      menu_categories: {
        Row: {
          id: string;
          merchant_id: string;
          menu_id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          menu_id: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          menu_id?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_categories_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_categories_menu_id_fkey";
            columns: ["menu_id"];
            isOneToOne: false;
            referencedRelation: "menus";
            referencedColumns: ["id"];
          },
        ];
      };

      products: {
        Row: {
          id: string;
          merchant_id: string;
          menu_id: string;
          category_id: string | null;
          name: string;
          description: string | null;
          image_url: string | null;
          price: number;
          is_active: boolean;
          is_featured: boolean;
          requires_prescription: boolean;
          requires_document: boolean;
          track_stock: boolean;
          stock_quantity: number;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          menu_id: string;
          category_id?: string | null;
          name: string;
          description?: string | null;
          image_url?: string | null;
          price?: number;
          is_active?: boolean;
          is_featured?: boolean;
          requires_prescription?: boolean;
          requires_document?: boolean;
          track_stock?: boolean;
          stock_quantity?: number;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          menu_id?: string;
          category_id?: string | null;
          name?: string;
          description?: string | null;
          image_url?: string | null;
          price?: number;
          is_active?: boolean;
          is_featured?: boolean;
          requires_prescription?: boolean;
          requires_document?: boolean;
          track_stock?: boolean;
          stock_quantity?: number;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_menu_id_fkey";
            columns: ["menu_id"];
            isOneToOne: false;
            referencedRelation: "menus";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "menu_categories";
            referencedColumns: ["id"];
          },
        ];
      };

      product_option_groups: {
        Row: {
          id: string;
          merchant_id: string;
          product_id: string;
          name: string;
          selection_type: OptionGroupSelectionType;
          is_required: boolean;
          min_selections: number;
          max_selections: number;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          product_id: string;
          name: string;
          selection_type?: OptionGroupSelectionType;
          is_required?: boolean;
          min_selections?: number;
          max_selections?: number;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          product_id?: string;
          name?: string;
          selection_type?: OptionGroupSelectionType;
          is_required?: boolean;
          min_selections?: number;
          max_selections?: number;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_option_groups_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_option_groups_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };

      product_options: {
        Row: {
          id: string;
          merchant_id: string;
          option_group_id: string;
          name: string;
          price_modifier: number;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          option_group_id: string;
          name: string;
          price_modifier?: number;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          option_group_id?: string;
          name?: string;
          price_modifier?: number;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_options_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_options_option_group_id_fkey";
            columns: ["option_group_id"];
            isOneToOne: false;
            referencedRelation: "product_option_groups";
            referencedColumns: ["id"];
          },
        ];
      };

      merchant_tables: {
        Row: {
          id: string;
          merchant_id: string;
          label: string;
          qr_token: string;
          status: TableStatus;
          capacity: number;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          label: string;
          qr_token: string;
          status?: TableStatus;
          capacity?: number;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          label?: string;
          qr_token?: string;
          status?: TableStatus;
          capacity?: number;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_tables_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      merchant_queues: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          status: QueueStatus;
          is_active: boolean;
          avg_service_min: number | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name: string;
          status?: QueueStatus;
          is_active?: boolean;
          avg_service_min?: number | null;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string;
          status?: QueueStatus;
          is_active?: boolean;
          avg_service_min?: number | null;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_queues_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      queue_tickets: {
        Row: {
          id: string;
          merchant_id: string;
          queue_id: string;
          ticket_number: number;
          status: QueueTicketStatus;
          customer_name: string | null;
          service_id: string | null;
          aesthetic_service_id: string | null;
          beauty_service_id: string | null;
          pet_service_id: string | null;
          pet_name: string | null;
          called_at: string | null;
          served_at: string | null;
          completed_at: string | null;
          created_at: string;
          created_day: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          queue_id: string;
          ticket_number: number;
          status?: QueueTicketStatus;
          customer_name?: string | null;
          service_id?: string | null;
          aesthetic_service_id?: string | null;
          beauty_service_id?: string | null;
          pet_service_id?: string | null;
          pet_name?: string | null;
          called_at?: string | null;
          served_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_day?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          queue_id?: string;
          ticket_number?: number;
          status?: QueueTicketStatus;
          customer_name?: string | null;
          service_id?: string | null;
          aesthetic_service_id?: string | null;
          beauty_service_id?: string | null;
          pet_service_id?: string | null;
          pet_name?: string | null;
          called_at?: string | null;
          served_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_day?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "queue_tickets_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "queue_tickets_queue_id_fkey";
            columns: ["queue_id"];
            isOneToOne: false;
            referencedRelation: "merchant_queues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "queue_tickets_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "barbershop_services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "queue_tickets_aesthetic_service_id_fkey";
            columns: ["aesthetic_service_id"];
            isOneToOne: false;
            referencedRelation: "aesthetic_services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "queue_tickets_beauty_service_id_fkey";
            columns: ["beauty_service_id"];
            isOneToOne: false;
            referencedRelation: "beauty_services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "queue_tickets_pet_service_id_fkey";
            columns: ["pet_service_id"];
            isOneToOne: false;
            referencedRelation: "pet_services";
            referencedColumns: ["id"];
          },
        ];
      };

      orders: {
        Row: {
          id: string;
          merchant_id: string;
          table_id: string | null;
          order_number: number;
          session_token: string;
          order_type: OrderType;
          status: OrderStatus;
          customer_name: string | null;
          customer_notes: string | null;
          subtotal: number;
          discount: number;
          total: number;
          delivery_address: string | null;
          delivery_fee: number | null;
          delivery_eta_minutes: number | null;
          confirmed_at: string | null;
          ready_at: string | null;
          delivered_at: string | null;
          completed_at: string | null;
          completed_by_user_id: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          created_at: string;
          created_day: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          table_id?: string | null;
          order_number: number;
          session_token: string;
          order_type?: OrderType;
          status?: OrderStatus;
          customer_name?: string | null;
          customer_notes?: string | null;
          subtotal?: number;
          discount?: number;
          total?: number;
          delivery_address?: string | null;
          delivery_fee?: number | null;
          delivery_eta_minutes?: number | null;
          confirmed_at?: string | null;
          ready_at?: string | null;
          delivered_at?: string | null;
          completed_at?: string | null;
          completed_by_user_id?: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
          created_at?: string;
          created_day?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          table_id?: string | null;
          order_number?: number;
          session_token?: string;
          order_type?: OrderType;
          status?: OrderStatus;
          customer_name?: string | null;
          customer_notes?: string | null;
          subtotal?: number;
          discount?: number;
          total?: number;
          delivery_address?: string | null;
          delivery_fee?: number | null;
          delivery_eta_minutes?: number | null;
          confirmed_at?: string | null;
          ready_at?: string | null;
          delivered_at?: string | null;
          completed_at?: string | null;
          completed_by_user_id?: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
          created_at?: string;
          created_day?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "merchant_tables";
            referencedColumns: ["id"];
          },
        ];
      };

      merchant_hotel_room_types: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          description: string | null;
          capacity: number;
          base_price: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name: string;
          description?: string | null;
          capacity?: number;
          base_price?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string;
          description?: string | null;
          capacity?: number;
          base_price?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_hotel_room_types_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      merchant_hotel_rate_plans: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          description: string | null;
          includes_breakfast: boolean;
          nightly_price: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name: string;
          description?: string | null;
          includes_breakfast?: boolean;
          nightly_price?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string;
          description?: string | null;
          includes_breakfast?: boolean;
          nightly_price?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_hotel_rate_plans_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      merchant_exchange_requests: {
        Row: {
          id: string;
          merchant_id: string;
          order_id: string | null;
          customer_name: string | null;
          contact: string | null;
          reason: string | null;
          notes: string | null;
          status: ExchangeRequestStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          order_id?: string | null;
          customer_name?: string | null;
          contact?: string | null;
          reason?: string | null;
          notes?: string | null;
          status?: ExchangeRequestStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          order_id?: string | null;
          customer_name?: string | null;
          contact?: string | null;
          reason?: string | null;
          notes?: string | null;
          status?: ExchangeRequestStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_exchange_requests_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_exchange_requests_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };

      merchant_hotel_services: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          description: string | null;
          price: number | null;
          is_active: boolean;
          track_stock: boolean;
          stock_quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name: string;
          description?: string | null;
          price?: number | null;
          is_active?: boolean;
          track_stock?: boolean;
          stock_quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string;
          description?: string | null;
          price?: number | null;
          is_active?: boolean;
          track_stock?: boolean;
          stock_quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_hotel_services_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      merchant_hotel_guests: {
        Row: {
          id: string;
          merchant_id: string;
          full_name: string;
          phone: string | null;
          email: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          full_name: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          full_name?: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_hotel_guests_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };

      merchant_hotel_reservations: {
        Row: {
          id: string;
          merchant_id: string;
          guest_id: string;
          room_type_id: string;
          rate_plan_id: string | null;
          check_in_date: string;
          check_out_date: string;
          status: HotelReservationStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          guest_id: string;
          room_type_id: string;
          rate_plan_id?: string | null;
          check_in_date: string;
          check_out_date: string;
          status?: HotelReservationStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          guest_id?: string;
          room_type_id?: string;
          rate_plan_id?: string | null;
          check_in_date?: string;
          check_out_date?: string;
          status?: HotelReservationStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_hotel_reservations_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_hotel_reservations_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "merchant_hotel_guests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_hotel_reservations_room_type_id_fkey";
            columns: ["room_type_id"];
            isOneToOne: false;
            referencedRelation: "merchant_hotel_room_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_hotel_reservations_rate_plan_id_fkey";
            columns: ["rate_plan_id"];
            isOneToOne: false;
            referencedRelation: "merchant_hotel_rate_plans";
            referencedColumns: ["id"];
          },
        ];
      };

      merchant_hotel_housekeeping_tasks: {
        Row: {
          id: string;
          merchant_id: string;
          reservation_id: string | null;
          title: string;
          due_date: string | null;
          status: HousekeepingTaskStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          reservation_id?: string | null;
          title: string;
          due_date?: string | null;
          status?: HousekeepingTaskStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          reservation_id?: string | null;
          title?: string;
          due_date?: string | null;
          status?: HousekeepingTaskStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_hotel_housekeeping_tasks_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_hotel_housekeeping_tasks_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "merchant_hotel_reservations";
            referencedColumns: ["id"];
          },
        ];
      };

      order_items: {
        Row: {
          id: string;
          merchant_id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          options_total: number;
          line_total: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          quantity?: number;
          unit_price: number;
          options_total?: number;
          line_total: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          unit_price?: number;
          options_total?: number;
          line_total?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };

      order_item_options: {
        Row: {
          id: string;
          merchant_id: string;
          order_item_id: string;
          option_id: string | null;
          option_group_name: string;
          option_name: string;
          price_modifier: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          order_item_id: string;
          option_id?: string | null;
          option_group_name: string;
          option_name: string;
          price_modifier?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          order_item_id?: string;
          option_id?: string | null;
          option_group_name?: string;
          option_name?: string;
          price_modifier?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_item_options_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_item_options_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_item_options_option_id_fkey";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "product_options";
            referencedColumns: ["id"];
          },
        ];
      };
    };

    Views: Record<string, never>;

    Functions: {
      is_merchant_owner: {
        Args: { p_merchant_id: string };
        Returns: boolean;
      };
      is_merchant_member: {
        Args: { p_merchant_id: string };
        Returns: boolean;
      };
      has_merchant_access: {
        Args: { p_merchant_id: string };
        Returns: boolean;
      };
      redeem_merchant_invite: {
        Args: { p_code: string };
        Returns: string;
      };
      has_member_permission: {
        Args: { p_merchant_id: string; p_perm: string };
        Returns: boolean;
      };
    };

    Enums: {
      merchant_status: MerchantStatus;
      merchant_member_role: MerchantMemberRole;
      table_status: TableStatus;
      queue_status: QueueStatus;
      queue_ticket_status: QueueTicketStatus;
      option_group_selection_type: OptionGroupSelectionType;
      order_status: OrderStatus;
      order_type: OrderType;
      hotel_reservation_status: HotelReservationStatus;
      housekeeping_task_status: HousekeepingTaskStatus;
      exchange_request_status: ExchangeRequestStatus;
    };

    CompositeTypes: Record<string, never>;
  };
}

// ── Convenience aliases ──────────────────────────────────────

type PublicSchema = Database["public"];
type Tables = PublicSchema["Tables"];

/** Shorthand: get the Row type for any table. */
export type Row<T extends keyof Tables> = Tables[T]["Row"];

/** Shorthand: get the Insert type for any table. */
export type InsertRow<T extends keyof Tables> = Tables[T]["Insert"];

/** Shorthand: get the Update type for any table. */
export type UpdateRow<T extends keyof Tables> = Tables[T]["Update"];
