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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          api_key: string | null
          created_at: string
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          supabase_url: string | null
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          supabase_url?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          supabase_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_content: {
        Row: {
          click_through_rate: number | null
          comments: number | null
          content_type: string
          created_at: string
          duration: string | null
          engagements: number | null
          id: string
          impressions: number | null
          interactions: number | null
          likes: number | null
          link_clicks: number | null
          platform_data_id: string
          played_to_watch_percent: number | null
          post_date: string
          profile_visits: number | null
          reach: number | null
          shares: number | null
          subscribers: number | null
          views: number | null
          watch_time_hours: number | null
        }
        Insert: {
          click_through_rate?: number | null
          comments?: number | null
          content_type: string
          created_at?: string
          duration?: string | null
          engagements?: number | null
          id?: string
          impressions?: number | null
          interactions?: number | null
          likes?: number | null
          link_clicks?: number | null
          platform_data_id: string
          played_to_watch_percent?: number | null
          post_date: string
          profile_visits?: number | null
          reach?: number | null
          shares?: number | null
          subscribers?: number | null
          views?: number | null
          watch_time_hours?: number | null
        }
        Update: {
          click_through_rate?: number | null
          comments?: number | null
          content_type?: string
          created_at?: string
          duration?: string | null
          engagements?: number | null
          id?: string
          impressions?: number | null
          interactions?: number | null
          likes?: number | null
          link_clicks?: number | null
          platform_data_id?: string
          played_to_watch_percent?: number | null
          post_date?: string
          profile_visits?: number | null
          reach?: number | null
          shares?: number | null
          subscribers?: number | null
          views?: number | null
          watch_time_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_content_platform_data_id_fkey"
            columns: ["platform_data_id"]
            isOneToOne: false
            referencedRelation: "platform_data"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_data: {
        Row: {
          created_at: string
          engagement_rate: number | null
          followers: number
          id: string
          last_week_engagement_rate: number | null
          last_week_total_content: number | null
          new_followers: number | null
          platform: string
          report_id: string
          total_content: number | null
        }
        Insert: {
          created_at?: string
          engagement_rate?: number | null
          followers?: number
          id?: string
          last_week_engagement_rate?: number | null
          last_week_total_content?: number | null
          new_followers?: number | null
          platform: string
          report_id: string
          total_content?: number | null
        }
        Update: {
          created_at?: string
          engagement_rate?: number | null
          followers?: number
          id?: string
          last_week_engagement_rate?: number | null
          last_week_total_content?: number | null
          new_followers?: number | null
          platform?: string
          report_id?: string
          total_content?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_data_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          client_id: string
          created_at: string
          date_range: string
          id: string
          updated_at: string
          week_end: string
          week_start: string
        }
        Insert: {
          client_id: string
          created_at?: string
          date_range: string
          id?: string
          updated_at?: string
          week_end: string
          week_start: string
        }
        Update: {
          client_id?: string
          created_at?: string
          date_range?: string
          id?: string
          updated_at?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      top_performing_posts: {
        Row: {
          created_at: string
          engagement_percent: number
          engagement_tier: string | null
          followers: number
          id: string
          influence: number | null
          link: string
          platform: string
          reach_tier: string | null
          report_id: string
          views: number
        }
        Insert: {
          created_at?: string
          engagement_percent?: number
          engagement_tier?: string | null
          followers?: number
          id?: string
          influence?: number | null
          link: string
          platform: string
          reach_tier?: string | null
          report_id: string
          views?: number
        }
        Update: {
          created_at?: string
          engagement_percent?: number
          engagement_tier?: string | null
          followers?: number
          id?: string
          influence?: number | null
          link?: string
          platform?: string
          reach_tier?: string | null
          report_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "top_performing_posts_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
