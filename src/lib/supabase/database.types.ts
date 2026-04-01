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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      category: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      cefr_level: {
        Row: {
          code: string
          id: string
          order_index: number
        }
        Insert: {
          code: string
          id?: string
          order_index: number
        }
        Update: {
          code?: string
          id?: string
          order_index?: number
        }
        Relationships: []
      }
      language: {
        Row: {
          code: string
          id: string
          name: string
        }
        Insert: {
          code: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      part_of_speech: {
        Row: {
          code: string
          id: string
          name: string
          order_index: number
        }
        Insert: {
          code: string
          id?: string
          name: string
          order_index: number
        }
        Update: {
          code?: string
          id?: string
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      sense: {
        Row: {
          created_at: string
          id: string
          part_of_speech_id: string
          sense_order: number
          word_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          part_of_speech_id: string
          sense_order: number
          word_id: string
        }
        Update: {
          created_at?: string
          id?: string
          part_of_speech_id?: string
          sense_order?: number
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sense_part_of_speech_id_fkey"
            columns: ["part_of_speech_id"]
            isOneToOne: false
            referencedRelation: "part_of_speech"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sense_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      sense_translation: {
        Row: {
          created_at: string
          id: string
          native_language_id: string
          sense_id: string
          translation: string
        }
        Insert: {
          created_at?: string
          id?: string
          native_language_id: string
          sense_id: string
          translation: string
        }
        Update: {
          created_at?: string
          id?: string
          native_language_id?: string
          sense_id?: string
          translation?: string
        }
        Relationships: [
          {
            foreignKeyName: "sense_translation_native_language_id_fkey"
            columns: ["native_language_id"]
            isOneToOne: false
            referencedRelation: "language"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sense_translation_sense_id_fkey"
            columns: ["sense_id"]
            isOneToOne: false
            referencedRelation: "sense"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_example: {
        Row: {
          created_at: string
          example_order: number
          example_text: string
          id: string
          sense_translation_id: string
        }
        Insert: {
          created_at?: string
          example_order: number
          example_text: string
          id?: string
          sense_translation_id: string
        }
        Update: {
          created_at?: string
          example_order?: number
          example_text?: string
          id?: string
          sense_translation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "translation_example_sense_translation_id_fkey"
            columns: ["sense_translation_id"]
            isOneToOne: false
            referencedRelation: "sense_translation"
            referencedColumns: ["id"]
          },
        ]
      }
      user_daily_word: {
        Row: {
          created_at: string
          day_date: string
          id: string
          user_id: string
          word_id: string
        }
        Insert: {
          created_at?: string
          day_date: string
          id?: string
          user_id: string
          word_id: string
        }
        Update: {
          created_at?: string
          day_date?: string
          id?: string
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_daily_word_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profile: {
        Row: {
          created_at: string
          id: string
          last_daily_revision_date: string | null
          learning_language_id: string
          learning_level: string | null
          learning_mode_type: string
          native_language_id: string
          selected_category_id: string | null
        }
        Insert: {
          created_at?: string
          id: string
          last_daily_revision_date?: string | null
          learning_language_id: string
          learning_level?: string | null
          learning_mode_type: string
          native_language_id: string
          selected_category_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_daily_revision_date?: string | null
          learning_language_id?: string
          learning_level?: string | null
          learning_mode_type?: string
          native_language_id?: string
          selected_category_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profile_learning_language_id_fkey"
            columns: ["learning_language_id"]
            isOneToOne: false
            referencedRelation: "language"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profile_native_language_id_fkey"
            columns: ["native_language_id"]
            isOneToOne: false
            referencedRelation: "language"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profile_selected_category_id_fkey"
            columns: ["selected_category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
        ]
      }
      user_word_progress: {
        Row: {
          created_at: string
          id: string
          interval_days: number
          known_at: string | null
          last_review_at: string | null
          next_review_at: string | null
          status: string
          updated_at: string
          user_id: string
          word_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interval_days?: number
          known_at?: string | null
          last_review_at?: string | null
          next_review_at?: string | null
          status: string
          updated_at?: string
          user_id: string
          word_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interval_days?: number
          known_at?: string | null
          last_review_at?: string | null
          next_review_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_word_progress_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      word_category: {
        Row: {
          category_id: string
          created_at: string
          id: string
          word_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          word_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "word_category_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "word_category_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      words: {
        Row: {
          cefr_level_id: string
          created_at: string
          id: string
          ipa: string | null
          is_active: boolean
          lemma: string
          target_language_id: string
          updated_at: string
        }
        Insert: {
          cefr_level_id: string
          created_at?: string
          id?: string
          ipa?: string | null
          is_active?: boolean
          lemma: string
          target_language_id: string
          updated_at?: string
        }
        Update: {
          cefr_level_id?: string
          created_at?: string
          id?: string
          ipa?: string | null
          is_active?: boolean
          lemma?: string
          target_language_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "words_cefr_level_id_fkey"
            columns: ["cefr_level_id"]
            isOneToOne: false
            referencedRelation: "cefr_level"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "words_target_language_id_fkey"
            columns: ["target_language_id"]
            isOneToOne: false
            referencedRelation: "language"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_daily_review_session: {
        Args: { p_word_ids: string[] }
        Returns: Json
      }
      get_daily_review_words: { Args: never; Returns: Json }
      get_daily_word_details: { Args: never; Returns: Json }
      get_library_words: {
        Args: {
          p_category_codes?: string[]
          p_cefr_codes?: string[]
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_sort_known_at?: string
        }
        Returns: Json
      }
      get_onboarding_options: { Args: never; Returns: Json }
      invalidate_today_daily_word: { Args: never; Returns: undefined }
      get_or_create_daily_word: {
        Args: never
        Returns: {
          daily_word_id: string
          day_date: string
          word_id: string
        }[]
      }
      get_quick_practice_words: { Args: { p_limit: number }; Returns: Json }
      get_recently_learned_words: { Args: never; Returns: Json }
      get_revision_hub_stats: { Args: never; Returns: Json }
      get_user_profile_settings: { Args: never; Returns: Json }
      get_word_details: { Args: { p_word_id: string }; Returns: Json }
      mark_word_known: {
        Args: { p_word_id: string }
        Returns: {
          interval_days: number
          known_at: string
          last_review_at: string
          next_review_at: string
          status: string
          user_id: string
          word_id: string
        }[]
      }
      upsert_user_profile_settings: {
        Args: {
          p_learning_language_id: string
          p_learning_level?: string
          p_learning_mode_type: string
          p_native_language_id: string
          p_selected_category_id?: string
        }
        Returns: Json
      }
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
    Enums: {},
  },
} as const
