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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          mode: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          prompt: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          prompt: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          prompt?: string
          user_id?: string
        }
        Relationships: []
      }
      models: {
        Row: {
          category: string
          created_at: string
          enabled: boolean
          endpoint: string | null
          estimated_compute_cost: number
          id: string
          key: string
          memory_requirement: string | null
          model_id: string
          name: string
          notes: string | null
          parameter_count: string | null
          precision: string | null
          priority: number
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          enabled?: boolean
          endpoint?: string | null
          estimated_compute_cost?: number
          id?: string
          key: string
          memory_requirement?: string | null
          model_id: string
          name: string
          notes?: string | null
          parameter_count?: string | null
          precision?: string | null
          priority?: number
          provider?: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          enabled?: boolean
          endpoint?: string | null
          estimated_compute_cost?: number
          id?: string
          key?: string
          memory_requirement?: string | null
          model_id?: string
          name?: string
          notes?: string | null
          parameter_count?: string | null
          precision?: string | null
          priority?: number
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          goals: string | null
          id: string
          onboarded: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          goals?: string | null
          id?: string
          onboarded?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          goals?: string | null
          id?: string
          onboarded?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      routing_logs: {
        Row: {
          category: string
          context_messages: number | null
          created_at: string
          error: string | null
          estimated_compute: number | null
          fallback_from: string | null
          fallback_used: boolean
          id: string
          latency_ms: number | null
          model_id: string
          model_key: string
          prompt_chars: number | null
          router_confidence: number | null
          router_reason: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          context_messages?: number | null
          created_at?: string
          error?: string | null
          estimated_compute?: number | null
          fallback_from?: string | null
          fallback_used?: boolean
          id?: string
          latency_ms?: number | null
          model_id: string
          model_key: string
          prompt_chars?: number | null
          router_confidence?: number | null
          router_reason?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          context_messages?: number | null
          created_at?: string
          error?: string | null
          estimated_compute?: number | null
          fallback_from?: string | null
          fallback_used?: boolean
          id?: string
          latency_ms?: number | null
          model_id?: string
          model_key?: string
          prompt_chars?: number | null
          router_confidence?: number | null
          router_reason?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      usage_metrics: {
        Row: {
          category: string | null
          completion_tokens: number | null
          created_at: string
          estimated_compute: number | null
          id: string
          latency_ms: number | null
          measured_energy_wh: number | null
          model_key: string
          prompt_tokens: number | null
          routing_log_id: string | null
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          completion_tokens?: number | null
          created_at?: string
          estimated_compute?: number | null
          id?: string
          latency_ms?: number | null
          measured_energy_wh?: number | null
          model_key: string
          prompt_tokens?: number | null
          routing_log_id?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          completion_tokens?: number | null
          created_at?: string
          estimated_compute?: number | null
          id?: string
          latency_ms?: number | null
          measured_energy_wh?: number | null
          model_key?: string
          prompt_tokens?: number | null
          routing_log_id?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_metrics_routing_log_id_fkey"
            columns: ["routing_log_id"]
            isOneToOne: false
            referencedRelation: "routing_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          default_personality: string
          id: string
          learning_level: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_personality?: string
          id?: string
          learning_level?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_personality?: string
          id?: string
          learning_level?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
