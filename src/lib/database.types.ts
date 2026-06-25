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
export type WalletProvider = "web" | "apple" | "google";
export type WalletPassStatus = "created" | "active" | "redeemed" | "expired";
export type Role = "owner" | "manager" | "staff";
export type NfcInventoryStatus =
  | "stock"
  | "assigned"
  | "lost"
  | "damaged"
  | "archived";
export type NfcEventType =
  | "created"
  | "assigned"
  | "replaced"
  | "unassigned"
  | "lost"
  | "damaged"
  | "archived";
export type ImportStatus = "previewed" | "completed" | "failed";
export type ImportRowAction = "create" | "update" | "skip" | "invalid";

export type EmailTemplateStatus = "draft" | "active" | "archived";
export type EmailLogStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "skipped";
export type EmailEventType =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained";

export type CampaignChannel = "email" | "whatsapp";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "completed"
  | "archived";
export type CampaignRecipientStatus =
  | "pending"
  | "delivered"
  | "opened"
  | "clicked"
  | "failed"
  | "skipped";
export type ConversionType =
  | "reward_claim"
  | "return_visit"
  | "review"
  | "recognition";

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
          phone_normalized: string | null;
          country_code: string | null;
          source: GuestSource;
          marketing_consent: boolean;
          last_staff_id: string | null;
          birth_date: string | null;
          metadata: Json | null;
          last_campaign_id: string | null;
          last_campaign_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          name?: string | null;
          email?: string | null;
          phone?: string | null;
          phone_normalized?: string | null;
          country_code?: string | null;
          source?: GuestSource;
          marketing_consent?: boolean;
          last_staff_id?: string | null;
          birth_date?: string | null;
          metadata?: Json | null;
          last_campaign_id?: string | null;
          last_campaign_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guests"]["Insert"]>;
        Relationships: [];
      };
      guest_notes: {
        Row: {
          id: string;
          guest_id: string;
          restaurant_id: string;
          body: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          guest_id: string;
          restaurant_id: string;
          body: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guest_notes"]["Insert"]>;
        Relationships: [];
      };
      guest_tags: {
        Row: {
          id: string;
          guest_id: string;
          restaurant_id: string;
          tag: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          guest_id: string;
          restaurant_id: string;
          tag: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guest_tags"]["Insert"]>;
        Relationships: [];
      };
      guest_imports: {
        Row: {
          id: string;
          restaurant_id: string;
          filename: string | null;
          source: string | null;
          status: ImportStatus;
          total_rows: number;
          created_count: number;
          updated_count: number;
          skipped_count: number;
          created_by: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          filename?: string | null;
          source?: string | null;
          status?: ImportStatus;
          total_rows?: number;
          created_count?: number;
          updated_count?: number;
          skipped_count?: number;
          created_by?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["guest_imports"]["Insert"]>;
        Relationships: [];
      };
      guest_import_rows: {
        Row: {
          id: string;
          import_id: string;
          restaurant_id: string;
          row_number: number;
          raw: Json | null;
          mapped: Json | null;
          action: ImportRowAction;
          matched_guest_id: string | null;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          import_id: string;
          restaurant_id: string;
          row_number: number;
          raw?: Json | null;
          mapped?: Json | null;
          action?: ImportRowAction;
          matched_guest_id?: string | null;
          error?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["guest_import_rows"]["Insert"]
        >;
        Relationships: [];
      };
      import_logs: {
        Row: {
          id: string;
          import_id: string;
          restaurant_id: string;
          level: "info" | "warn" | "error";
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          import_id: string;
          restaurant_id: string;
          level?: "info" | "warn" | "error";
          message: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["import_logs"]["Insert"]>;
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
      wallet_passes: {
        Row: {
          id: string;
          guest_id: string;
          reward_id: string;
          restaurant_id: string;
          wallet_provider: WalletProvider;
          wallet_pass_url: string | null;
          pass_identifier: string;
          qr_code: string | null;
          status: WalletPassStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          guest_id: string;
          reward_id: string;
          restaurant_id: string;
          wallet_provider?: WalletProvider;
          wallet_pass_url?: string | null;
          pass_identifier: string;
          qr_code?: string | null;
          status?: WalletPassStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["wallet_passes"]["Insert"]>;
        Relationships: [];
      };
      restaurant_members: {
        Row: {
          id: string;
          restaurant_id: string;
          user_id: string;
          role: Role;
          staff_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          user_id: string;
          role: Role;
          staff_id?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["restaurant_members"]["Insert"]
        >;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          restaurant_id: string | null;
          user_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id?: string | null;
          user_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
        Relationships: [];
      };
      restaurant_settings: {
        Row: {
          id: string;
          restaurant_id: string;
          google_place_id: string | null;
          google_review_url: string | null;
          sender_name: string | null;
          sender_email: string | null;
          reply_to_email: string | null;
          email_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          google_place_id?: string | null;
          google_review_url?: string | null;
          sender_name?: string | null;
          sender_email?: string | null;
          reply_to_email?: string | null;
          email_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["restaurant_settings"]["Insert"]
        >;
        Relationships: [];
      };
      email_templates: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          subject: string;
          body: string;
          status: EmailTemplateStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          name: string;
          subject: string;
          body: string;
          status?: EmailTemplateStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["email_templates"]["Insert"]
        >;
        Relationships: [];
      };
      email_logs: {
        Row: {
          id: string;
          restaurant_id: string;
          guest_id: string | null;
          template_id: string | null;
          recipient_email: string;
          subject: string;
          status: EmailLogStatus;
          provider_message_id: string | null;
          error_message: string | null;
          retry_count: number;
          last_attempt_at: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          guest_id?: string | null;
          template_id?: string | null;
          recipient_email: string;
          subject: string;
          status?: EmailLogStatus;
          provider_message_id?: string | null;
          error_message?: string | null;
          retry_count?: number;
          last_attempt_at?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_logs"]["Insert"]>;
        Relationships: [];
      };
      email_events: {
        Row: {
          id: string;
          restaurant_id: string;
          guest_id: string | null;
          email_log_id: string;
          event_type: EmailEventType;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          guest_id?: string | null;
          email_log_id: string;
          event_type: EmailEventType;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_events"]["Insert"]>;
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          description: string | null;
          channel: CampaignChannel;
          segment: string;
          template_id: string | null;
          status: CampaignStatus;
          attribution_window_days: number;
          audience_count: number;
          estimated_revenue: number;
          attributed_rewards: number;
          attributed_return_visits: number;
          attributed_recognitions: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          name: string;
          description?: string | null;
          channel?: CampaignChannel;
          segment: string;
          template_id?: string | null;
          status?: CampaignStatus;
          attribution_window_days?: number;
          audience_count?: number;
          estimated_revenue?: number;
          attributed_rewards?: number;
          attributed_return_visits?: number;
          attributed_recognitions?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          sent_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["campaigns"]["Insert"]>;
        Relationships: [];
      };
      campaign_audiences: {
        Row: {
          id: string;
          campaign_id: string;
          guest_id: string;
          segment_snapshot: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          guest_id: string;
          segment_snapshot?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_audiences"]["Insert"]
        >;
        Relationships: [];
      };
      campaign_recipients: {
        Row: {
          id: string;
          campaign_id: string;
          guest_id: string;
          channel: CampaignChannel;
          status: CampaignRecipientStatus;
          email_log_id: string | null;
          reason: string | null;
          delivered_at: string | null;
          opened_at: string | null;
          clicked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          guest_id: string;
          channel?: CampaignChannel;
          status?: CampaignRecipientStatus;
          email_log_id?: string | null;
          reason?: string | null;
          delivered_at?: string | null;
          opened_at?: string | null;
          clicked_at?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_recipients"]["Insert"]
        >;
        Relationships: [];
      };
      campaign_conversions: {
        Row: {
          id: string;
          restaurant_id: string;
          campaign_id: string;
          guest_id: string;
          conversion_type: ConversionType;
          conversion_date: string;
          source_event_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          campaign_id: string;
          guest_id: string;
          conversion_type: ConversionType;
          conversion_date: string;
          source_event_id?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_conversions"]["Insert"]
        >;
        Relationships: [];
      };
      connections: {
        Row: {
          id: string;
          restaurant_id: string;
          provider: string;
          category: string;
          status: string;
          sandbox: boolean;
          credentials_ref: string | null;
          credentials_meta: Json;
          capabilities: Json;
          last_sync: string | null;
          next_sync: string | null;
          last_error: string | null;
          health: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          provider: string;
          category: string;
          status?: string;
          sandbox?: boolean;
          credentials_ref?: string | null;
          credentials_meta?: Json;
          capabilities?: Json;
          last_sync?: string | null;
          next_sync?: string | null;
          last_error?: string | null;
          health?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["connections"]["Insert"]>;
        Relationships: [];
      };
      sync_jobs: {
        Row: {
          id: string;
          restaurant_id: string;
          connection_id: string | null;
          provider: string;
          direction: string;
          status: string;
          rows_processed: number;
          duration_ms: number | null;
          error: string | null;
          retry_count: number;
          started_at: string | null;
          finished_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          connection_id?: string | null;
          provider: string;
          direction?: string;
          status?: string;
          rows_processed?: number;
          duration_ms?: number | null;
          error?: string | null;
          retry_count?: number;
          started_at?: string | null;
          finished_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sync_jobs"]["Insert"]>;
        Relationships: [];
      };
      integration_events: {
        Row: {
          id: string;
          restaurant_id: string;
          type: string;
          source: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          type: string;
          source?: string;
          payload?: Json;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["integration_events"]["Insert"]
        >;
        Relationships: [];
      };
      nfc_inventory: {
        Row: {
          id: string;
          restaurant_id: string;
          serial_number: string;
          uid: string;
          status: NfcInventoryStatus;
          assigned_staff_id: string | null;
          assigned_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          serial_number: string;
          uid: string;
          status?: NfcInventoryStatus;
          assigned_staff_id?: string | null;
          assigned_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["nfc_inventory"]["Insert"]
        >;
        Relationships: [];
      };
      nfc_events: {
        Row: {
          id: string;
          nfc_id: string;
          restaurant_id: string;
          staff_id: string | null;
          event: NfcEventType;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nfc_id: string;
          restaurant_id: string;
          staff_id?: string | null;
          event: NfcEventType;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["nfc_events"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
