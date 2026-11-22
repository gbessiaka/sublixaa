
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_generations": {
                  Row: {
                    "client_id": string | null,"cost_usd": number | null,"created_at": string,"error": string | null,"id": string,"input_tokens": number,"kind": string,"model": string,"output_tokens": number,"owner_id": string,"post_id": string | null,"provider": string,"strategy_id": string | null,"success": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id"?: string | null,"cost_usd"?: number | null,"created_at"?: string,"error"?: string | null,"id"?: string,"input_tokens"?: number,"kind": string,"model": string,"output_tokens"?: number,"owner_id"?: string,"post_id"?: string | null,"provider": string,"strategy_id"?: string | null,"success"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: string | null,"cost_usd"?: number | null,"created_at"?: string,"error"?: string | null,"id"?: string,"input_tokens"?: number,"kind"?: string,"model"?: string,"output_tokens"?: number,"owner_id"?: string,"post_id"?: string | null,"provider"?: string,"strategy_id"?: string | null,"success"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_generations_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_generations_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_generations_strategy_id_fkey"
      columns: ["strategy_id"]
isOneToOne: false
      referencedRelation: "strategies"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "archived_at": string | null,"brand_colors": Json | null,"created_at": string,"description": string | null,"examples": (string)[],"goals": string | null,"hashtags": (string)[],"id": string,"industry": string | null,"language": string,"logo_url": string | null,"name": string,"owner_id": string,"products": string | null,"target_audience": string | null,"tone": string | null,"updated_at": string,"words_to_avoid": (string)[],"words_to_use": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"brand_colors"?: Json | null,"created_at"?: string,"description"?: string | null,"examples"?: (string)[],"goals"?: string | null,"hashtags"?: (string)[],"id"?: string,"industry"?: string | null,"language"?: string,"logo_url"?: string | null,"name": string,"owner_id"?: string,"products"?: string | null,"target_audience"?: string | null,"tone"?: string | null,"updated_at"?: string,"words_to_avoid"?: (string)[],"words_to_use"?: (string)[]
                  }
                  Update: {
                    "archived_at"?: string | null,"brand_colors"?: Json | null,"created_at"?: string,"description"?: string | null,"examples"?: (string)[],"goals"?: string | null,"hashtags"?: (string)[],"id"?: string,"industry"?: string | null,"language"?: string,"logo_url"?: string | null,"name"?: string,"owner_id"?: string,"products"?: string | null,"target_audience"?: string | null,"tone"?: string | null,"updated_at"?: string,"words_to_avoid"?: (string)[],"words_to_use"?: (string)[]
                  }
                  Relationships: [
                    
                  ]
                },"oauth_candidates": {
                  Row: {
                    "access_token_enc": string | null,"client_id": string,"created_at": string,"display_name": string | null,"external_id": string,"id": string,"metadata": NonNullable<Json>,"network": string,"owner_id": string,"refresh_token_enc": string | null,"scopes": (string)[],"token_expires_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "access_token_enc"?: string | null,"client_id": string,"created_at"?: string,"display_name"?: string | null,"external_id": string,"id"?: string,"metadata"?: NonNullable<Json>,"network": string,"owner_id": string,"refresh_token_enc"?: string | null,"scopes"?: (string)[],"token_expires_at"?: string | null
                  }
                  Update: {
                    "access_token_enc"?: string | null,"client_id"?: string,"created_at"?: string,"display_name"?: string | null,"external_id"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"network"?: string,"owner_id"?: string,"refresh_token_enc"?: string | null,"scopes"?: (string)[],"token_expires_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "oauth_candidates_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"owner_settings": {
                  Row: {
                    "ai_model": string | null,"ai_provider": string | null,"created_at": string,"owner_id": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_model"?: string | null,"ai_provider"?: string | null,"created_at"?: string,"owner_id"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "ai_model"?: string | null,"ai_provider"?: string | null,"created_at"?: string,"owner_id"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"post_media": {
                  Row: {
                    "created_at": string,"height": number | null,"id": string,"mime_type": string,"position": number,"post_id": string,"size_bytes": number,"storage_path": string,"updated_at": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"height"?: number | null,"id"?: string,"mime_type": string,"position"?: number,"post_id": string,"size_bytes": number,"storage_path": string,"updated_at"?: string,"width"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"height"?: number | null,"id"?: string,"mime_type"?: string,"position"?: number,"post_id"?: string,"size_bytes"?: number,"storage_path"?: string,"updated_at"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_media_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"posts": {
                  Row: {
                    "attempts": number,"body": string,"client_id": string,"created_at": string,"error_message": string | null,"external_post_id": string | null,"hashtags": (string)[],"id": string,"network": string,"owner_id": string,"pillar": string | null,"published_at": string | null,"published_url": string | null,"scheduled_at": string | null,"social_account_id": string | null,"status": string,"strategy_id": string | null,"topic": string | null,"updated_at": string,"visual_idea": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"body"?: string,"client_id": string,"created_at"?: string,"error_message"?: string | null,"external_post_id"?: string | null,"hashtags"?: (string)[],"id"?: string,"network": string,"owner_id"?: string,"pillar"?: string | null,"published_at"?: string | null,"published_url"?: string | null,"scheduled_at"?: string | null,"social_account_id"?: string | null,"status"?: string,"strategy_id"?: string | null,"topic"?: string | null,"updated_at"?: string,"visual_idea"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"body"?: string,"client_id"?: string,"created_at"?: string,"error_message"?: string | null,"external_post_id"?: string | null,"hashtags"?: (string)[],"id"?: string,"network"?: string,"owner_id"?: string,"pillar"?: string | null,"published_at"?: string | null,"published_url"?: string | null,"scheduled_at"?: string | null,"social_account_id"?: string | null,"status"?: string,"strategy_id"?: string | null,"topic"?: string | null,"updated_at"?: string,"visual_idea"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "posts_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_social_account_id_fkey"
      columns: ["social_account_id"]
isOneToOne: false
      referencedRelation: "social_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_strategy_id_fkey"
      columns: ["strategy_id"]
isOneToOne: false
      referencedRelation: "strategies"
      referencedColumns: ["id"]
    }
                  ]
                },"publish_logs": {
                  Row: {
                    "attempted_at": string,"created_at": string,"id": string,"post_id": string,"request_summary": Json | null,"response_body": string | null,"response_status": number | null,"success": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempted_at"?: string,"created_at"?: string,"id"?: string,"post_id": string,"request_summary"?: Json | null,"response_body"?: string | null,"response_status"?: number | null,"success": boolean,"updated_at"?: string
                  }
                  Update: {
                    "attempted_at"?: string,"created_at"?: string,"id"?: string,"post_id"?: string,"request_summary"?: Json | null,"response_body"?: string | null,"response_status"?: number | null,"success"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "publish_logs_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"social_accounts": {
                  Row: {
                    "access_token_enc": string | null,"client_id": string,"created_at": string,"display_name": string | null,"external_id": string,"id": string,"metadata": NonNullable<Json>,"network": string,"owner_id": string,"refresh_token_enc": string | null,"scopes": (string)[],"status": string,"token_expires_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_token_enc"?: string | null,"client_id": string,"created_at"?: string,"display_name"?: string | null,"external_id": string,"id"?: string,"metadata"?: NonNullable<Json>,"network": string,"owner_id"?: string,"refresh_token_enc"?: string | null,"scopes"?: (string)[],"status"?: string,"token_expires_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "access_token_enc"?: string | null,"client_id"?: string,"created_at"?: string,"display_name"?: string | null,"external_id"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"network"?: string,"owner_id"?: string,"refresh_token_enc"?: string | null,"scopes"?: (string)[],"status"?: string,"token_expires_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "social_accounts_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"strategies": {
                  Row: {
                    "client_id": string,"created_at": string,"frequency": NonNullable<Json>,"id": string,"month": string,"monthly_goal": string | null,"owner_id": string,"pillars": NonNullable<Json>,"status": string,"theme_ideas": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"frequency"?: NonNullable<Json>,"id"?: string,"month": string,"monthly_goal"?: string | null,"owner_id"?: string,"pillars"?: NonNullable<Json>,"status"?: string,"theme_ideas"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"frequency"?: NonNullable<Json>,"id"?: string,"month"?: string,"monthly_goal"?: string | null,"owner_id"?: string,"pillars"?: NonNullable<Json>,"status"?: string,"theme_ideas"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "strategies_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "invoke_app_cron":
{ Args: { "path": string }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
