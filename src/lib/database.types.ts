/**
 * Database types for the Tips Recognition Layer (Sprint 01).
 *
 * Hand-written to match supabase/migrations/0001_recognition_layer.sql.
 * Once the Supabase project is linked you can regenerate this file with:
 *   npx supabase gen types typescript --linked > src/lib/database.types.ts
 */

export type RestaurantStatus = "active" | "inactive" | "archived";
export type StaffStatus = "active" | "inactive" | "archived";
export type NfcTagStatus = "active" | "inactive";
export type VisitSource = "nfc" | "reward_redemption" | "manual";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";
export type RecognitionSource = "nfc" | "qr" | "manual";
export type ReviewRoute = "public_review" | "private_feedback";
export type ReviewStatus = "pending" | "completed" | "ignored";
export type GuestSource = "recognition" | "manual" | "import";
export type RewardType =
  | "cashback_percentage"
  | "cashback_fixed"
  | "free_item"
  | "special_benefit";
export type RewardSource =
  | "recognition"
  | "review"
  | "first_visit"
  | "vip"
  | "manual";
export type RewardStatus = "active" | "claimed" | "expired";
export type TemplateStatus = "active" | "inactive";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string;
          owner_id: string | null;
          name: string;
          slug: string;
          logo_url: string | null;
          email: string | null;
          phone: string | null;
          status: RestaurantStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string | null;
          name: string;
          slug: string;
          logo_url?: string | null;
          email?: string | null;
          phone?: string | null;
          status?: RestaurantStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["restaurants"]["Insert"]>;
        Relationships: [];
      };
      staff: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          photo_url: string | null;
          role: string | null;
          email: string | null;
          phone: string | null;
          status: StaffStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          name: string;
          photo_url?: string | null;
          role?: string | null;
          email?: string | null;
          phone?: string | null;
          status?: StaffStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff"]["Insert"]>;
        Relationships: [];
      };
      nfc_tags: {
        Row: {
          id: string;
          staff_id: string;
          nfc_code: string;
          status: NfcTagStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          nfc_code: string;
          status?: NfcTagStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["nfc_tags"]["Insert"]>;
        Relationships: [];
      };
      visits: {
        Row: {
          id: string;
          restaurant_id: string;
          staff_id: string;
          source: VisitSource;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          staff_id: string;
          source?: VisitSource;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["visits"]["Insert"]>;
        Relationships: [];
      };
      tips: {
        Row: {
          id: string;
          staff_id: string;
          guest_id: string | null;
          amount: number;
          currency: string;
          payment_status: PaymentStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          guest_id?: string | null;
          amount: number;
          currency?: string;
          payment_status?: PaymentStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tips"]["Insert"]>;
        Relationships: [];
      };
      ratings: {
        Row: {
          id: string;
          staff_id: string;
          guest_id: string | null;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          guest_id?: string | null;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ratings"]["Insert"]>;
        Relationships: [];
      };
      recognition_events: {
        Row: {
          id: string;
          restaurant_id: string;
          staff_id: string;
          guest_id: string | null;
          tip_id: string | null;
          rating_id: string | null;
          source: RecognitionSource;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          staff_id: string;
          guest_id?: string | null;
          tip_id?: string | null;
          rating_id?: string | null;
          source?: RecognitionSource;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["recognition_events"]["Insert"]
        >;
        Relationships: [];
      };
      review_requests: {
        Row: {
          id: string;
          recognition_event_id: string;
          restaurant_id: string;
          staff_id: string;
          route: ReviewRoute;
          status: ReviewStatus;
          feedback: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          recognition_event_id: string;
          restaurant_id: string;
          staff_id: string;
          route: ReviewRoute;
          status?: ReviewStatus;
          feedback?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["review_requests"]["Insert"]
        >;
        Relationships: [];
      };
      guests: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string | null;
          email: string | null;
          phone: string | null;
          source: GuestSource;
          marketing_consent: boolean;
          last_staff_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          name?: string | null;
          email?: string | null;
          phone?: string | null;
          source?: GuestSource;
          marketing_consent?: boolean;
          last_staff_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guests"]["Insert"]>;
        Relationships: [];
      };
      reward_templates: {
        Row: {
          id: string;
          restaurant_id: string;
          title: string;
          reward_type: RewardType;
          value: number;
          expiration_days: number;
          status: TemplateStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          title: string;
          reward_type: RewardType;
          value?: number;
          expiration_days?: number;
          status?: TemplateStatus;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["reward_templates"]["Insert"]
        >;
        Relationships: [];
      };
      rewards: {
        Row: {
          id: string;
          guest_id: string;
          restaurant_id: string;
          template_id: string | null;
          title: string;
          reward_type: RewardType;
          value: number;
          source: RewardSource;
          status: RewardStatus;
          expiration_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          guest_id: string;
          restaurant_id: string;
          template_id?: string | null;
          title: string;
          reward_type: RewardType;
          value?: number;
          source?: RewardSource;
          status?: RewardStatus;
          expiration_date: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rewards"]["Insert"]>;
        Relationships: [];
      };
      reward_claims: {
        Row: {
          id: string;
          reward_id: string;
          guest_id: string;
          restaurant_id: string;
          claimed_at: string;
        };
        Insert: {
          id?: string;
          reward_id: string;
          guest_id: string;
          restaurant_id: string;
          claimed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reward_claims"]["Insert"]>;
        Relationships: [];
      };
      return_visits: {
        Row: {
          id: string;
          guest_id: string;
          reward_id: string | null;
          restaurant_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          guest_id: string;
          reward_id?: string | null;
          restaurant_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["return_visits"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
