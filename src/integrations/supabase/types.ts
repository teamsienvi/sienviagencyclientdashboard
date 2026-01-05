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
      client_meta_map: {
        Row: {
          active: boolean
          client_id: string
          created_at: string
          id: string
          ig_business_id: string | null
          mapped_at: string
          page_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_id: string
          created_at?: string
          id?: string
          ig_business_id?: string | null
          mapped_at?: string
          page_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_id?: string
          created_at?: string
          id?: string
          ig_business_id?: string | null
          mapped_at?: string
          page_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_meta_map_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_metricool_config: {
        Row: {
          blog_id: string | null
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          blog_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          blog_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_metricool_config_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_youtube_map: {
        Row: {
          active: boolean
          channel_id: string
          client_id: string
          created_at: string
          id: string
          mapped_at: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          channel_id: string
          client_id: string
          created_at?: string
          id?: string
          mapped_at?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          channel_id?: string
          client_id?: string
          created_at?: string
          id?: string
          mapped_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_youtube_map_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
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
      feature_flags: {
        Row: {
          created_at: string
          flag_name: string
          flag_value: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          flag_name: string
          flag_value?: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          flag_name?: string
          flag_value?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      meta_agency_connection: {
        Row: {
          access_token: string
          connected_at: string
          id: string
          meta_user_id: string
          token_expires_at: string
          updated_at: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          id?: string
          meta_user_id: string
          token_expires_at: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          id?: string
          meta_user_id?: string
          token_expires_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      meta_assets: {
        Row: {
          created_at: string
          discovered_at: string
          id: string
          ig_business_id: string | null
          last_seen_at: string
          name: string
          page_id: string | null
          parent_page_id: string | null
          permalink: string | null
          picture_url: string | null
          platform: string
        }
        Insert: {
          created_at?: string
          discovered_at?: string
          id?: string
          ig_business_id?: string | null
          last_seen_at?: string
          name: string
          page_id?: string | null
          parent_page_id?: string | null
          permalink?: string | null
          picture_url?: string | null
          platform: string
        }
        Update: {
          created_at?: string
          discovered_at?: string
          id?: string
          ig_business_id?: string | null
          last_seen_at?: string
          name?: string
          page_id?: string | null
          parent_page_id?: string | null
          permalink?: string | null
          picture_url?: string | null
          platform?: string
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
          title: string | null
          url: string | null
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
          title?: string | null
          url?: string | null
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
          title?: string | null
          url?: string | null
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
      social_account_metrics: {
        Row: {
          client_id: string
          collected_at: string
          created_at: string
          engagement_rate: number | null
          followers: number | null
          id: string
          new_followers: number | null
          period_end: string
          period_start: string
          platform: Database["public"]["Enums"]["platform_type"]
          social_account_id: string | null
          total_content: number | null
        }
        Insert: {
          client_id: string
          collected_at?: string
          created_at?: string
          engagement_rate?: number | null
          followers?: number | null
          id?: string
          new_followers?: number | null
          period_end: string
          period_start: string
          platform: Database["public"]["Enums"]["platform_type"]
          social_account_id?: string | null
          total_content?: number | null
        }
        Update: {
          client_id?: string
          collected_at?: string
          created_at?: string
          engagement_rate?: number | null
          followers?: number | null
          id?: string
          new_followers?: number | null
          period_end?: string
          period_start?: string
          platform?: Database["public"]["Enums"]["platform_type"]
          social_account_id?: string | null
          total_content?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_account_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_account_metrics_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          access_token_encrypted: string | null
          account_id: string
          account_name: string | null
          client_id: string
          connected_at: string
          created_at: string
          id: string
          is_active: boolean
          platform: Database["public"]["Enums"]["platform_type"]
          refresh_token_encrypted: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted?: string | null
          account_id: string
          account_name?: string | null
          client_id: string
          connected_at?: string
          created_at?: string
          id?: string
          is_active?: boolean
          platform: Database["public"]["Enums"]["platform_type"]
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          account_id?: string
          account_name?: string | null
          client_id?: string
          connected_at?: string
          created_at?: string
          id?: string
          is_active?: boolean
          platform?: Database["public"]["Enums"]["platform_type"]
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      social_content: {
        Row: {
          client_id: string
          content_id: string
          content_type: Database["public"]["Enums"]["social_content_type"]
          created_at: string
          id: string
          platform: Database["public"]["Enums"]["platform_type"]
          published_at: string
          social_account_id: string | null
          title: string | null
          url: string | null
        }
        Insert: {
          client_id: string
          content_id: string
          content_type?: Database["public"]["Enums"]["social_content_type"]
          created_at?: string
          id?: string
          platform: Database["public"]["Enums"]["platform_type"]
          published_at: string
          social_account_id?: string | null
          title?: string | null
          url?: string | null
        }
        Update: {
          client_id?: string
          content_id?: string
          content_type?: Database["public"]["Enums"]["social_content_type"]
          created_at?: string
          id?: string
          platform?: Database["public"]["Enums"]["platform_type"]
          published_at?: string
          social_account_id?: string | null
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_content_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_content_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_content_metrics: {
        Row: {
          click_through_rate: number | null
          collected_at: string
          comments: number | null
          created_at: string
          engagements: number | null
          id: string
          impressions: number | null
          interactions: number | null
          likes: number | null
          link_clicks: number | null
          period_end: string
          period_start: string
          platform: Database["public"]["Enums"]["platform_type"]
          profile_visits: number | null
          reach: number | null
          shares: number | null
          social_content_id: string
          subscribers: number | null
          views: number | null
          watch_time_hours: number | null
        }
        Insert: {
          click_through_rate?: number | null
          collected_at?: string
          comments?: number | null
          created_at?: string
          engagements?: number | null
          id?: string
          impressions?: number | null
          interactions?: number | null
          likes?: number | null
          link_clicks?: number | null
          period_end: string
          period_start: string
          platform: Database["public"]["Enums"]["platform_type"]
          profile_visits?: number | null
          reach?: number | null
          shares?: number | null
          social_content_id: string
          subscribers?: number | null
          views?: number | null
          watch_time_hours?: number | null
        }
        Update: {
          click_through_rate?: number | null
          collected_at?: string
          comments?: number | null
          created_at?: string
          engagements?: number | null
          id?: string
          impressions?: number | null
          interactions?: number | null
          likes?: number | null
          link_clicks?: number | null
          period_end?: string
          period_start?: string
          platform?: Database["public"]["Enums"]["platform_type"]
          profile_visits?: number | null
          reach?: number | null
          shares?: number | null
          social_content_id?: string
          subscribers?: number | null
          views?: number | null
          watch_time_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_content_metrics_social_content_id_fkey"
            columns: ["social_content_id"]
            isOneToOne: false
            referencedRelation: "social_content"
            referencedColumns: ["id"]
          },
        ]
      }
      social_oauth_accounts: {
        Row: {
          access_token: string
          client_id: string
          connected_at: string
          created_at: string
          id: string
          instagram_business_id: string | null
          is_active: boolean
          meta_user_id: string
          page_id: string | null
          platform: string
          refresh_token: string | null
          token_expires_at: string
          updated_at: string
          user_access_token: string | null
        }
        Insert: {
          access_token: string
          client_id: string
          connected_at?: string
          created_at?: string
          id?: string
          instagram_business_id?: string | null
          is_active?: boolean
          meta_user_id: string
          page_id?: string | null
          platform: string
          refresh_token?: string | null
          token_expires_at: string
          updated_at?: string
          user_access_token?: string | null
        }
        Update: {
          access_token?: string
          client_id?: string
          connected_at?: string
          created_at?: string
          id?: string
          instagram_business_id?: string | null
          is_active?: boolean
          meta_user_id?: string
          page_id?: string | null
          platform?: string
          refresh_token?: string | null
          token_expires_at?: string
          updated_at?: string
          user_access_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_oauth_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      social_sync_logs: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          platform: Database["public"]["Enums"]["platform_type"]
          records_synced: number | null
          started_at: string
          status: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          platform: Database["public"]["Enums"]["platform_type"]
          records_synced?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          platform?: Database["public"]["Enums"]["platform_type"]
          records_synced?: number | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_sync_logs_client_id_fkey"
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
      web_analytics_page_views: {
        Row: {
          client_id: string
          created_at: string
          device_type: string | null
          id: string
          page_title: string | null
          page_url: string
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          viewed_at: string
          visitor_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          device_type?: string | null
          id?: string
          page_title?: string | null
          page_url: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          viewed_at?: string
          visitor_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          device_type?: string | null
          id?: string
          page_title?: string | null
          page_url?: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          viewed_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_analytics_page_views_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      web_analytics_sessions: {
        Row: {
          bounce: boolean | null
          client_id: string
          created_at: string
          device_type: string | null
          ended_at: string | null
          id: string
          page_count: number | null
          referrer: string | null
          session_id: string
          started_at: string
          user_agent: string | null
          utm_medium: string | null
          utm_source: string | null
          visitor_id: string
        }
        Insert: {
          bounce?: boolean | null
          client_id: string
          created_at?: string
          device_type?: string | null
          ended_at?: string | null
          id?: string
          page_count?: number | null
          referrer?: string | null
          session_id: string
          started_at?: string
          user_agent?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id: string
        }
        Update: {
          bounce?: boolean | null
          client_id?: string
          created_at?: string
          device_type?: string | null
          ended_at?: string | null
          id?: string
          page_count?: number | null
          referrer?: string | null
          session_id?: string
          started_at?: string
          user_agent?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_analytics_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_assets: {
        Row: {
          channel_id: string
          channel_name: string
          channel_url: string | null
          created_at: string
          discovered_at: string
          id: string
          last_seen_at: string
          subscriber_count: number | null
          thumbnail_url: string | null
          video_count: number | null
        }
        Insert: {
          channel_id: string
          channel_name: string
          channel_url?: string | null
          created_at?: string
          discovered_at?: string
          id?: string
          last_seen_at?: string
          subscriber_count?: number | null
          thumbnail_url?: string | null
          video_count?: number | null
        }
        Update: {
          channel_id?: string
          channel_name?: string
          channel_url?: string | null
          created_at?: string
          discovered_at?: string
          id?: string
          last_seen_at?: string
          subscriber_count?: number | null
          thumbnail_url?: string | null
          video_count?: number | null
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
      platform_type:
        | "instagram"
        | "facebook"
        | "tiktok"
        | "x"
        | "linkedin"
        | "youtube"
      social_content_type:
        | "post"
        | "reel"
        | "video"
        | "short"
        | "tweet"
        | "story"
        | "carousel"
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
      platform_type: [
        "instagram",
        "facebook",
        "tiktok",
        "x",
        "linkedin",
        "youtube",
      ],
      social_content_type: [
        "post",
        "reel",
        "video",
        "short",
        "tweet",
        "story",
        "carousel",
      ],
    },
  },
} as const
