export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      escrow_payments: {
        Row: {
          admin_resolution: string | null
          admin_resolution_note: string | null
          amount: number
          auto_release_at: string | null
          callback_received_at: string | null
          commission_amount: number
          commission_rate: number
          created_at: string | null
          dispute_evidence_urls: string[] | null
          dispute_reason: string | null
          external_id: string
          freemopay_reference: string | null
          id: string
          mission_id: string
          payer_id: string
          payer_phone: string | null
          provider_amount: number
          refunded_at: string | null
          released_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          admin_resolution?: string | null
          admin_resolution_note?: string | null
          amount: number
          auto_release_at?: string | null
          callback_received_at?: string | null
          commission_amount?: number
          commission_rate?: number
          created_at?: string | null
          dispute_evidence_urls?: string[] | null
          dispute_reason?: string | null
          external_id: string
          freemopay_reference?: string | null
          id?: string
          mission_id: string
          payer_id: string
          payer_phone?: string | null
          provider_amount?: number
          refunded_at?: string | null
          released_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          admin_resolution?: string | null
          admin_resolution_note?: string | null
          amount?: number
          auto_release_at?: string | null
          callback_received_at?: string | null
          commission_amount?: number
          commission_rate?: number
          created_at?: string | null
          dispute_evidence_urls?: string[] | null
          dispute_reason?: string | null
          external_id?: string
          freemopay_reference?: string | null
          id?: string
          mission_id?: string
          payer_id?: string
          payer_phone?: string | null
          provider_amount?: number
          refunded_at?: string | null
          released_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escrow_payments_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string | null
          id: string
          provider_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          provider_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          provider_id?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          has_image: boolean | null
          id: string
          image_url: string | null
          is_read: boolean | null
          mission_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          has_image?: boolean | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          mission_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          has_image?: boolean | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          mission_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          category_id: string | null
          city: string | null
          client_confirmed_at: string | null
          client_id: string
          commission_rate: number | null
          completed_at: string | null
          created_at: string | null
          deposit_amount: number | null
          deposit_percentage: number | null
          description: string | null
          id: string
          invoice_description: string | null
          is_urgent: boolean | null
          provider_confirmed_at: string | null
          provider_id: string | null
          quarter: string | null
          status: Database["public"]["Enums"]["mission_status"] | null
          title: string
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          city?: string | null
          client_confirmed_at?: string | null
          client_id: string
          commission_rate?: number | null
          completed_at?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          deposit_percentage?: number | null
          description?: string | null
          id?: string
          invoice_description?: string | null
          is_urgent?: boolean | null
          provider_confirmed_at?: string | null
          provider_id?: string | null
          quarter?: string | null
          status?: Database["public"]["Enums"]["mission_status"] | null
          title: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          city?: string | null
          client_confirmed_at?: string | null
          client_id?: string
          commission_rate?: number | null
          completed_at?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          deposit_percentage?: number | null
          description?: string | null
          id?: string
          invoice_description?: string | null
          is_urgent?: boolean | null
          provider_confirmed_at?: string | null
          provider_id?: string | null
          quarter?: string | null
          status?: Database["public"]["Enums"]["mission_status"] | null
          title?: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      mobile_money_transfers: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string | null
          error_message: string | null
          escrow_id: string | null
          id: string
          mission_id: string | null
          name_on_account: string | null
          operator: string | null
          phone: string
          processed_at: string | null
          status: string
          transfer_type: string | null
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string | null
          error_message?: string | null
          escrow_id?: string | null
          id?: string
          mission_id?: string | null
          name_on_account?: string | null
          operator?: string | null
          phone: string
          processed_at?: string | null
          status?: string
          transfer_type?: string | null
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string | null
          error_message?: string | null
          escrow_id?: string | null
          id?: string
          mission_id?: string | null
          name_on_account?: string | null
          operator?: string | null
          phone?: string
          processed_at?: string | null
          status?: string
          transfer_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobile_money_transfers_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          mission_id: string | null
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          mission_id?: string | null
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          mission_id?: string | null
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_reviews_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          availability: string | null
          avatar_url: string | null
          avg_response_time_minutes: number | null
          badges: string[] | null
          bio: string | null
          can_travel: boolean | null
          city: string | null
          client_score: number | null
          created_at: string | null
          full_name: string
          gallery: string[] | null
          id: string
          indicative_price: string | null
          intervention_zones: string[] | null
          is_premium: boolean | null
          is_provider: boolean | null
          is_verified: boolean | null
          last_seen_at: string | null
          latitude: number | null
          longitude: number | null
          mobile_money_phone: string | null
          phone: string | null
          phone_verified: boolean | null
          pricing_type: string | null
          provider_categories: string[] | null
          quarter: string | null
          reliability_score: number | null
          skills: string[] | null
          subscription_type: string | null
          updated_at: string | null
          user_id: string
          verification_level: number | null
          welcome_message: string | null
          years_of_experience: number | null
        }
        Insert: {
          availability?: string | null
          avatar_url?: string | null
          avg_response_time_minutes?: number | null
          badges?: string[] | null
          bio?: string | null
          can_travel?: boolean | null
          city?: string | null
          client_score?: number | null
          created_at?: string | null
          full_name?: string
          gallery?: string[] | null
          id?: string
          indicative_price?: string | null
          intervention_zones?: string[] | null
          is_premium?: boolean | null
          is_provider?: boolean | null
          is_verified?: boolean | null
          last_seen_at?: string | null
          latitude?: number | null
          longitude?: number | null
          mobile_money_phone?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          pricing_type?: string | null
          provider_categories?: string[] | null
          quarter?: string | null
          reliability_score?: number | null
          skills?: string[] | null
          subscription_type?: string | null
          updated_at?: string | null
          user_id: string
          verification_level?: number | null
          welcome_message?: string | null
          years_of_experience?: number | null
        }
        Update: {
          availability?: string | null
          avatar_url?: string | null
          avg_response_time_minutes?: number | null
          badges?: string[] | null
          bio?: string | null
          can_travel?: boolean | null
          city?: string | null
          client_score?: number | null
          created_at?: string | null
          full_name?: string
          gallery?: string[] | null
          id?: string
          indicative_price?: string | null
          intervention_zones?: string[] | null
          is_premium?: boolean | null
          is_provider?: boolean | null
          is_verified?: boolean | null
          last_seen_at?: string | null
          latitude?: number | null
          longitude?: number | null
          mobile_money_phone?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          pricing_type?: string | null
          provider_categories?: string[] | null
          quarter?: string | null
          reliability_score?: number | null
          skills?: string[] | null
          subscription_type?: string | null
          updated_at?: string | null
          user_id?: string
          verification_level?: number | null
          welcome_message?: string | null
          years_of_experience?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_note: string | null
          created_at: string | null
          details: string | null
          id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          admin_note?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          reason: string
          reported_user_id: string
          reporter_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          admin_note?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          mission_id: string | null
          rating: number
          reviewed_id: string
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          mission_id?: string | null
          rating: number
          reviewed_id: string
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          mission_id?: string | null
          rating?: number
          reviewed_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          created_at: string | null
          email: string
          id: string
          message: string
          name: string
          status: string
          subject: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string | null
          email: string
          id?: string
          message: string
          name: string
          status?: string
          subject: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          admin_reply?: string | null
          created_at?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          status?: string
          subject?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          mission_id: string | null
          status: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          mission_id?: string | null
          status?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          mission_id?: string | null
          status?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          badge_icon: string
          badge_key: string
          badge_label: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_icon?: string
          badge_key: string
          badge_label: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_icon?: string
          badge_key?: string
          badge_label?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_requests: {
        Row: {
          created_at: string | null
          id: string
          id_document_url: string | null
          identity_match: boolean | null
          level: number
          phone_number: string | null
          phone_verified: boolean | null
          rejection_reason: string | null
          selfie_url: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          id_document_url?: string | null
          identity_match?: boolean | null
          level?: number
          phone_number?: string | null
          phone_verified?: boolean | null
          rejection_reason?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          id_document_url?: string | null
          identity_match?: boolean | null
          level?: number
          phone_number?: string | null
          phone_verified?: boolean | null
          rejection_reason?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number | null
          created_at: string | null
          currency: string | null
          id: string
          pending_balance: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          pending_balance?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          pending_balance?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "client" | "provider" | "both" | "admin"
      mission_status:
        | "pending"
        | "accepted"
        | "in_progress"
        | "completed"
        | "disputed"
        | "cancelled"
      transaction_type:
        | "deposit"
        | "withdrawal"
        | "escrow_hold"
        | "escrow_release"
        | "commission"
        | "refund"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["client", "provider", "both", "admin"],
      mission_status: [
        "pending",
        "accepted",
        "in_progress",
        "completed",
        "disputed",
        "cancelled",
      ],
      transaction_type: [
        "deposit",
        "withdrawal",
        "escrow_hold",
        "escrow_release",
        "commission",
        "refund",
      ],
    },
  },
} as const
