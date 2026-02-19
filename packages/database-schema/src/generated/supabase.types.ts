/**
 * THIS FILE IS AUTO-GENERATED.
 * Run: pnpm db:types
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          status: string;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          status?: string;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          status?: string;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      agent_commands: {
        Row: {
          id: string;
          tenant_id: string;
          agent_id: string;
          command_type: string;
          payload: Json;
          status: string;
          result: Json | null;
          error_message: string | null;
          queued_at: string;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          agent_id: string;
          command_type: string;
          payload: Json;
          status?: string;
          result?: Json | null;
          error_message?: string | null;
          queued_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          agent_id?: string;
          command_type?: string;
          payload?: Json;
          status?: string;
          result?: Json | null;
          error_message?: string | null;
          queued_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      resources_licenses: {
        Row: {
          id: string;
          tenant_id: string;
          data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      resources_proxies: {
        Row: {
          id: string;
          tenant_id: string;
          data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      resources_subscriptions: {
        Row: {
          id: string;
          tenant_id: string;
          data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
