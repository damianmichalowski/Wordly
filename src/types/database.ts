export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      languages: {
        Row: {
          code: string;
          name: string;
        };
        Insert: {
          code: string;
          name: string;
        };
        Update: Partial<{ name: string }>;
        Relationships: [];
      };
      decks: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          sort_order: number;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string | null;
          sort_order?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          slug: string;
          title: string;
          description: string | null;
          sort_order: number;
          is_published: boolean;
          updated_at: string;
        }>;
        Relationships: [];
      };
      deck_words: {
        Row: {
          deck_id: string;
          word_id: string;
          sort_order: number;
        };
        Insert: {
          deck_id: string;
          word_id: string;
          sort_order?: number;
        };
        Update: Partial<{ sort_order: number }>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          source_language_code: string;
          target_language_code: string;
          current_level: string;
          configured_display_level: string;
          display_level_policy: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_language_code: string;
          target_language_code: string;
          current_level: string;
          configured_display_level: string;
          display_level_policy?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          source_language_code: string;
          target_language_code: string;
          current_level: string;
          configured_display_level: string;
          display_level_policy: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      vocabulary_words: {
        Row: {
          id: string;
          source_language_code: string;
          target_language_code: string;
          source_text: string;
          target_text: string;
          example_source: string | null;
          example_target: string | null;
          cefr_level: string;
          pronunciation_text: string | null;
          audio_url: string | null;
          category: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_language_code: string;
          target_language_code: string;
          source_text: string;
          target_text: string;
          example_source?: string | null;
          example_target?: string | null;
          cefr_level: string;
          pronunciation_text?: string | null;
          audio_url?: string | null;
          category?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          example_source: string | null;
          example_target: string | null;
          pronunciation_text: string | null;
          audio_url: string | null;
          category: string | null;
          updated_at: string;
        }>;
        Relationships: [];
      };
      user_word_progress: {
        Row: {
          id: string;
          user_id: string;
          word_id: string;
          status: string;
          first_seen_at: string | null;
          marked_known_at: string | null;
          last_reviewed_at: string | null;
          next_review_at: string | null;
          review_count: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          word_id: string;
          status?: string;
          first_seen_at?: string | null;
          marked_known_at?: string | null;
          last_reviewed_at?: string | null;
          next_review_at?: string | null;
          review_count?: number;
        };
        Update: Partial<{
          status: string;
          first_seen_at: string | null;
          marked_known_at: string | null;
          last_reviewed_at: string | null;
          next_review_at: string | null;
          review_count: number;
        }>;
        Relationships: [];
      };
      daily_word_state: {
        Row: {
          id: string;
          user_id: string;
          active_word_id: string | null;
          active_date: string | null;
          state_version: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          active_word_id?: string | null;
          active_date?: string | null;
          state_version?: number;
          updated_at?: string;
        };
        Update: Partial<{
          active_word_id: string | null;
          active_date: string | null;
          state_version: number;
          updated_at: string;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
