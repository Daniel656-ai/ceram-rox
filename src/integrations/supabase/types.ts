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
      activity_log: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          order_id: string | null
          order_measurement_id: string | null
          project_id: string | null
          service_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          order_id?: string | null
          order_measurement_id?: string | null
          project_id?: string | null
          service_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          order_measurement_id?: string | null
          project_id?: string | null
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "measurement_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_order_measurement_id_fkey"
            columns: ["order_measurement_id"]
            isOneToOne: false
            referencedRelation: "order_measurements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          company_name: string | null
          id: string
          logo_data_url: string | null
          logo_mime: string | null
          logo_updated_at: string | null
          raw_material_check_mode: string
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_name?: string | null
          id?: string
          logo_data_url?: string | null
          logo_mime?: string | null
          logo_updated_at?: string | null
          raw_material_check_mode?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_name?: string | null
          id?: string
          logo_data_url?: string | null
          logo_mime?: string | null
          logo_updated_at?: string | null
          raw_material_check_mode?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      consumables: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          price_per_unit: number
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price_per_unit?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price_per_unit?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      container_audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          comment: string | null
          container_id: string
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          comment?: string | null
          container_id: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          comment?: string | null
          container_id?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "container_audit_log_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "raw_material_containers"
            referencedColumns: ["id"]
          },
        ]
      }
      container_batch_positions: {
        Row: {
          added_at: string
          batch_id: string
          container_id: string
          created_at: string
          id: string
          initial_quantity: number
          position_no: number | null
          quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          added_at?: string
          batch_id: string
          container_id: string
          created_at?: string
          id?: string
          initial_quantity?: number
          position_no?: number | null
          quantity?: number
          status?: string
          updated_at?: string
        }
        Update: {
          added_at?: string
          batch_id?: string
          container_id?: string
          created_at?: string
          id?: string
          initial_quantity?: number
          position_no?: number | null
          quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "container_batch_positions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "raw_material_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_batch_positions_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "raw_material_containers"
            referencedColumns: ["id"]
          },
        ]
      }
      container_location_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          comment: string | null
          container_id: string
          from_location_id: string | null
          from_location_note: string | null
          id: string
          movement_id: string | null
          to_location_id: string | null
          to_location_note: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          comment?: string | null
          container_id: string
          from_location_id?: string | null
          from_location_note?: string | null
          id?: string
          movement_id?: string | null
          to_location_id?: string | null
          to_location_note?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          comment?: string | null
          container_id?: string
          from_location_id?: string | null
          from_location_note?: string | null
          id?: string
          movement_id?: string | null
          to_location_id?: string | null
          to_location_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "container_location_history_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "raw_material_containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_location_history_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_location_history_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "container_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_location_history_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      container_movements: {
        Row: {
          comment: string | null
          container_id: string
          created_at: string
          created_by: string
          from_location_id: string | null
          id: string
          inventory_movement_id: string | null
          movement_type: Database["public"]["Enums"]["container_movement_type"]
          quantity: number
          quantity_after: number | null
          quantity_before: number | null
          reference: string | null
          to_location_id: string | null
        }
        Insert: {
          comment?: string | null
          container_id: string
          created_at?: string
          created_by: string
          from_location_id?: string | null
          id?: string
          inventory_movement_id?: string | null
          movement_type: Database["public"]["Enums"]["container_movement_type"]
          quantity?: number
          quantity_after?: number | null
          quantity_before?: number | null
          reference?: string | null
          to_location_id?: string | null
        }
        Update: {
          comment?: string | null
          container_id?: string
          created_at?: string
          created_by?: string
          from_location_id?: string | null
          id?: string
          inventory_movement_id?: string | null
          movement_type?: Database["public"]["Enums"]["container_movement_type"]
          quantity?: number
          quantity_after?: number | null
          quantity_before?: number | null
          reference?: string | null
          to_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "container_movements_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "raw_material_containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_movements_inventory_movement_id_fkey"
            columns: ["inventory_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          base_role: Database["public"]["Enums"]["app_role"]
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          base_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          base_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_symbols: {
        Row: {
          category: string
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          file_size: number | null
          id: string
          image_data_url: string
          is_active: boolean
          mime_type: string
          name: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_size?: number | null
          id?: string
          image_data_url: string
          is_active?: boolean
          mime_type: string
          name: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_size?: number | null
          id?: string
          image_data_url?: string
          is_active?: boolean
          mime_type?: string
          name?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          file_name: string
          file_type: string | null
          id: string
          order_measurement_id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          file_name: string
          file_type?: string | null
          id?: string
          order_measurement_id: string
          storage_path: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          file_name?: string
          file_type?: string | null
          id?: string
          order_measurement_id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_order_measurement_id_fkey"
            columns: ["order_measurement_id"]
            isOneToOne: false
            referencedRelation: "order_measurements"
            referencedColumns: ["id"]
          },
        ]
      }
      form_calculations: {
        Row: {
          calc_key: string
          created_at: string
          created_by: string | null
          decimals: number
          description: string | null
          display_name: string
          expression: Json
          form_id: string
          formula: string
          id: string
          inputs: Json
          is_result: boolean
          result_label: string | null
          result_type: string
          rounding: string
          sort_order: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          calc_key: string
          created_at?: string
          created_by?: string | null
          decimals?: number
          description?: string | null
          display_name: string
          expression?: Json
          form_id: string
          formula?: string
          id?: string
          inputs?: Json
          is_result?: boolean
          result_label?: string | null
          result_type?: string
          rounding?: string
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          calc_key?: string
          created_at?: string
          created_by?: string | null
          decimals?: number
          description?: string | null
          display_name?: string
          expression?: Json
          form_id?: string
          formula?: string
          id?: string
          inputs?: Json
          is_result?: boolean
          result_label?: string | null
          result_type?: string
          rounding?: string
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_calculations_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_definition_versions: {
        Row: {
          created_at: string
          created_by: string | null
          form_definition_id: string
          id: string
          note: string | null
          snapshot: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          form_definition_id: string
          id?: string
          note?: string | null
          snapshot?: Json
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          form_definition_id?: string
          id?: string
          note?: string | null
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_definition_versions_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_definitions: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          layout: Json
          name: string
          scope: Database["public"]["Enums"]["form_scope"]
          updated_at: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          layout?: Json
          name: string
          scope?: Database["public"]["Enums"]["form_scope"]
          updated_at?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          layout?: Json
          name?: string
          scope?: Database["public"]["Enums"]["form_scope"]
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      form_field_permissions: {
        Row: {
          can_add: boolean
          can_remove: boolean
          created_at: string
          field_id: string
          form_definition_id: string
          id: string
          required: boolean
          role_key: string
          updated_at: string
          visibility: string
        }
        Insert: {
          can_add?: boolean
          can_remove?: boolean
          created_at?: string
          field_id: string
          form_definition_id: string
          id?: string
          required?: boolean
          role_key: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          can_add?: boolean
          can_remove?: boolean
          created_at?: string
          field_id?: string
          form_definition_id?: string
          id?: string
          required?: boolean
          role_key?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_field_permissions_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "form_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_field_permissions_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_field_rules: {
        Row: {
          action: string
          condition: Json
          created_at: string
          created_by: string | null
          form_definition_id: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          target_field_ids: string[]
          updated_at: string
        }
        Insert: {
          action?: string
          condition?: Json
          created_at?: string
          created_by?: string | null
          form_definition_id: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          target_field_ids?: string[]
          updated_at?: string
        }
        Update: {
          action?: string
          condition?: Json
          created_at?: string
          created_by?: string | null
          form_definition_id?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          target_field_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_field_rules_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          binding_path: string | null
          category: string | null
          created_at: string
          data_source: Json
          decimal_places: number | null
          default_value: string | null
          description: string | null
          display_name: string
          field_key: string
          field_type: string
          form_id: string
          formula: string | null
          global_field_id: string | null
          id: string
          is_required: boolean
          is_result: boolean
          max_value: number | null
          metadata: Json
          min_value: number | null
          parent_field_id: string | null
          readonly: boolean
          ref_target: string | null
          result_label: string | null
          select_options: Json
          sort_order: number
          unit: string | null
          updated_at: string
          validation: Json
        }
        Insert: {
          binding_path?: string | null
          category?: string | null
          created_at?: string
          data_source?: Json
          decimal_places?: number | null
          default_value?: string | null
          description?: string | null
          display_name: string
          field_key: string
          field_type: string
          form_id: string
          formula?: string | null
          global_field_id?: string | null
          id?: string
          is_required?: boolean
          is_result?: boolean
          max_value?: number | null
          metadata?: Json
          min_value?: number | null
          parent_field_id?: string | null
          readonly?: boolean
          ref_target?: string | null
          result_label?: string | null
          select_options?: Json
          sort_order?: number
          unit?: string | null
          updated_at?: string
          validation?: Json
        }
        Update: {
          binding_path?: string | null
          category?: string | null
          created_at?: string
          data_source?: Json
          decimal_places?: number | null
          default_value?: string | null
          description?: string | null
          display_name?: string
          field_key?: string
          field_type?: string
          form_id?: string
          formula?: string | null
          global_field_id?: string | null
          id?: string
          is_required?: boolean
          is_result?: boolean
          max_value?: number | null
          metadata?: Json
          min_value?: number | null
          parent_field_id?: string | null
          readonly?: boolean
          ref_target?: string | null
          result_label?: string | null
          select_options?: Json
          sort_order?: number
          unit?: string | null
          updated_at?: string
          validation?: Json
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_fields_global_field_id_fkey"
            columns: ["global_field_id"]
            isOneToOne: false
            referencedRelation: "global_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_fields_parent_field_id_fkey"
            columns: ["parent_field_id"]
            isOneToOne: false
            referencedRelation: "form_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      form_import_mappings: {
        Row: {
          binding_path: string | null
          confirm_count: number
          created_at: string
          created_by: string | null
          global_field_id: string | null
          id: string
          last_used_at: string
          normalized_label: string
          source_label: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          binding_path?: string | null
          confirm_count?: number
          created_at?: string
          created_by?: string | null
          global_field_id?: string | null
          id?: string
          last_used_at?: string
          normalized_label: string
          source_label: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          binding_path?: string | null
          confirm_count?: number
          created_at?: string
          created_by?: string | null
          global_field_id?: string | null
          id?: string
          last_used_at?: string
          normalized_label?: string
          source_label?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_import_mappings_global_field_id_fkey"
            columns: ["global_field_id"]
            isOneToOne: false
            referencedRelation: "global_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      form_import_runs: {
        Row: {
          analysis: Json
          created_at: string
          created_by: string | null
          field_count: number
          file_name: string
          file_type: string
          form_id: string | null
          id: string
          new_global_field_count: number
        }
        Insert: {
          analysis?: Json
          created_at?: string
          created_by?: string | null
          field_count?: number
          file_name: string
          file_type: string
          form_id?: string | null
          id?: string
          new_global_field_count?: number
        }
        Update: {
          analysis?: Json
          created_at?: string
          created_by?: string | null
          field_count?: number
          file_name?: string
          file_type?: string
          form_id?: string | null
          id?: string
          new_global_field_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_import_runs_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_role_views: {
        Row: {
          created_at: string
          created_by: string | null
          form_definition_id: string
          id: string
          label: string
          layout: Json
          role_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          form_definition_id: string
          id?: string
          label: string
          layout?: Json
          role_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          form_definition_id?: string
          id?: string
          label?: string
          layout?: Json
          role_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_role_views_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_value_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          field_key: string
          field_label: string | null
          form_definition_id: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          order_id: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field_key: string
          field_label?: string | null
          form_definition_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          order_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field_key?: string
          field_label?: string | null
          form_definition_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_value_history_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      global_calculations: {
        Row: {
          archived_at: string | null
          calc_key: string
          category: string | null
          created_at: string
          created_by: string | null
          decimals: number
          description: string | null
          display_name: string
          formula: string
          id: string
          input_bindings: Json
          inputs: Json
          is_result: boolean
          is_system: boolean
          output_binding: Json | null
          result_label: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          calc_key: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          decimals?: number
          description?: string | null
          display_name: string
          formula: string
          id?: string
          input_bindings?: Json
          inputs?: Json
          is_result?: boolean
          is_system?: boolean
          output_binding?: Json | null
          result_label?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          calc_key?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          decimals?: number
          description?: string | null
          display_name?: string
          formula?: string
          id?: string
          input_bindings?: Json
          inputs?: Json
          is_result?: boolean
          is_system?: boolean
          output_binding?: Json | null
          result_label?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      global_fields: {
        Row: {
          archived_at: string | null
          calculation_id: string | null
          category: string | null
          created_at: string
          created_by: string | null
          data_source: string
          data_type: string
          default_value: string | null
          description: string | null
          display_name: string
          field_key: string
          id: string
          is_repeatable: boolean
          is_result: boolean
          is_system: boolean
          list_id: string | null
          metadata: Json
          object_id: string
          reference_object_id: string | null
          reference_source: string | null
          result_label: string | null
          select_options: Json
          sort_order: number
          unit: string | null
          updated_at: string
          validation_ids: string[]
          version: number
        }
        Insert: {
          archived_at?: string | null
          calculation_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          data_source?: string
          data_type?: string
          default_value?: string | null
          description?: string | null
          display_name: string
          field_key: string
          id?: string
          is_repeatable?: boolean
          is_result?: boolean
          is_system?: boolean
          list_id?: string | null
          metadata?: Json
          object_id: string
          reference_object_id?: string | null
          reference_source?: string | null
          result_label?: string | null
          select_options?: Json
          sort_order?: number
          unit?: string | null
          updated_at?: string
          validation_ids?: string[]
          version?: number
        }
        Update: {
          archived_at?: string | null
          calculation_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          data_source?: string
          data_type?: string
          default_value?: string | null
          description?: string | null
          display_name?: string
          field_key?: string
          id?: string
          is_repeatable?: boolean
          is_result?: boolean
          is_system?: boolean
          list_id?: string | null
          metadata?: Json
          object_id?: string
          reference_object_id?: string | null
          reference_source?: string | null
          result_label?: string | null
          select_options?: Json
          sort_order?: number
          unit?: string | null
          updated_at?: string
          validation_ids?: string[]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "global_fields_calculation_id_fkey"
            columns: ["calculation_id"]
            isOneToOne: false
            referencedRelation: "global_calculations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_fields_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "global_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_fields_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "global_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_fields_reference_object_id_fkey"
            columns: ["reference_object_id"]
            isOneToOne: false
            referencedRelation: "global_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      global_list_attributes: {
        Row: {
          attribute_key: string
          created_at: string
          data_type: string
          description: string | null
          display_name: string
          id: string
          is_required: boolean
          list_id: string
          options: Json
          show_in_table: boolean
          sort_order: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          attribute_key: string
          created_at?: string
          data_type?: string
          description?: string | null
          display_name: string
          id?: string
          is_required?: boolean
          list_id: string
          options?: Json
          show_in_table?: boolean
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          attribute_key?: string
          created_at?: string
          data_type?: string
          description?: string | null
          display_name?: string
          id?: string
          is_required?: boolean
          list_id?: string
          options?: Json
          show_in_table?: boolean
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_list_attributes_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "global_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      global_list_items: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          item_value: string
          label: string
          list_id: string
          metadata: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          item_value: string
          label: string
          list_id: string
          metadata?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          item_value?: string
          label?: string
          list_id?: string
          metadata?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "global_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      global_lists: {
        Row: {
          archived_at: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string
          id: string
          is_system: boolean
          list_key: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_system?: boolean
          list_key: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_system?: boolean
          list_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      global_objects: {
        Row: {
          archived_at: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string
          icon: string | null
          id: string
          is_system: boolean
          object_key: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name: string
          icon?: string | null
          id?: string
          is_system?: boolean
          object_key: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          object_key?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      global_validations: {
        Row: {
          archived_at: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string
          error_message: string | null
          expression: string | null
          id: string
          is_system: boolean
          max_value: number | null
          min_value: number | null
          pattern: string | null
          rule_type: string
          severity: string
          unit: string | null
          updated_at: string
          validation_key: string
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name: string
          error_message?: string | null
          expression?: string | null
          id?: string
          is_system?: boolean
          max_value?: number | null
          min_value?: number | null
          pattern?: string | null
          rule_type?: string
          severity?: string
          unit?: string | null
          updated_at?: string
          validation_key: string
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string
          error_message?: string | null
          expression?: string | null
          id?: string
          is_system?: boolean
          max_value?: number | null
          min_value?: number | null
          pattern?: string | null
          rule_type?: string
          severity?: string
          unit?: string | null
          updated_at?: string
          validation_key?: string
        }
        Relationships: []
      }
      hazard_notification_log: {
        Row: {
          activity_id: string | null
          channel: string
          event_type: string
          id: string
          material_snapshot: Json
          raw_material_id: string
          recipient_user_ids: string[]
          triggered_at: string
          triggered_by: string | null
        }
        Insert: {
          activity_id?: string | null
          channel?: string
          event_type: string
          id?: string
          material_snapshot?: Json
          raw_material_id: string
          recipient_user_ids?: string[]
          triggered_at?: string
          triggered_by?: string | null
        }
        Update: {
          activity_id?: string | null
          channel?: string
          event_type?: string
          id?: string
          material_snapshot?: Json
          raw_material_id?: string
          recipient_user_ids?: string[]
          triggered_at?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hazard_notification_log_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hazard_notification_log_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      hazard_notification_recipients: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role_label: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role_label?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role_label?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          batch_id: string | null
          certificate_document_id: string | null
          comment: string | null
          created_at: string
          created_by: string
          id: string
          movement_date: string
          movement_type: string
          project_reference: string | null
          quantity: number
          raw_material_id: string
          supplier: string | null
        }
        Insert: {
          batch_id?: string | null
          certificate_document_id?: string | null
          comment?: string | null
          created_at?: string
          created_by: string
          id?: string
          movement_date?: string
          movement_type: string
          project_reference?: string | null
          quantity: number
          raw_material_id: string
          supplier?: string | null
        }
        Update: {
          batch_id?: string | null
          certificate_document_id?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string
          id?: string
          movement_date?: string
          movement_type?: string
          project_reference?: string | null
          quantity?: number
          raw_material_id?: string
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "raw_material_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_certificate_document_id_fkey"
            columns: ["certificate_document_id"]
            isOneToOne: false
            referencedRelation: "raw_material_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      label_print_history: {
        Row: {
          container_id: string | null
          copies: number
          data_snapshot: Json | null
          id: string
          output: string
          printed_at: string
          printed_by: string | null
          raw_material_id: string | null
          template_id: string | null
        }
        Insert: {
          container_id?: string | null
          copies?: number
          data_snapshot?: Json | null
          id?: string
          output?: string
          printed_at?: string
          printed_by?: string | null
          raw_material_id?: string | null
          template_id?: string | null
        }
        Update: {
          container_id?: string | null
          copies?: number
          data_snapshot?: Json | null
          id?: string
          output?: string
          printed_at?: string
          printed_by?: string | null
          raw_material_id?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "label_print_history_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "raw_material_containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_print_history_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_print_history_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "label_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      label_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          height_mm: number
          id: string
          is_default: boolean
          layout: Json
          name: string
          updated_at: string
          width_mm: number
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          height_mm?: number
          id?: string
          is_default?: boolean
          layout?: Json
          name: string
          updated_at?: string
          width_mm?: number
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          height_mm?: number
          id?: string
          is_default?: boolean
          layout?: Json
          name?: string
          updated_at?: string
          width_mm?: number
        }
        Relationships: []
      }
      mdl_permission_audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string
          id: string
          service_id: string
          user_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by: string
          id?: string
          service_id: string
          user_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string
          id?: string
          service_id?: string
          user_id?: string
        }
        Relationships: []
      }
      mdl_service_permissions: {
        Row: {
          granted_at: string
          granted_by: string
          id: string
          service_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by: string
          id?: string
          service_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string
          id?: string
          service_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mdl_service_permissions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_case_instances: {
        Row: {
          case_id: string
          context: Json
          created_at: string
          curve_config: Json
          id: string
          import_profile_id: string | null
          label: string
          method: string | null
          position: number
          updated_at: string
        }
        Insert: {
          case_id: string
          context?: Json
          created_at?: string
          curve_config?: Json
          id?: string
          import_profile_id?: string | null
          label: string
          method?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          case_id?: string
          context?: Json
          created_at?: string
          curve_config?: Json
          id?: string
          import_profile_id?: string | null
          label?: string
          method?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurement_case_instances_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "measurement_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_case_instances_import_profile_id_fkey"
            columns: ["import_profile_id"]
            isOneToOne: false
            referencedRelation: "measurement_import_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_cases: {
        Row: {
          case_key: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          method: string | null
          name: string
          updated_at: string
        }
        Insert: {
          case_key: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          method?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          case_key?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          method?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      measurement_curve_evaluations: {
        Row: {
          created_at: string
          created_by: string | null
          dataset_id: string
          details: Json
          formula: string | null
          id: string
          measurement_result_id: string | null
          method: string
          method_label: string | null
          result_label: string | null
          unit: string | null
          value: number | null
          x_channel: string
          x_from: number
          x_to: number
          x_unit: string | null
          y_channel: string
          y_unit: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dataset_id: string
          details?: Json
          formula?: string | null
          id?: string
          measurement_result_id?: string | null
          method: string
          method_label?: string | null
          result_label?: string | null
          unit?: string | null
          value?: number | null
          x_channel: string
          x_from: number
          x_to: number
          x_unit?: string | null
          y_channel: string
          y_unit?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dataset_id?: string
          details?: Json
          formula?: string | null
          id?: string
          measurement_result_id?: string | null
          method?: string
          method_label?: string | null
          result_label?: string | null
          unit?: string | null
          value?: number | null
          x_channel?: string
          x_from?: number
          x_to?: number
          x_unit?: string | null
          y_channel?: string
          y_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "measurement_curve_evaluations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_curve_evaluations_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "measurement_raw_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_curve_evaluations_measurement_result_id_fkey"
            columns: ["measurement_result_id"]
            isOneToOne: false
            referencedRelation: "measurement_results"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_import_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          decimal_separator: string
          default_unit: string | null
          description: string | null
          format: string
          id: string
          is_active: boolean
          mappings: Json
          name: string
          options: Json
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decimal_separator?: string
          default_unit?: string | null
          description?: string | null
          format?: string
          id?: string
          is_active?: boolean
          mappings?: Json
          name: string
          options?: Json
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decimal_separator?: string
          default_unit?: string | null
          description?: string | null
          format?: string
          id?: string
          is_active?: boolean
          mappings?: Json
          name?: string
          options?: Json
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      measurement_orders: {
        Row: {
          created_at: string
          created_by: string
          customer_name: string | null
          due_date: string | null
          id: string
          is_pilot_plant_process: boolean
          notes: string | null
          order_kind: Database["public"]["Enums"]["order_kind"]
          order_number: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          origin: string | null
          pp_experiment_date: string | null
          pp_experiment_kind: string | null
          pp_experiment_number: string | null
          pp_issuer_user_id: string | null
          pp_masse_type: Database["public"]["Enums"]["masse_type"] | null
          pp_previous_experiments: string | null
          pp_remarks: string | null
          pp_v2o5_percent: number | null
          priority: Database["public"]["Enums"]["order_priority"]
          project_id: string
          ranking: number | null
          reference_number: string | null
          reference_type: Database["public"]["Enums"]["reference_type"] | null
          sample_id: string | null
          shared_form_data: Json
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          workflow_status: Database["public"]["Enums"]["workflow_status"] | null
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_name?: string | null
          due_date?: string | null
          id?: string
          is_pilot_plant_process?: boolean
          notes?: string | null
          order_kind?: Database["public"]["Enums"]["order_kind"]
          order_number?: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          origin?: string | null
          pp_experiment_date?: string | null
          pp_experiment_kind?: string | null
          pp_experiment_number?: string | null
          pp_issuer_user_id?: string | null
          pp_masse_type?: Database["public"]["Enums"]["masse_type"] | null
          pp_previous_experiments?: string | null
          pp_remarks?: string | null
          pp_v2o5_percent?: number | null
          priority?: Database["public"]["Enums"]["order_priority"]
          project_id: string
          ranking?: number | null
          reference_number?: string | null
          reference_type?: Database["public"]["Enums"]["reference_type"] | null
          sample_id?: string | null
          shared_form_data?: Json
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          workflow_status?:
            | Database["public"]["Enums"]["workflow_status"]
            | null
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_name?: string | null
          due_date?: string | null
          id?: string
          is_pilot_plant_process?: boolean
          notes?: string | null
          order_kind?: Database["public"]["Enums"]["order_kind"]
          order_number?: string | null
          order_type?: Database["public"]["Enums"]["order_type"]
          origin?: string | null
          pp_experiment_date?: string | null
          pp_experiment_kind?: string | null
          pp_experiment_number?: string | null
          pp_issuer_user_id?: string | null
          pp_masse_type?: Database["public"]["Enums"]["masse_type"] | null
          pp_previous_experiments?: string | null
          pp_remarks?: string | null
          pp_v2o5_percent?: number | null
          priority?: Database["public"]["Enums"]["order_priority"]
          project_id?: string
          ranking?: number | null
          reference_number?: string | null
          reference_type?: Database["public"]["Enums"]["reference_type"] | null
          sample_id?: string | null
          shared_form_data?: Json
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          workflow_status?:
            | Database["public"]["Enums"]["workflow_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "measurement_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_orders_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_parameters: {
        Row: {
          id: string
          order_measurement_id: string
          parameter_name: string
          parameter_value: string | null
          unit: string | null
        }
        Insert: {
          id?: string
          order_measurement_id: string
          parameter_name: string
          parameter_value?: string | null
          unit?: string | null
        }
        Update: {
          id?: string
          order_measurement_id?: string
          parameter_name?: string
          parameter_value?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "measurement_parameters_order_measurement_id_fkey"
            columns: ["order_measurement_id"]
            isOneToOne: false
            referencedRelation: "order_measurements"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_raw_datasets: {
        Row: {
          case_instance_id: string | null
          channels: Json
          created_at: string
          created_by: string | null
          id: string
          importer_id: string
          instance_key: string | null
          instance_label: string | null
          instrument: string | null
          measurement_type: string | null
          metadata: Json
          order_measurement_id: string
          parser_version: string | null
          point_count: number
          sample_id: string | null
          service_id: string | null
          signal_mapping: Json
          source_file_id: string | null
          source_file_name: string | null
          updated_at: string
        }
        Insert: {
          case_instance_id?: string | null
          channels?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          importer_id: string
          instance_key?: string | null
          instance_label?: string | null
          instrument?: string | null
          measurement_type?: string | null
          metadata?: Json
          order_measurement_id: string
          parser_version?: string | null
          point_count?: number
          sample_id?: string | null
          service_id?: string | null
          signal_mapping?: Json
          source_file_id?: string | null
          source_file_name?: string | null
          updated_at?: string
        }
        Update: {
          case_instance_id?: string | null
          channels?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          importer_id?: string
          instance_key?: string | null
          instance_label?: string | null
          instrument?: string | null
          measurement_type?: string | null
          metadata?: Json
          order_measurement_id?: string
          parser_version?: string | null
          point_count?: number
          sample_id?: string | null
          service_id?: string | null
          signal_mapping?: Json
          source_file_id?: string | null
          source_file_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurement_raw_datasets_case_instance_id_fkey"
            columns: ["case_instance_id"]
            isOneToOne: false
            referencedRelation: "measurement_case_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_raw_datasets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_raw_datasets_order_measurement_id_fkey"
            columns: ["order_measurement_id"]
            isOneToOne: false
            referencedRelation: "order_measurements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_raw_datasets_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_raw_datasets_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_raw_datasets_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "order_upload_files"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_raw_series: {
        Row: {
          chunk_index: number
          created_at: string
          dataset_id: string
          id: string
          rows: Json
        }
        Insert: {
          chunk_index?: number
          created_at?: string
          dataset_id: string
          id?: string
          rows?: Json
        }
        Update: {
          chunk_index?: number
          created_at?: string
          dataset_id?: string
          id?: string
          rows?: Json
        }
        Relationships: [
          {
            foreignKeyName: "measurement_raw_series_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "measurement_raw_datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_result_corrections: {
        Row: {
          affected_result_count: number | null
          change_type: string
          changed_at: string
          changed_by: string
          id: string
          measurement_result_id: string | null
          new_sample_id: string | null
          new_sample_number: string | null
          new_text: string | null
          new_value: number | null
          old_sample_id: string | null
          old_sample_number: string | null
          old_text: string | null
          old_value: number | null
          order_id: string | null
          order_measurement_id: string
          parameter_label: string | null
          parameter_name: string | null
          reason: string
          service_id: string | null
          unit: string | null
        }
        Insert: {
          affected_result_count?: number | null
          change_type: string
          changed_at?: string
          changed_by: string
          id?: string
          measurement_result_id?: string | null
          new_sample_id?: string | null
          new_sample_number?: string | null
          new_text?: string | null
          new_value?: number | null
          old_sample_id?: string | null
          old_sample_number?: string | null
          old_text?: string | null
          old_value?: number | null
          order_id?: string | null
          order_measurement_id: string
          parameter_label?: string | null
          parameter_name?: string | null
          reason: string
          service_id?: string | null
          unit?: string | null
        }
        Update: {
          affected_result_count?: number | null
          change_type?: string
          changed_at?: string
          changed_by?: string
          id?: string
          measurement_result_id?: string | null
          new_sample_id?: string | null
          new_sample_number?: string | null
          new_text?: string | null
          new_value?: number | null
          old_sample_id?: string | null
          old_sample_number?: string | null
          old_text?: string | null
          old_value?: number | null
          order_id?: string | null
          order_measurement_id?: string
          parameter_label?: string | null
          parameter_name?: string | null
          reason?: string
          service_id?: string | null
          unit?: string | null
        }
        Relationships: []
      }
      measurement_results: {
        Row: {
          created_at: string
          display_label: string | null
          id: string
          instance_context: Json
          instance_key: string | null
          instance_label: string | null
          is_official: boolean
          measured_at: string | null
          measured_by: string | null
          order_measurement_id: string
          remarks: string | null
          result_name: string
          temperature_range_from: number | null
          temperature_range_to: number | null
          temperature_unit: string | null
          unit: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          created_at?: string
          display_label?: string | null
          id?: string
          instance_context?: Json
          instance_key?: string | null
          instance_label?: string | null
          is_official?: boolean
          measured_at?: string | null
          measured_by?: string | null
          order_measurement_id: string
          remarks?: string | null
          result_name: string
          temperature_range_from?: number | null
          temperature_range_to?: number | null
          temperature_unit?: string | null
          unit?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          created_at?: string
          display_label?: string | null
          id?: string
          instance_context?: Json
          instance_key?: string | null
          instance_label?: string | null
          is_official?: boolean
          measured_at?: string | null
          measured_by?: string | null
          order_measurement_id?: string
          remarks?: string | null
          result_name?: string
          temperature_range_from?: number | null
          temperature_range_to?: number | null
          temperature_unit?: string | null
          unit?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "measurement_results_order_measurement_id_fkey"
            columns: ["order_measurement_id"]
            isOneToOne: false
            referencedRelation: "order_measurements"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_services: {
        Row: {
          active: boolean
          archived_at: string | null
          category: Database["public"]["Enums"]["service_category"]
          color: string | null
          created_at: string
          department: string | null
          description: string | null
          hourly_rate: number
          icon: string | null
          id: string
          price: number | null
          process_template_id: string | null
          responsible_user_id: string | null
          service_name: string
          standard_duration_hours: number
          updated_at: string
          work_instructions: string | null
          workstation_id: string | null
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          category: Database["public"]["Enums"]["service_category"]
          color?: string | null
          created_at?: string
          department?: string | null
          description?: string | null
          hourly_rate?: number
          icon?: string | null
          id?: string
          price?: number | null
          process_template_id?: string | null
          responsible_user_id?: string | null
          service_name: string
          standard_duration_hours?: number
          updated_at?: string
          work_instructions?: string | null
          workstation_id?: string | null
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          category?: Database["public"]["Enums"]["service_category"]
          color?: string | null
          created_at?: string
          department?: string | null
          description?: string | null
          hourly_rate?: number
          icon?: string | null
          id?: string
          price?: number | null
          process_template_id?: string | null
          responsible_user_id?: string | null
          service_name?: string
          standard_duration_hours?: number
          updated_at?: string
          work_instructions?: string | null
          workstation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "measurement_services_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_services_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_template_items: {
        Row: {
          id: string
          service_id: string
          sort_order: number
          template_id: string
        }
        Insert: {
          id?: string
          service_id: string
          sort_order?: number
          template_id: string
        }
        Update: {
          id?: string
          service_id?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurement_template_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "measurement_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      mixture_batch_consumptions: {
        Row: {
          created_at: string
          id: string
          inventory_movement_id: string | null
          mixture_batch_id: string
          quantity: number
          raw_material_batch_id: string | null
          raw_material_id: string
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_movement_id?: string | null
          mixture_batch_id: string
          quantity: number
          raw_material_batch_id?: string | null
          raw_material_id: string
          unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_movement_id?: string | null
          mixture_batch_id?: string
          quantity?: number
          raw_material_batch_id?: string | null
          raw_material_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "mixture_batch_consumptions_mixture_batch_id_fkey"
            columns: ["mixture_batch_id"]
            isOneToOne: false
            referencedRelation: "mixture_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mixture_batch_consumptions_raw_material_batch_id_fkey"
            columns: ["raw_material_batch_id"]
            isOneToOne: false
            referencedRelation: "raw_material_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mixture_batch_consumptions_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      mixture_batch_corrections: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string | null
          delta: number | null
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          reason: string
          weighing_id: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_by?: string | null
          delta?: number | null
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason: string
          weighing_id?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string | null
          delta?: number | null
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string
          weighing_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mixture_batch_corrections_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "mixture_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mixture_batch_corrections_weighing_id_fkey"
            columns: ["weighing_id"]
            isOneToOne: false
            referencedRelation: "mixture_batch_weighings"
            referencedColumns: ["id"]
          },
        ]
      }
      mixture_batch_deviations: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["mixture_deviation_kind"]
          new_value: string | null
          old_value: string | null
          reason: string
          section_id: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["mixture_deviation_kind"]
          new_value?: string | null
          old_value?: string | null
          reason: string
          section_id?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["mixture_deviation_kind"]
          new_value?: string | null
          old_value?: string | null
          reason?: string
          section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mixture_batch_deviations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "mixture_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mixture_batch_deviations_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "mixture_process_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      mixture_batch_measurements: {
        Row: {
          actual_value: number
          batch_id: string
          comment: string | null
          created_at: string
          id: string
          measured_at: string
          measured_by: string | null
          parameter_name: string
          planned_measurement_id: string | null
          section_id: string | null
          target_value: number | null
          unit: string | null
        }
        Insert: {
          actual_value: number
          batch_id: string
          comment?: string | null
          created_at?: string
          id?: string
          measured_at?: string
          measured_by?: string | null
          parameter_name: string
          planned_measurement_id?: string | null
          section_id?: string | null
          target_value?: number | null
          unit?: string | null
        }
        Update: {
          actual_value?: number
          batch_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          measured_at?: string
          measured_by?: string | null
          parameter_name?: string
          planned_measurement_id?: string | null
          section_id?: string | null
          target_value?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mixture_batch_measurements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "mixture_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mixture_batch_measurements_planned_measurement_id_fkey"
            columns: ["planned_measurement_id"]
            isOneToOne: false
            referencedRelation: "mixture_planned_measurements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mixture_batch_measurements_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "mixture_process_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      mixture_batch_weighings: {
        Row: {
          actual_quantity: number
          batch_id: string
          confirmed: boolean
          confirmed_at: string | null
          confirmed_by: string | null
          container_code_snapshot: string | null
          container_id: string | null
          container_name_snapshot: string | null
          created_at: string
          deviation_abs: number | null
          deviation_pct: number | null
          gross_weight: number | null
          id: string
          inventory_movement_id: string | null
          location_snapshot: string | null
          lot_number_snapshot: string | null
          notes: string | null
          raw_material_batch_id: string | null
          raw_material_id: string
          step_id: string | null
          tare_weight_snapshot: number | null
          target_quantity: number | null
          unit: string
          weighed_at: string
          weighed_by: string | null
        }
        Insert: {
          actual_quantity: number
          batch_id: string
          confirmed?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          container_code_snapshot?: string | null
          container_id?: string | null
          container_name_snapshot?: string | null
          created_at?: string
          deviation_abs?: number | null
          deviation_pct?: number | null
          gross_weight?: number | null
          id?: string
          inventory_movement_id?: string | null
          location_snapshot?: string | null
          lot_number_snapshot?: string | null
          notes?: string | null
          raw_material_batch_id?: string | null
          raw_material_id: string
          step_id?: string | null
          tare_weight_snapshot?: number | null
          target_quantity?: number | null
          unit?: string
          weighed_at?: string
          weighed_by?: string | null
        }
        Update: {
          actual_quantity?: number
          batch_id?: string
          confirmed?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          container_code_snapshot?: string | null
          container_id?: string | null
          container_name_snapshot?: string | null
          created_at?: string
          deviation_abs?: number | null
          deviation_pct?: number | null
          gross_weight?: number | null
          id?: string
          inventory_movement_id?: string | null
          location_snapshot?: string | null
          lot_number_snapshot?: string | null
          notes?: string | null
          raw_material_batch_id?: string | null
          raw_material_id?: string
          step_id?: string | null
          tare_weight_snapshot?: number | null
          target_quantity?: number | null
          unit?: string
          weighed_at?: string
          weighed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mixture_batch_weighings_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "mixture_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mixture_batch_weighings_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "raw_material_containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mixture_batch_weighings_inventory_movement_id_fkey"
            columns: ["inventory_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mixture_batch_weighings_raw_material_batch_id_fkey"
            columns: ["raw_material_batch_id"]
            isOneToOne: false
            referencedRelation: "raw_material_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mixture_batch_weighings_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mixture_batch_weighings_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "mixture_process_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      mixture_batches: {
        Row: {
          batch_number: string
          concentration: string | null
          created_at: string
          ended_at: string | null
          execution_status: Database["public"]["Enums"]["mixture_exec_status"]
          expiry_date: string | null
          id: string
          mixture_id: string
          notes: string | null
          produced_at: string
          produced_by: string
          produced_quantity: number
          recipe_version_id: string | null
          released_at: string | null
          released_by: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["mixture_batch_status"]
          unit: string
          updated_at: string
        }
        Insert: {
          batch_number: string
          concentration?: string | null
          created_at?: string
          ended_at?: string | null
          execution_status?: Database["public"]["Enums"]["mixture_exec_status"]
          expiry_date?: string | null
          id?: string
          mixture_id: string
          notes?: string | null
          produced_at?: string
          produced_by: string
          produced_quantity: number
          recipe_version_id?: string | null
          released_at?: string | null
          released_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["mixture_batch_status"]
          unit?: string
          updated_at?: string
        }
        Update: {
          batch_number?: string
          concentration?: string | null
          created_at?: string
          ended_at?: string | null
          execution_status?: Database["public"]["Enums"]["mixture_exec_status"]
          expiry_date?: string | null
          id?: string
          mixture_id?: string
          notes?: string | null
          produced_at?: string
          produced_by?: string
          produced_quantity?: number
          recipe_version_id?: string | null
          released_at?: string | null
          released_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["mixture_batch_status"]
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mixture_batches_mixture_id_fkey"
            columns: ["mixture_id"]
            isOneToOne: false
            referencedRelation: "mixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mixture_batches_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "mixture_recipe_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      mixture_inventory_movements: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string | null
          id: string
          mixture_batch_id: string | null
          mixture_id: string
          movement_date: string
          movement_type: Database["public"]["Enums"]["mixture_movement_type"]
          quantity: number
          unit: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mixture_batch_id?: string | null
          mixture_id: string
          movement_date?: string
          movement_type: Database["public"]["Enums"]["mixture_movement_type"]
          quantity: number
          unit?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mixture_batch_id?: string | null
          mixture_id?: string
          movement_date?: string
          movement_type?: Database["public"]["Enums"]["mixture_movement_type"]
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "mixture_inventory_movements_mixture_batch_id_fkey"
            columns: ["mixture_batch_id"]
            isOneToOne: false
            referencedRelation: "mixture_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mixture_inventory_movements_mixture_id_fkey"
            columns: ["mixture_id"]
            isOneToOne: false
            referencedRelation: "mixtures"
            referencedColumns: ["id"]
          },
        ]
      }
      mixture_planned_measurements: {
        Row: {
          absolute_time: string | null
          condition_kind:
            | Database["public"]["Enums"]["step_condition_kind"]
            | null
          condition_text: string | null
          condition_unit: string | null
          condition_value: number | null
          created_at: string
          id: string
          offset_minutes: number | null
          parameter_name: string
          section_id: string
          sort_order: number
          target_value: number | null
          time_mode: Database["public"]["Enums"]["step_time_mode"]
          tolerance: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          absolute_time?: string | null
          condition_kind?:
            | Database["public"]["Enums"]["step_condition_kind"]
            | null
          condition_text?: string | null
          condition_unit?: string | null
          condition_value?: number | null
          created_at?: string
          id?: string
          offset_minutes?: number | null
          parameter_name: string
          section_id: string
          sort_order?: number
          target_value?: number | null
          time_mode?: Database["public"]["Enums"]["step_time_mode"]
          tolerance?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          absolute_time?: string | null
          condition_kind?:
            | Database["public"]["Enums"]["step_condition_kind"]
            | null
          condition_text?: string | null
          condition_unit?: string | null
          condition_value?: number | null
          created_at?: string
          id?: string
          offset_minutes?: number | null
          parameter_name?: string
          section_id?: string
          sort_order?: number
          target_value?: number | null
          time_mode?: Database["public"]["Enums"]["step_time_mode"]
          tolerance?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mixture_planned_measurements_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "mixture_process_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      mixture_process_sections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          planned_duration_min: number | null
          recipe_version_id: string
          remarks: string | null
          sort_order: number
          target_temperature: number | null
          target_unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          planned_duration_min?: number | null
          recipe_version_id: string
          remarks?: string | null
          sort_order?: number
          target_temperature?: number | null
          target_unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          planned_duration_min?: number | null
          recipe_version_id?: string
          remarks?: string | null
          sort_order?: number
          target_temperature?: number | null
          target_unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mixture_process_sections_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "mixture_recipe_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      mixture_process_steps: {
        Row: {
          absolute_time: string | null
          condition_kind:
            | Database["public"]["Enums"]["step_condition_kind"]
            | null
          condition_text: string | null
          condition_unit: string | null
          condition_value: number | null
          created_at: string
          id: string
          instruction: string | null
          offset_minutes: number | null
          planned_quantity: number | null
          raw_material_id: string | null
          section_id: string
          sort_order: number
          time_mode: Database["public"]["Enums"]["step_time_mode"]
          unit: string | null
          updated_at: string
          window_minutes: number | null
        }
        Insert: {
          absolute_time?: string | null
          condition_kind?:
            | Database["public"]["Enums"]["step_condition_kind"]
            | null
          condition_text?: string | null
          condition_unit?: string | null
          condition_value?: number | null
          created_at?: string
          id?: string
          instruction?: string | null
          offset_minutes?: number | null
          planned_quantity?: number | null
          raw_material_id?: string | null
          section_id: string
          sort_order?: number
          time_mode?: Database["public"]["Enums"]["step_time_mode"]
          unit?: string | null
          updated_at?: string
          window_minutes?: number | null
        }
        Update: {
          absolute_time?: string | null
          condition_kind?:
            | Database["public"]["Enums"]["step_condition_kind"]
            | null
          condition_text?: string | null
          condition_unit?: string | null
          condition_value?: number | null
          created_at?: string
          id?: string
          instruction?: string | null
          offset_minutes?: number | null
          planned_quantity?: number | null
          raw_material_id?: string | null
          section_id?: string
          sort_order?: number
          time_mode?: Database["public"]["Enums"]["step_time_mode"]
          unit?: string | null
          updated_at?: string
          window_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mixture_process_steps_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mixture_process_steps_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "mixture_process_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      mixture_recipe_items: {
        Row: {
          created_at: string
          id: string
          mixture_id: string
          notes: string | null
          position: number
          quantity: number
          raw_material_id: string
          recipe_version_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mixture_id: string
          notes?: string | null
          position?: number
          quantity: number
          raw_material_id: string
          recipe_version_id?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mixture_id?: string
          notes?: string | null
          position?: number
          quantity?: number
          raw_material_id?: string
          recipe_version_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mixture_recipe_items_mixture_id_fkey"
            columns: ["mixture_id"]
            isOneToOne: false
            referencedRelation: "mixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mixture_recipe_items_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mixture_recipe_items_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "mixture_recipe_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      mixture_recipe_versions: {
        Row: {
          change_reason: string | null
          change_summary: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          mixture_id: string
          notes: string | null
          parent_version_id: string | null
          updated_at: string
          version_label: string | null
          version_no: number
        }
        Insert: {
          change_reason?: string | null
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          mixture_id: string
          notes?: string | null
          parent_version_id?: string | null
          updated_at?: string
          version_label?: string | null
          version_no: number
        }
        Update: {
          change_reason?: string | null
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          mixture_id?: string
          notes?: string | null
          parent_version_id?: string | null
          updated_at?: string
          version_label?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "mixture_recipe_versions_mixture_id_fkey"
            columns: ["mixture_id"]
            isOneToOne: false
            referencedRelation: "mixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mixture_recipe_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "mixture_recipe_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      mixtures: {
        Row: {
          category: Database["public"]["Enums"]["mixture_category"]
          copied_from_mixture_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_template: boolean
          mixture_number: string | null
          name: string
          target_concentration: string | null
          template_kind:
            | Database["public"]["Enums"]["mixture_template_kind"]
            | null
          unit: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["mixture_category"]
          copied_from_mixture_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_template?: boolean
          mixture_number?: string | null
          name: string
          target_concentration?: string | null
          template_kind?:
            | Database["public"]["Enums"]["mixture_template_kind"]
            | null
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["mixture_category"]
          copied_from_mixture_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_template?: boolean
          mixture_number?: string | null
          name?: string
          target_concentration?: string | null
          template_kind?:
            | Database["public"]["Enums"]["mixture_template_kind"]
            | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mixtures_copied_from_mixture_id_fkey"
            columns: ["copied_from_mixture_id"]
            isOneToOne: false
            referencedRelation: "mixtures"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity_log"
            referencedColumns: ["id"]
          },
        ]
      }
      order_analysis_requests: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_id: string
          quantity: number
          service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id: string
          quantity?: number
          service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          quantity?: number
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_analysis_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "measurement_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_analysis_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
        ]
      }
      order_audit_log: {
        Row: {
          changed_at: string
          changed_by: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          order_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          order_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_audit_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "measurement_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_drafts: {
        Row: {
          copied_at: string | null
          copied_by: string | null
          copy_options: Json | null
          created_at: string
          created_by: string
          id: string
          order_kind: string | null
          payload: Json
          project_id: string | null
          service_count: number
          source_draft_id: string | null
          source_label: string | null
          source_order_id: string | null
          template_baseline: Json | null
          title: string | null
          updated_at: string
        }
        Insert: {
          copied_at?: string | null
          copied_by?: string | null
          copy_options?: Json | null
          created_at?: string
          created_by: string
          id?: string
          order_kind?: string | null
          payload?: Json
          project_id?: string | null
          service_count?: number
          source_draft_id?: string | null
          source_label?: string | null
          source_order_id?: string | null
          template_baseline?: Json | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          copied_at?: string | null
          copied_by?: string | null
          copy_options?: Json | null
          created_at?: string
          created_by?: string
          id?: string
          order_kind?: string | null
          payload?: Json
          project_id?: string | null
          service_count?: number
          source_draft_id?: string | null
          source_label?: string | null
          source_order_id?: string | null
          template_baseline?: Json | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_drafts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_drafts_source_draft_id_fkey"
            columns: ["source_draft_id"]
            isOneToOne: false
            referencedRelation: "order_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_drafts_source_order_id_fkey"
            columns: ["source_order_id"]
            isOneToOne: false
            referencedRelation: "measurement_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_form_versions: {
        Row: {
          created_at: string
          form_definition_id: string
          id: string
          order_id: string
          role_key: string | null
          version: number
          version_id: string | null
        }
        Insert: {
          created_at?: string
          form_definition_id: string
          id?: string
          order_id: string
          role_key?: string | null
          version: number
          version_id?: string | null
        }
        Update: {
          created_at?: string
          form_definition_id?: string
          id?: string
          order_id?: string
          role_key?: string | null
          version?: number
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_form_versions_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_form_versions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "form_definition_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_instances: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          legacy_order_id: string | null
          locked_at: string | null
          order_number: string | null
          project_id: string | null
          sample_ids: string[]
          shared_data: Json
          status: Database["public"]["Enums"]["order_instance_status"]
          template_id: string | null
          template_snapshot: Json
          title: string | null
          updated_at: string
          workflow_status: Database["public"]["Enums"]["order_workflow_status_new"]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          legacy_order_id?: string | null
          locked_at?: string | null
          order_number?: string | null
          project_id?: string | null
          sample_ids?: string[]
          shared_data?: Json
          status?: Database["public"]["Enums"]["order_instance_status"]
          template_id?: string | null
          template_snapshot?: Json
          title?: string | null
          updated_at?: string
          workflow_status?: Database["public"]["Enums"]["order_workflow_status_new"]
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          legacy_order_id?: string | null
          locked_at?: string | null
          order_number?: string | null
          project_id?: string | null
          sample_ids?: string[]
          shared_data?: Json
          status?: Database["public"]["Enums"]["order_instance_status"]
          template_id?: string | null
          template_snapshot?: Json
          title?: string | null
          updated_at?: string
          workflow_status?: Database["public"]["Enums"]["order_workflow_status_new"]
        }
        Relationships: [
          {
            foreignKeyName: "order_instances_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      order_kind_form_templates: {
        Row: {
          created_at: string
          form_definition_id: string
          order_kind: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          form_definition_id: string
          order_kind: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          form_definition_id?: string
          order_kind?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_kind_form_templates_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_measurements: {
        Row: {
          actual_duration_hours: number | null
          analysis_request_id: string | null
          assigned_to: string | null
          created_at: string
          depends_on_step_keys: string[]
          due_date: string | null
          duration_deviation_reason: string | null
          estimated_delivery_date: string | null
          id: string
          measurement_number: string
          order_id: string
          origin: string
          original_sample_id: string | null
          planned_end_date: string | null
          planned_hours: number | null
          planned_start_date: string | null
          priority: number
          processing_time_hours: number
          ranking: number | null
          sample_id: string | null
          service_id: string
          source_measurement_id: string | null
          source_package_id: string | null
          source_package_name_snapshot: string | null
          source_step_key: string | null
          status: Database["public"]["Enums"]["measurement_status"]
          updated_at: string
          workstation_id: string | null
        }
        Insert: {
          actual_duration_hours?: number | null
          analysis_request_id?: string | null
          assigned_to?: string | null
          created_at?: string
          depends_on_step_keys?: string[]
          due_date?: string | null
          duration_deviation_reason?: string | null
          estimated_delivery_date?: string | null
          id?: string
          measurement_number: string
          order_id: string
          origin?: string
          original_sample_id?: string | null
          planned_end_date?: string | null
          planned_hours?: number | null
          planned_start_date?: string | null
          priority?: number
          processing_time_hours?: number
          ranking?: number | null
          sample_id?: string | null
          service_id: string
          source_measurement_id?: string | null
          source_package_id?: string | null
          source_package_name_snapshot?: string | null
          source_step_key?: string | null
          status?: Database["public"]["Enums"]["measurement_status"]
          updated_at?: string
          workstation_id?: string | null
        }
        Update: {
          actual_duration_hours?: number | null
          analysis_request_id?: string | null
          assigned_to?: string | null
          created_at?: string
          depends_on_step_keys?: string[]
          due_date?: string | null
          duration_deviation_reason?: string | null
          estimated_delivery_date?: string | null
          id?: string
          measurement_number?: string
          order_id?: string
          origin?: string
          original_sample_id?: string | null
          planned_end_date?: string | null
          planned_hours?: number | null
          planned_start_date?: string | null
          priority?: number
          processing_time_hours?: number
          ranking?: number | null
          sample_id?: string | null
          service_id?: string
          source_measurement_id?: string | null
          source_package_id?: string | null
          source_package_name_snapshot?: string | null
          source_step_key?: string | null
          status?: Database["public"]["Enums"]["measurement_status"]
          updated_at?: string
          workstation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_measurements_analysis_request_id_fkey"
            columns: ["analysis_request_id"]
            isOneToOne: false
            referencedRelation: "order_analysis_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_measurements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "measurement_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_measurements_original_sample_id_fkey"
            columns: ["original_sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_measurements_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_measurements_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_measurements_source_measurement_id_fkey"
            columns: ["source_measurement_id"]
            isOneToOne: false
            referencedRelation: "order_measurements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_measurements_source_package_id_fkey"
            columns: ["source_package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_measurements_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_process_services: {
        Row: {
          assigned_role: string | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
          order_process_id: string
          service_id: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_role?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number
          order_process_id: string
          service_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_role?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          order_process_id?: string
          service_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_process_services_order_process_id_fkey"
            columns: ["order_process_id"]
            isOneToOne: false
            referencedRelation: "order_processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_process_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
        ]
      }
      order_processes: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          order_id: string
          order_index: number
          process_template_id: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_id: string
          order_index?: number
          process_template_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_id?: string
          order_index?: number
          process_template_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_processes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "measurement_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_processes_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      order_report_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          change_reason: string | null
          created_at: string
          data_snapshot: Json
          generated_by: string | null
          id: string
          layout_snapshot: Json
          pdf_storage_path: string | null
          report_id: string
          updated_at: string
          version_no: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          change_reason?: string | null
          created_at?: string
          data_snapshot?: Json
          generated_by?: string | null
          id?: string
          layout_snapshot?: Json
          pdf_storage_path?: string | null
          report_id: string
          updated_at?: string
          version_no: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          change_reason?: string | null
          created_at?: string
          data_snapshot?: Json
          generated_by?: string | null
          id?: string
          layout_snapshot?: Json
          pdf_storage_path?: string | null
          report_id?: string
          updated_at?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_report_versions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "order_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      order_reports: {
        Row: {
          auto_generated: boolean
          created_at: string
          current_version_no: number
          draft_overrides: Json
          id: string
          order_id: string
          updated_at: string
        }
        Insert: {
          auto_generated?: boolean
          created_at?: string
          current_version_no?: number
          draft_overrides?: Json
          id?: string
          order_id: string
          updated_at?: string
        }
        Update: {
          auto_generated?: boolean
          created_at?: string
          current_version_no?: number
          draft_overrides?: Json
          id?: string
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_reports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "measurement_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_samples: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_replacement: boolean
          order_id: string
          replaced_at: string | null
          replaced_by: string | null
          replaced_by_order_sample_id: string | null
          replacement_note: string | null
          replacement_reason: string | null
          replaces_order_sample_id: string | null
          sample_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_replacement?: boolean
          order_id: string
          replaced_at?: string | null
          replaced_by?: string | null
          replaced_by_order_sample_id?: string | null
          replacement_note?: string | null
          replacement_reason?: string | null
          replaces_order_sample_id?: string | null
          sample_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_replacement?: boolean
          order_id?: string
          replaced_at?: string | null
          replaced_by?: string | null
          replaced_by_order_sample_id?: string | null
          replacement_note?: string | null
          replacement_reason?: string | null
          replaces_order_sample_id?: string | null
          sample_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_samples_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "measurement_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_samples_replaced_by_order_sample_id_fkey"
            columns: ["replaced_by_order_sample_id"]
            isOneToOne: false
            referencedRelation: "order_samples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_samples_replaces_order_sample_id_fkey"
            columns: ["replaces_order_sample_id"]
            isOneToOne: false
            referencedRelation: "order_samples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_samples_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
        ]
      }
      order_service_forms: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          form_definition_id: string | null
          id: string
          name: string
          order_index: number
          order_process_service_id: string
          response_data: Json
          role_view_key: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          form_definition_id?: string | null
          id?: string
          name: string
          order_index?: number
          order_process_service_id: string
          response_data?: Json
          role_view_key?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          form_definition_id?: string | null
          id?: string
          name?: string
          order_index?: number
          order_process_service_id?: string
          response_data?: Json
          role_view_key?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_service_forms_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_service_forms_order_process_service_id_fkey"
            columns: ["order_process_service_id"]
            isOneToOne: false
            referencedRelation: "order_process_services"
            referencedColumns: ["id"]
          },
        ]
      }
      order_step_positions: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          label: string | null
          not_feasible_reason: string | null
          position_ref: string | null
          remarks: string | null
          result_data: Json
          result_value: string | null
          sample_id: string | null
          status: Database["public"]["Enums"]["step_position_status"]
          step_run_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          label?: string | null
          not_feasible_reason?: string | null
          position_ref?: string | null
          remarks?: string | null
          result_data?: Json
          result_value?: string | null
          sample_id?: string | null
          status?: Database["public"]["Enums"]["step_position_status"]
          step_run_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          label?: string | null
          not_feasible_reason?: string | null
          position_ref?: string | null
          remarks?: string | null
          result_data?: Json
          result_value?: string | null
          sample_id?: string | null
          status?: Database["public"]["Enums"]["step_position_status"]
          step_run_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_step_positions_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_step_positions_step_run_id_fkey"
            columns: ["step_run_id"]
            isOneToOne: false
            referencedRelation: "order_step_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      order_step_runs: {
        Row: {
          assigned_role: string | null
          assigned_to: string | null
          auto_time_minutes: number | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          form_response: Json
          id: string
          notes: string | null
          opened_at: string | null
          opened_by: string | null
          order_id: string
          order_index: number
          status: Database["public"]["Enums"]["step_run_status"]
          step_id: string | null
          step_key: string
          step_snapshot: Json
          time_entry_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_role?: string | null
          assigned_to?: string | null
          auto_time_minutes?: number | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          form_response?: Json
          id?: string
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          order_id: string
          order_index?: number
          status?: Database["public"]["Enums"]["step_run_status"]
          step_id?: string | null
          step_key: string
          step_snapshot?: Json
          time_entry_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_role?: string | null
          assigned_to?: string | null
          auto_time_minutes?: number | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          form_response?: Json
          id?: string
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          order_id?: string
          order_index?: number
          status?: Database["public"]["Enums"]["step_run_status"]
          step_id?: string | null
          step_key?: string
          step_snapshot?: Json
          time_entry_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_step_runs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_step_runs_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "process_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      order_upload_files: {
        Row: {
          created_at: string
          entry_index: number | null
          field_key: string
          file_name: string
          file_size_bytes: number | null
          file_type: string | null
          id: string
          measurement_id: string
          storage_path: string
          template_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          entry_index?: number | null
          field_key: string
          file_name: string
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          measurement_id: string
          storage_path: string
          template_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          entry_index?: number | null
          field_key?: string
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          measurement_id?: string
          storage_path?: string
          template_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_upload_files_measurement_id_fkey"
            columns: ["measurement_id"]
            isOneToOne: false
            referencedRelation: "order_measurements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_upload_files_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "service_field_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      order_workflow_instances: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step_id: string | null
          id: string
          order_id: string
          started_at: string
          status: string
          updated_at: string
          workflow_id: string
          workflow_version: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step_id?: string | null
          id?: string
          order_id: string
          started_at?: string
          status?: string
          updated_at?: string
          workflow_id: string
          workflow_version: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step_id?: string | null
          id?: string
          order_id?: string
          started_at?: string
          status?: string
          updated_at?: string
          workflow_id?: string
          workflow_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_workflow_instances_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "service_workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_workflow_instances_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "measurement_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_workflow_instances_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "service_workflow_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_workflow_task_positions: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          not_feasible_reason: string | null
          position_label: string | null
          remarks: string | null
          result_value: string | null
          sample_id: string | null
          status: string
          task_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          not_feasible_reason?: string | null
          position_label?: string | null
          remarks?: string | null
          result_value?: string | null
          sample_id?: string | null
          status?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          not_feasible_reason?: string | null
          position_label?: string | null
          remarks?: string | null
          result_value?: string | null
          sample_id?: string | null
          status?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_workflow_task_positions_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_workflow_task_positions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "order_workflow_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      order_workflow_tasks: {
        Row: {
          assigned_role: string | null
          assigned_to: string | null
          auto_time_minutes: number | null
          completed_at: string | null
          created_at: string
          due_at: string | null
          form_id: string | null
          form_response: Json
          id: string
          instance_id: string
          notes: string | null
          opened_at: string | null
          order_id: string
          priority: string | null
          status: string
          step_id: string
          time_entry_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_role?: string | null
          assigned_to?: string | null
          auto_time_minutes?: number | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          form_id?: string | null
          form_response?: Json
          id?: string
          instance_id: string
          notes?: string | null
          opened_at?: string | null
          order_id: string
          priority?: string | null
          status?: string
          step_id: string
          time_entry_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_role?: string | null
          assigned_to?: string | null
          auto_time_minutes?: number | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          form_id?: string | null
          form_response?: Json
          id?: string
          instance_id?: string
          notes?: string | null
          opened_at?: string | null
          order_id?: string
          priority?: string | null
          status?: string
          step_id?: string
          time_entry_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_workflow_tasks_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "service_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_workflow_tasks_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "order_workflow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_workflow_tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "measurement_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_workflow_tasks_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "service_workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_workflow_tasks_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "project_time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          performed_by: string | null
          target_user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          performed_by?: string | null
          target_user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          performed_by?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      pilot_plant_blocks: {
        Row: {
          assigned_role: string | null
          assigned_to: string | null
          block_key: Database["public"]["Enums"]["pilot_plant_block_key"]
          completed_at: string | null
          completed_by: string | null
          created_at: string
          data: Json
          id: string
          notes: string | null
          order_id: string
          order_index: number
          started_at: string | null
          started_by: string | null
          status: Database["public"]["Enums"]["pilot_plant_block_status"]
          updated_at: string
        }
        Insert: {
          assigned_role?: string | null
          assigned_to?: string | null
          block_key: Database["public"]["Enums"]["pilot_plant_block_key"]
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          data?: Json
          id?: string
          notes?: string | null
          order_id: string
          order_index: number
          started_at?: string | null
          started_by?: string | null
          status?: Database["public"]["Enums"]["pilot_plant_block_status"]
          updated_at?: string
        }
        Update: {
          assigned_role?: string | null
          assigned_to?: string | null
          block_key?: Database["public"]["Enums"]["pilot_plant_block_key"]
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          data?: Json
          id?: string
          notes?: string | null
          order_id?: string
          order_index?: number
          started_at?: string | null
          started_by?: string | null
          status?: Database["public"]["Enums"]["pilot_plant_block_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_plant_blocks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "measurement_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_plant_produced_samples: {
        Row: {
          block_id: string | null
          created_at: string
          created_order_id: string | null
          created_sample_id: string | null
          id: string
          label: string
          marking: string | null
          notes: string | null
          order_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          block_id?: string | null
          created_at?: string
          created_order_id?: string | null
          created_sample_id?: string | null
          id?: string
          label: string
          marking?: string | null
          notes?: string | null
          order_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          block_id?: string | null
          created_at?: string
          created_order_id?: string | null
          created_sample_id?: string | null
          id?: string
          label?: string
          marking?: string | null
          notes?: string | null
          order_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_plant_produced_samples_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "pilot_plant_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_plant_produced_samples_created_order_id_fkey"
            columns: ["created_order_id"]
            isOneToOne: false
            referencedRelation: "measurement_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_plant_produced_samples_created_sample_id_fkey"
            columns: ["created_sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_plant_produced_samples_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "measurement_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_structure_audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          entity_id: string
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
          portfolio_id: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          portfolio_id?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          portfolio_id?: string | null
        }
        Relationships: []
      }
      portfolio_task_project_wp_map: {
        Row: {
          created_at: string
          created_by: string | null
          funding_relevant: boolean
          funding_share_pct: number
          id: string
          note: string | null
          portfolio_task_id: string
          project_work_package_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          funding_relevant?: boolean
          funding_share_pct?: number
          id?: string
          note?: string | null
          portfolio_task_id: string
          project_work_package_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          funding_relevant?: boolean
          funding_share_pct?: number
          id?: string
          note?: string | null
          portfolio_task_id?: string
          project_work_package_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_task_project_wp_map_portfolio_task_id_fkey"
            columns: ["portfolio_task_id"]
            isOneToOne: false
            referencedRelation: "portfolio_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_task_project_wp_map_project_work_package_id_fkey"
            columns: ["project_work_package_id"]
            isOneToOne: true
            referencedRelation: "project_work_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_task_project_wp_map_project_work_package_id_fkey"
            columns: ["project_work_package_id"]
            isOneToOne: true
            referencedRelation: "v_project_wp_without_funding"
            referencedColumns: ["project_work_package_id"]
          },
        ]
      }
      portfolio_tasks: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          planned_effort_hours: number | null
          portfolio_work_package_id: string
          sort_order: number
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          planned_effort_hours?: number | null
          portfolio_work_package_id: string
          sort_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          planned_effort_hours?: number | null
          portfolio_work_package_id?: string
          sort_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_tasks_portfolio_work_package_id_fkey"
            columns: ["portfolio_work_package_id"]
            isOneToOne: false
            referencedRelation: "portfolio_work_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_work_packages: {
        Row: {
          budget: number | null
          category_id: string | null
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          portfolio_id: string
          responsible_user_id: string | null
          sort_order: number
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          category_id?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          portfolio_id: string
          responsible_user_id?: string | null
          sort_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          category_id?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          portfolio_id?: string
          responsible_user_id?: string | null
          sort_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_work_packages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "work_package_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_work_packages_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "project_portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_wp_project_wp_map: {
        Row: {
          created_at: string
          created_by: string | null
          funding_relevant: boolean
          funding_share_pct: number
          id: string
          note: string | null
          portfolio_work_package_id: string
          project_work_package_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          funding_relevant?: boolean
          funding_share_pct?: number
          id?: string
          note?: string | null
          portfolio_work_package_id: string
          project_work_package_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          funding_relevant?: boolean
          funding_share_pct?: number
          id?: string
          note?: string | null
          portfolio_work_package_id?: string
          project_work_package_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_wp_project_wp_map_portfolio_work_package_id_fkey"
            columns: ["portfolio_work_package_id"]
            isOneToOne: false
            referencedRelation: "portfolio_work_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_wp_project_wp_map_project_work_package_id_fkey"
            columns: ["project_work_package_id"]
            isOneToOne: true
            referencedRelation: "project_work_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_wp_project_wp_map_project_work_package_id_fkey"
            columns: ["project_work_package_id"]
            isOneToOne: true
            referencedRelation: "v_project_wp_without_funding"
            referencedColumns: ["project_work_package_id"]
          },
        ]
      }
      process_service_links: {
        Row: {
          created_at: string
          id: string
          order_index: number
          process_template_id: string
          service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number
          process_template_id: string
          service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          process_template_id?: string
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_service_links_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_service_links_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
        ]
      }
      process_step_raw_materials: {
        Row: {
          created_at: string
          id: string
          note: string | null
          raw_material_id: string
          sort_order: number
          step_id: string
          target_quantity: number
          tolerance_percent: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          raw_material_id: string
          sort_order?: number
          step_id: string
          target_quantity: number
          tolerance_percent?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          raw_material_id?: string
          sort_order?: number
          step_id?: string
          target_quantity?: number
          tolerance_percent?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_step_raw_materials_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_step_raw_materials_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "process_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      process_steps: {
        Row: {
          assignee_rule: Json
          auto_actions: Json
          condition_expr: Json
          created_at: string
          creates_subsample: boolean
          depends_on_step_keys: string[]
          description: string | null
          due_hours: number | null
          escalation_role: string | null
          form_id: string | null
          id: string
          is_mandatory: boolean
          locked_field_ids: Json
          metadata: Json
          name: string
          order_index: number
          position_source: string | null
          role_required: string | null
          role_view_key: string | null
          service_id: string | null
          step_key: string
          step_kind: string
          template_id: string
          updated_at: string
        }
        Insert: {
          assignee_rule?: Json
          auto_actions?: Json
          condition_expr?: Json
          created_at?: string
          creates_subsample?: boolean
          depends_on_step_keys?: string[]
          description?: string | null
          due_hours?: number | null
          escalation_role?: string | null
          form_id?: string | null
          id?: string
          is_mandatory?: boolean
          locked_field_ids?: Json
          metadata?: Json
          name: string
          order_index?: number
          position_source?: string | null
          role_required?: string | null
          role_view_key?: string | null
          service_id?: string | null
          step_key: string
          step_kind?: string
          template_id: string
          updated_at?: string
        }
        Update: {
          assignee_rule?: Json
          auto_actions?: Json
          condition_expr?: Json
          created_at?: string
          creates_subsample?: boolean
          depends_on_step_keys?: string[]
          description?: string | null
          due_hours?: number | null
          escalation_role?: string | null
          form_id?: string | null
          id?: string
          is_mandatory?: boolean
          locked_field_ids?: Json
          metadata?: Json
          name?: string
          order_index?: number
          position_source?: string | null
          role_required?: string | null
          role_view_key?: string | null
          service_id?: string | null
          step_key?: string
          step_kind?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_steps_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_steps_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      process_templates: {
        Row: {
          archived_at: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["process_template_kind"]
          legacy_service_id: string | null
          metadata: Json
          name: string
          scope: Database["public"]["Enums"]["process_template_scope"]
          updated_at: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["process_template_kind"]
          legacy_service_id?: string | null
          metadata?: Json
          name: string
          scope?: Database["public"]["Enums"]["process_template_scope"]
          updated_at?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["process_template_kind"]
          legacy_service_id?: string | null
          metadata?: Json
          name?: string
          scope?: Database["public"]["Enums"]["process_template_scope"]
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          must_change_password: boolean
          short_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          must_change_password?: boolean
          short_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          must_change_password?: boolean
          short_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_change_log: {
        Row: {
          changed_by: string | null
          created_at: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          project_id: string
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id: string
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_change_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_change_requests: {
        Row: {
          approval_date: string | null
          approval_status: Database["public"]["Enums"]["change_request_status"]
          approver_id: string | null
          created_at: string
          description: string | null
          id: string
          impact_budget: number | null
          impact_description: string | null
          impact_schedule_days: number | null
          project_id: string
          related_milestone_id: string | null
          requested_by: string
          title: string
          updated_at: string
        }
        Insert: {
          approval_date?: string | null
          approval_status?: Database["public"]["Enums"]["change_request_status"]
          approver_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          impact_budget?: number | null
          impact_description?: string | null
          impact_schedule_days?: number | null
          project_id: string
          related_milestone_id?: string | null
          requested_by: string
          title: string
          updated_at?: string
        }
        Update: {
          approval_date?: string | null
          approval_status?: Database["public"]["Enums"]["change_request_status"]
          approver_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          impact_budget?: number | null
          impact_description?: string | null
          impact_schedule_days?: number | null
          project_id?: string
          related_milestone_id?: string | null
          requested_by?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_change_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_change_requests_related_milestone_id_fkey"
            columns: ["related_milestone_id"]
            isOneToOne: false
            referencedRelation: "project_milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      project_closure_reports: {
        Row: {
          achieved_goals: string | null
          actual_end_date: string | null
          approval_date: string | null
          budget_actual: number | null
          budget_currency: string | null
          budget_deviation_explanation: string | null
          budget_planned: number | null
          created_at: string
          created_by: string
          customer_satisfaction: number | null
          delivered_results: Json | null
          deviation_reasons: string | null
          final_remarks: string | null
          id: string
          key_changes_summary: string | null
          key_decisions_summary: string | null
          missed_goals: string | null
          open_items: Json | null
          original_goals: string | null
          planned_end_date: string | null
          project_id: string
          project_leader_id: string | null
          project_leader_signed_at: string | null
          quality_assessment: string | null
          recommendations: string | null
          related_change_request_ids: string[] | null
          related_decision_ids: string[] | null
          risks_occurred: string | null
          schedule_deviation_days: number | null
          schedule_root_cause: string | null
          sponsor_id: string | null
          sponsor_name: string | null
          sponsor_signed_at: string | null
          status: Database["public"]["Enums"]["project_closure_status"]
          success_factors: string | null
          updated_at: string
          updated_by: string | null
          went_well: string | null
          went_wrong: string | null
        }
        Insert: {
          achieved_goals?: string | null
          actual_end_date?: string | null
          approval_date?: string | null
          budget_actual?: number | null
          budget_currency?: string | null
          budget_deviation_explanation?: string | null
          budget_planned?: number | null
          created_at?: string
          created_by: string
          customer_satisfaction?: number | null
          delivered_results?: Json | null
          deviation_reasons?: string | null
          final_remarks?: string | null
          id?: string
          key_changes_summary?: string | null
          key_decisions_summary?: string | null
          missed_goals?: string | null
          open_items?: Json | null
          original_goals?: string | null
          planned_end_date?: string | null
          project_id: string
          project_leader_id?: string | null
          project_leader_signed_at?: string | null
          quality_assessment?: string | null
          recommendations?: string | null
          related_change_request_ids?: string[] | null
          related_decision_ids?: string[] | null
          risks_occurred?: string | null
          schedule_deviation_days?: number | null
          schedule_root_cause?: string | null
          sponsor_id?: string | null
          sponsor_name?: string | null
          sponsor_signed_at?: string | null
          status?: Database["public"]["Enums"]["project_closure_status"]
          success_factors?: string | null
          updated_at?: string
          updated_by?: string | null
          went_well?: string | null
          went_wrong?: string | null
        }
        Update: {
          achieved_goals?: string | null
          actual_end_date?: string | null
          approval_date?: string | null
          budget_actual?: number | null
          budget_currency?: string | null
          budget_deviation_explanation?: string | null
          budget_planned?: number | null
          created_at?: string
          created_by?: string
          customer_satisfaction?: number | null
          delivered_results?: Json | null
          deviation_reasons?: string | null
          final_remarks?: string | null
          id?: string
          key_changes_summary?: string | null
          key_decisions_summary?: string | null
          missed_goals?: string | null
          open_items?: Json | null
          original_goals?: string | null
          planned_end_date?: string | null
          project_id?: string
          project_leader_id?: string | null
          project_leader_signed_at?: string | null
          quality_assessment?: string | null
          recommendations?: string | null
          related_change_request_ids?: string[] | null
          related_decision_ids?: string[] | null
          risks_occurred?: string | null
          schedule_deviation_days?: number | null
          schedule_root_cause?: string | null
          sponsor_id?: string | null
          sponsor_name?: string | null
          sponsor_signed_at?: string | null
          status?: Database["public"]["Enums"]["project_closure_status"]
          success_factors?: string | null
          updated_at?: string
          updated_by?: string | null
          went_well?: string | null
          went_wrong?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_closure_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_consumables: {
        Row: {
          comment: string | null
          consumable_id: string
          created_at: string
          created_by: string
          id: string
          project_id: string
          quantity: number
          total_cost: number | null
          unit_price: number
        }
        Insert: {
          comment?: string | null
          consumable_id: string
          created_at?: string
          created_by: string
          id?: string
          project_id: string
          quantity: number
          total_cost?: number | null
          unit_price: number
        }
        Update: {
          comment?: string | null
          consumable_id?: string
          created_at?: string
          created_by?: string
          id?: string
          project_id?: string
          quantity?: number
          total_cost?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_consumables_consumable_id_fkey"
            columns: ["consumable_id"]
            isOneToOne: false
            referencedRelation: "consumables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_consumables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_decisions: {
        Row: {
          affected_areas: string[] | null
          created_at: string
          created_by: string
          decided_by: string | null
          decision_date: string
          id: string
          project_id: string
          rationale: string | null
          related_milestone_id: string | null
          status: Database["public"]["Enums"]["decision_status"]
          superseded_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          affected_areas?: string[] | null
          created_at?: string
          created_by: string
          decided_by?: string | null
          decision_date?: string
          id?: string
          project_id: string
          rationale?: string | null
          related_milestone_id?: string | null
          status?: Database["public"]["Enums"]["decision_status"]
          superseded_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          affected_areas?: string[] | null
          created_at?: string
          created_by?: string
          decided_by?: string | null
          decision_date?: string
          id?: string
          project_id?: string
          rationale?: string | null
          related_milestone_id?: string | null
          status?: Database["public"]["Enums"]["decision_status"]
          superseded_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_decisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_decisions_related_milestone_id_fkey"
            columns: ["related_milestone_id"]
            isOneToOne: false
            referencedRelation: "project_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_decisions_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "project_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          change_comment: string | null
          created_at: string
          doc_kind: Database["public"]["Enums"]["project_document_kind"]
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          is_current: boolean
          project_id: string
          storage_path: string
          uploaded_by: string
          version_label: string | null
          version_major: number
          version_minor: number
        }
        Insert: {
          change_comment?: string | null
          created_at?: string
          doc_kind: Database["public"]["Enums"]["project_document_kind"]
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_current?: boolean
          project_id: string
          storage_path: string
          uploaded_by: string
          version_label?: string | null
          version_major?: number
          version_minor?: number
        }
        Update: {
          change_comment?: string | null
          created_at?: string
          doc_kind?: Database["public"]["Enums"]["project_document_kind"]
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_current?: boolean
          project_id?: string
          storage_path?: string
          uploaded_by?: string
          version_label?: string | null
          version_major?: number
          version_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_expense_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key: string
          name_de: string
          name_en: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key: string
          name_de: string
          name_en: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key?: string
          name_de?: string
          name_en?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      project_expenses: {
        Row: {
          category_id: string | null
          cost_center: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          id: string
          name: string
          notes: string | null
          project_id: string
          project_leader_id: string | null
          quantity: number | null
          supplier: string | null
          total_price: number | null
          unit: string | null
          unit_price: number | null
          updated_at: string
          work_package_id: string | null
        }
        Insert: {
          category_id?: string | null
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          name: string
          notes?: string | null
          project_id: string
          project_leader_id?: string | null
          quantity?: number | null
          supplier?: string | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
          work_package_id?: string | null
        }
        Update: {
          category_id?: string | null
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          name?: string
          notes?: string | null
          project_id?: string
          project_leader_id?: string | null
          quantity?: number | null
          supplier?: string | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
          work_package_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "project_expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_work_package_id_fkey"
            columns: ["work_package_id"]
            isOneToOne: false
            referencedRelation: "project_work_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_work_package_id_fkey"
            columns: ["work_package_id"]
            isOneToOne: false
            referencedRelation: "v_project_wp_without_funding"
            referencedColumns: ["project_work_package_id"]
          },
        ]
      }
      project_knetung_materials: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string
          id: string
          order_measurement_id: string | null
          price_per_kg: number
          project_id: string
          quantity_kg: number
          raw_material_id: string
          source_inventory_movement_id: string | null
          total_cost: number | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by: string
          id?: string
          order_measurement_id?: string | null
          price_per_kg: number
          project_id: string
          quantity_kg: number
          raw_material_id: string
          source_inventory_movement_id?: string | null
          total_cost?: number | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string
          id?: string
          order_measurement_id?: string | null
          price_per_kg?: number
          project_id?: string
          quantity_kg?: number
          raw_material_id?: string
          source_inventory_movement_id?: string | null
          total_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_knetung_materials_order_measurement_id_fkey"
            columns: ["order_measurement_id"]
            isOneToOne: false
            referencedRelation: "order_measurements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_knetung_materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_knetung_materials_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_knetung_materials_source_inventory_movement_id_fkey"
            columns: ["source_inventory_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      project_lessons_learned: {
        Row: {
          created_at: string
          created_by: string
          follow_up_actions: string | null
          id: string
          overall_rating: number | null
          project_id: string
          recommendations: string | null
          related_weekly_review_ids: string[] | null
          updated_at: string
          went_well: string | null
          went_wrong: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          follow_up_actions?: string | null
          id?: string
          overall_rating?: number | null
          project_id: string
          recommendations?: string | null
          related_weekly_review_ids?: string[] | null
          updated_at?: string
          went_well?: string | null
          went_wrong?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          follow_up_actions?: string | null
          id?: string
          overall_rating?: number | null
          project_id?: string
          recommendations?: string | null
          related_weekly_review_ids?: string[] | null
          updated_at?: string
          went_well?: string | null
          went_wrong?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_lessons_learned_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          milestone_date: string | null
          project_id: string
          status: Database["public"]["Enums"]["milestone_status"]
          title: string
          updated_at: string
          work_package_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          milestone_date?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["milestone_status"]
          title: string
          updated_at?: string
          work_package_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          milestone_date?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["milestone_status"]
          title?: string
          updated_at?: string
          work_package_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_milestones_work_package_id_fkey"
            columns: ["work_package_id"]
            isOneToOne: false
            referencedRelation: "project_work_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_milestones_work_package_id_fkey"
            columns: ["work_package_id"]
            isOneToOne: false
            referencedRelation: "v_project_wp_without_funding"
            referencedColumns: ["project_work_package_id"]
          },
        ]
      }
      project_portfolio_documents: {
        Row: {
          category: Database["public"]["Enums"]["portfolio_document_category"]
          created_at: string
          description: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          portfolio_id: string
          supersedes_id: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["portfolio_document_category"]
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          portfolio_id: string
          supersedes_id?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["portfolio_document_category"]
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          portfolio_id?: string
          supersedes_id?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_portfolio_documents_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "project_portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_portfolio_documents_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "project_portfolio_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      project_portfolio_members: {
        Row: {
          added_by: string | null
          contribution_goal: string | null
          contribution_summary: string | null
          created_at: string
          current_status: string | null
          id: string
          key_results: string | null
          portfolio_id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          contribution_goal?: string | null
          contribution_summary?: string | null
          created_at?: string
          current_status?: string | null
          id?: string
          key_results?: string | null
          portfolio_id: string
          project_id: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          contribution_goal?: string | null
          contribution_summary?: string | null
          created_at?: string
          current_status?: string | null
          id?: string
          key_results?: string | null
          portfolio_id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_portfolio_members_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "project_portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_portfolio_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_portfolio_milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          milestone_type: Database["public"]["Enums"]["portfolio_milestone_type"]
          portfolio_id: string
          sort_order: number
          status: Database["public"]["Enums"]["portfolio_milestone_status"]
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          milestone_type?: Database["public"]["Enums"]["portfolio_milestone_type"]
          portfolio_id: string
          sort_order?: number
          status?: Database["public"]["Enums"]["portfolio_milestone_status"]
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          milestone_type?: Database["public"]["Enums"]["portfolio_milestone_type"]
          portfolio_id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["portfolio_milestone_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_portfolio_milestones_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "project_portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      project_portfolio_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          name: string
          notes: string | null
          portfolio_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          name: string
          notes?: string | null
          portfolio_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          notes?: string | null
          portfolio_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_portfolio_periods_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "project_portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      project_portfolios: {
        Row: {
          approved_budget: number | null
          category: string | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          funding_body: string | null
          funding_program: string | null
          health_note: string | null
          health_updated_at: string | null
          health_updated_by: string | null
          id: string
          name: string
          notes: string | null
          planned_budget: number | null
          responsible_user_id: string | null
          short_code: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["portfolio_status"]
          traffic_light: string
          updated_at: string
        }
        Insert: {
          approved_budget?: number | null
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          funding_body?: string | null
          funding_program?: string | null
          health_note?: string | null
          health_updated_at?: string | null
          health_updated_by?: string | null
          id?: string
          name: string
          notes?: string | null
          planned_budget?: number | null
          responsible_user_id?: string | null
          short_code?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["portfolio_status"]
          traffic_light?: string
          updated_at?: string
        }
        Update: {
          approved_budget?: number | null
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          funding_body?: string | null
          funding_program?: string | null
          health_note?: string | null
          health_updated_at?: string | null
          health_updated_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          planned_budget?: number | null
          responsible_user_id?: string | null
          short_code?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["portfolio_status"]
          traffic_light?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_report_results: {
        Row: {
          created_at: string
          id: string
          measurement_result_id: string
          report_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          measurement_result_id: string
          report_id: string
        }
        Update: {
          created_at?: string
          id?: string
          measurement_result_id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_report_results_measurement_result_id_fkey"
            columns: ["measurement_result_id"]
            isOneToOne: false
            referencedRelation: "measurement_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_report_results_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "project_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      project_reports: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          project_id: string
          report_kind: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          project_id: string
          report_kind?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          project_id?: string
          report_kind?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_services: {
        Row: {
          booked_at: string
          booked_by: string
          created_at: string
          id: string
          project_id: string
          service_id: string
        }
        Insert: {
          booked_at?: string
          booked_by: string
          created_at?: string
          id?: string
          project_id: string
          service_id: string
        }
        Update: {
          booked_at?: string
          booked_by?: string
          created_at?: string
          id?: string
          project_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_services_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stakeholders: {
        Row: {
          channel: Database["public"]["Enums"]["stakeholder_channel"] | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          frequency: Database["public"]["Enums"]["stakeholder_frequency"] | null
          id: string
          last_contact_at: string | null
          name: string
          notes: string | null
          organization: string | null
          project_id: string
          responsible_user_id: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["stakeholder_channel"] | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          frequency?:
            | Database["public"]["Enums"]["stakeholder_frequency"]
            | null
          id?: string
          last_contact_at?: string | null
          name: string
          notes?: string | null
          organization?: string | null
          project_id: string
          responsible_user_id?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["stakeholder_channel"] | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          frequency?:
            | Database["public"]["Enums"]["stakeholder_frequency"]
            | null
          id?: string
          last_contact_at?: string | null
          name?: string
          notes?: string | null
          organization?: string | null
          project_id?: string
          responsible_user_id?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_stakeholders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_time_entries: {
        Row: {
          created_at: string
          created_by: string
          duration_minutes: number
          entry_date: string
          entry_type: string
          id: string
          meeting_group_id: string | null
          note: string
          order_id: string | null
          person_id: string
          portfolio_id: string | null
          portfolio_task_id: string | null
          portfolio_work_package_id: string | null
          project_id: string | null
          updated_at: string
          work_package_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          duration_minutes: number
          entry_date?: string
          entry_type?: string
          id?: string
          meeting_group_id?: string | null
          note?: string
          order_id?: string | null
          person_id: string
          portfolio_id?: string | null
          portfolio_task_id?: string | null
          portfolio_work_package_id?: string | null
          project_id?: string | null
          updated_at?: string
          work_package_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_minutes?: number
          entry_date?: string
          entry_type?: string
          id?: string
          meeting_group_id?: string | null
          note?: string
          order_id?: string | null
          person_id?: string
          portfolio_id?: string | null
          portfolio_task_id?: string | null
          portfolio_work_package_id?: string | null
          project_id?: string | null
          updated_at?: string
          work_package_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_time_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "measurement_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entries_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "project_portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entries_portfolio_task_id_fkey"
            columns: ["portfolio_task_id"]
            isOneToOne: false
            referencedRelation: "portfolio_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entries_portfolio_work_package_id_fkey"
            columns: ["portfolio_work_package_id"]
            isOneToOne: false
            referencedRelation: "portfolio_work_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entries_work_package_id_fkey"
            columns: ["work_package_id"]
            isOneToOne: false
            referencedRelation: "project_work_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entries_work_package_id_fkey"
            columns: ["work_package_id"]
            isOneToOne: false
            referencedRelation: "v_project_wp_without_funding"
            referencedColumns: ["project_work_package_id"]
          },
        ]
      }
      project_weekly_reviews: {
        Row: {
          author_role_snapshot: string
          author_user_id: string
          completed_this_week: string
          created_at: string
          created_by_actual: string | null
          currently_working_on: string
          edited_at: string | null
          edited_by: string | null
          help_needed: string
          id: string
          iso_week: number
          iso_year: number
          next_steps: string
          other_comments: string
          overall_rating: number
          project_id: string
          rating_reason: string
          review_date: string
          risks: string
        }
        Insert: {
          author_role_snapshot?: string
          author_user_id: string
          completed_this_week?: string
          created_at?: string
          created_by_actual?: string | null
          currently_working_on?: string
          edited_at?: string | null
          edited_by?: string | null
          help_needed?: string
          id?: string
          iso_week: number
          iso_year: number
          next_steps?: string
          other_comments?: string
          overall_rating: number
          project_id: string
          rating_reason?: string
          review_date?: string
          risks?: string
        }
        Update: {
          author_role_snapshot?: string
          author_user_id?: string
          completed_this_week?: string
          created_at?: string
          created_by_actual?: string | null
          currently_working_on?: string
          edited_at?: string | null
          edited_by?: string | null
          help_needed?: string
          id?: string
          iso_week?: number
          iso_year?: number
          next_steps?: string
          other_comments?: string
          overall_rating?: number
          project_id?: string
          rating_reason?: string
          review_date?: string
          risks?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_weekly_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_work_package_assignees: {
        Row: {
          created_at: string
          id: string
          user_id: string
          work_package_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          work_package_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          work_package_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_work_package_assignees_work_package_id_fkey"
            columns: ["work_package_id"]
            isOneToOne: false
            referencedRelation: "project_work_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_work_package_assignees_work_package_id_fkey"
            columns: ["work_package_id"]
            isOneToOne: false
            referencedRelation: "v_project_wp_without_funding"
            referencedColumns: ["project_work_package_id"]
          },
        ]
      }
      project_work_package_dependencies: {
        Row: {
          created_at: string
          created_by: string | null
          dependency_type: Database["public"]["Enums"]["wp_dependency_type"]
          id: string
          lag_days: number
          predecessor_id: string
          project_id: string
          successor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dependency_type?: Database["public"]["Enums"]["wp_dependency_type"]
          id?: string
          lag_days?: number
          predecessor_id: string
          project_id: string
          successor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dependency_type?: Database["public"]["Enums"]["wp_dependency_type"]
          id?: string
          lag_days?: number
          predecessor_id?: string
          project_id?: string
          successor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_work_package_dependencies_predecessor_id_fkey"
            columns: ["predecessor_id"]
            isOneToOne: false
            referencedRelation: "project_work_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_work_package_dependencies_predecessor_id_fkey"
            columns: ["predecessor_id"]
            isOneToOne: false
            referencedRelation: "v_project_wp_without_funding"
            referencedColumns: ["project_work_package_id"]
          },
          {
            foreignKeyName: "project_work_package_dependencies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_work_package_dependencies_successor_id_fkey"
            columns: ["successor_id"]
            isOneToOne: false
            referencedRelation: "project_work_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_work_package_dependencies_successor_id_fkey"
            columns: ["successor_id"]
            isOneToOne: false
            referencedRelation: "v_project_wp_without_funding"
            referencedColumns: ["project_work_package_id"]
          },
        ]
      }
      project_work_packages: {
        Row: {
          category_id: string
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          is_mandatory: boolean
          milestone_id: string | null
          project_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["milestone_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_mandatory?: boolean
          milestone_id?: string | null
          project_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["milestone_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_mandatory?: boolean
          milestone_id?: string | null
          project_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["milestone_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_work_packages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "work_package_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_work_packages_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "project_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_work_packages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget_currency: string | null
          budget_total: number | null
          budget_warning_threshold: number | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          portfolio_id: string | null
          project_name: string | null
          project_number: string
          project_status: Database["public"]["Enums"]["project_status"]
          start_date: string | null
          traffic_light: Database["public"]["Enums"]["traffic_light_status"]
          updated_at: string
        }
        Insert: {
          budget_currency?: string | null
          budget_total?: number | null
          budget_warning_threshold?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          portfolio_id?: string | null
          project_name?: string | null
          project_number: string
          project_status?: Database["public"]["Enums"]["project_status"]
          start_date?: string | null
          traffic_light?: Database["public"]["Enums"]["traffic_light_status"]
          updated_at?: string
        }
        Update: {
          budget_currency?: string | null
          budget_total?: number | null
          budget_warning_threshold?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          portfolio_id?: string | null
          project_name?: string | null
          project_number?: string
          project_status?: Database["public"]["Enums"]["project_status"]
          start_date?: string | null
          traffic_light?: Database["public"]["Enums"]["traffic_light_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "project_portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_material_analyses: {
        Row: {
          analysis_type: string
          batch_id: string | null
          created_at: string
          id: string
          max_limit: number | null
          min_limit: number | null
          parameter_name: string
          raw_material_id: string
          remarks: string | null
          text_value: string | null
          unit: string | null
          value: number | null
        }
        Insert: {
          analysis_type?: string
          batch_id?: string | null
          created_at?: string
          id?: string
          max_limit?: number | null
          min_limit?: number | null
          parameter_name: string
          raw_material_id: string
          remarks?: string | null
          text_value?: string | null
          unit?: string | null
          value?: number | null
        }
        Update: {
          analysis_type?: string
          batch_id?: string | null
          created_at?: string
          id?: string
          max_limit?: number | null
          min_limit?: number | null
          parameter_name?: string
          raw_material_id?: string
          remarks?: string | null
          text_value?: string | null
          unit?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_material_analyses_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "raw_material_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_analyses_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_material_batches: {
        Row: {
          batch_number: string
          created_at: string
          delivery_date: string | null
          delivery_quantity: number | null
          goods_receipt_date: string | null
          id: string
          inspection_status: Database["public"]["Enums"]["raw_batch_inspection_status"]
          manufacturer_batch: string | null
          moisture_percent: number | null
          notes: string | null
          ph_value: number | null
          raw_material_id: string
          release_status: Database["public"]["Enums"]["raw_batch_release_status"]
          released_at: string | null
          released_by: string | null
          supplier: string | null
          updated_at: string
        }
        Insert: {
          batch_number: string
          created_at?: string
          delivery_date?: string | null
          delivery_quantity?: number | null
          goods_receipt_date?: string | null
          id?: string
          inspection_status?: Database["public"]["Enums"]["raw_batch_inspection_status"]
          manufacturer_batch?: string | null
          moisture_percent?: number | null
          notes?: string | null
          ph_value?: number | null
          raw_material_id: string
          release_status?: Database["public"]["Enums"]["raw_batch_release_status"]
          released_at?: string | null
          released_by?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          batch_number?: string
          created_at?: string
          delivery_date?: string | null
          delivery_quantity?: number | null
          goods_receipt_date?: string | null
          id?: string
          inspection_status?: Database["public"]["Enums"]["raw_batch_inspection_status"]
          manufacturer_batch?: string | null
          moisture_percent?: number | null
          notes?: string | null
          ph_value?: number | null
          raw_material_id?: string
          release_status?: Database["public"]["Enums"]["raw_batch_release_status"]
          released_at?: string | null
          released_by?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_material_batches_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_material_containers: {
        Row: {
          barcode: string | null
          batch_id: string | null
          container_code: string
          container_name: string | null
          created_at: string
          created_by: string
          current_quantity: number
          expiry_date: string | null
          id: string
          initial_quantity: number
          is_default_container: boolean
          kind: Database["public"]["Enums"]["container_kind"]
          location_id: string | null
          location_note: string | null
          notes: string | null
          raw_material_id: string
          reserved_quantity: number
          status: Database["public"]["Enums"]["container_status"]
          tare_unit: string | null
          tare_weight: number | null
          unit: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          batch_id?: string | null
          container_code: string
          container_name?: string | null
          created_at?: string
          created_by: string
          current_quantity?: number
          expiry_date?: string | null
          id?: string
          initial_quantity?: number
          is_default_container?: boolean
          kind?: Database["public"]["Enums"]["container_kind"]
          location_id?: string | null
          location_note?: string | null
          notes?: string | null
          raw_material_id: string
          reserved_quantity?: number
          status?: Database["public"]["Enums"]["container_status"]
          tare_unit?: string | null
          tare_weight?: number | null
          unit?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          batch_id?: string | null
          container_code?: string
          container_name?: string | null
          created_at?: string
          created_by?: string
          current_quantity?: number
          expiry_date?: string | null
          id?: string
          initial_quantity?: number
          is_default_container?: boolean
          kind?: Database["public"]["Enums"]["container_kind"]
          location_id?: string | null
          location_note?: string | null
          notes?: string | null
          raw_material_id?: string
          reserved_quantity?: number
          status?: Database["public"]["Enums"]["container_status"]
          tare_unit?: string | null
          tare_weight?: number | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_material_containers_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "raw_material_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_containers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_containers_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_material_documents: {
        Row: {
          batch_id: string | null
          document_type: string
          file_name: string
          file_type: string | null
          id: string
          raw_material_id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          batch_id?: string | null
          document_type?: string
          file_name: string
          file_type?: string | null
          id?: string
          raw_material_id: string
          storage_path: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          batch_id?: string | null
          document_type?: string
          file_name?: string
          file_type?: string | null
          id?: string
          raw_material_id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_material_documents_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "raw_material_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_documents_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_materials: {
        Row: {
          cas_number: string | null
          created_at: string
          created_by: string
          default_location_id: string | null
          description: string | null
          eg_number: string | null
          hazard_categories: Json
          id: string
          is_hazardous: boolean
          manufacturer: string | null
          material_name: string
          material_number: string | null
          mrs_number: string | null
          other_designation: string | null
          price_per_kg: number | null
          psa_categories: Json
          psa_symbols: string[]
          responsible_user_id: string | null
          sds_file_name: string | null
          sds_storage_path: string | null
          sds_uploaded_at: string | null
          supplier: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          cas_number?: string | null
          created_at?: string
          created_by: string
          default_location_id?: string | null
          description?: string | null
          eg_number?: string | null
          hazard_categories?: Json
          id?: string
          is_hazardous?: boolean
          manufacturer?: string | null
          material_name: string
          material_number?: string | null
          mrs_number?: string | null
          other_designation?: string | null
          price_per_kg?: number | null
          psa_categories?: Json
          psa_symbols?: string[]
          responsible_user_id?: string | null
          sds_file_name?: string | null
          sds_storage_path?: string | null
          sds_uploaded_at?: string | null
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          cas_number?: string | null
          created_at?: string
          created_by?: string
          default_location_id?: string | null
          description?: string | null
          eg_number?: string | null
          hazard_categories?: Json
          id?: string
          is_hazardous?: boolean
          manufacturer?: string | null
          material_name?: string
          material_number?: string | null
          mrs_number?: string | null
          other_designation?: string | null
          price_per_kg?: number | null
          psa_categories?: Json
          psa_symbols?: string[]
          responsible_user_id?: string | null
          sds_file_name?: string | null
          sds_storage_path?: string | null
          sds_uploaded_at?: string | null
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_materials_default_location_id_fkey"
            columns: ["default_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_materials_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      reference_number_sequences: {
        Row: {
          created_at: string
          id: string
          next_seq: number
          origin: string
          pattern: string
          reference_type: Database["public"]["Enums"]["reference_type"]
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          next_seq?: number
          origin: string
          pattern?: string
          reference_type: Database["public"]["Enums"]["reference_type"]
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          next_seq?: number
          origin?: string
          pattern?: string
          reference_type?: Database["public"]["Enums"]["reference_type"]
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_key: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_key: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_documents: {
        Row: {
          document_type: string
          file_name: string
          file_type: string | null
          id: string
          sample_id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          document_type?: string
          file_name: string
          file_type?: string | null
          id?: string
          sample_id: string
          storage_path: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          document_type?: string
          file_name?: string
          file_type?: string | null
          id?: string
          sample_id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "sample_documents_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_history: {
        Row: {
          action: string
          comment: string | null
          created_at: string
          id: string
          metadata: Json | null
          sample_id: string
          user_id: string
        }
        Insert: {
          action: string
          comment?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          sample_id: string
          user_id: string
        }
        Update: {
          action?: string
          comment?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          sample_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sample_history_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
        ]
      }
      samples: {
        Row: {
          bigbag_number: string | null
          category: string | null
          created_at: string
          created_by: string
          current_holder_id: string | null
          description: string
          disposal_category: string | null
          disposal_hints: string | null
          disposal_method: string | null
          hazard_categories: Json | null
          id: string
          is_hazardous: boolean
          is_used_catalyst: boolean
          location_id: string | null
          lot_number: string | null
          mixture_batch_id: string | null
          operating_hours: number | null
          order_id: string | null
          parent_sample_id: string | null
          pilot_plant_order_id: string | null
          post_measurement_action:
            | Database["public"]["Enums"]["post_measurement_action"]
            | null
          post_measurement_action_text: string | null
          prepared_for_measurement_id: string | null
          project_id: string
          raw_material_code: string | null
          raw_material_id: string | null
          sample_group: string | null
          sample_name: string
          sample_number: string
          sampled_at: string | null
          sampled_by: string | null
          status: Database["public"]["Enums"]["sample_status"]
          storage_expiry_date: string | null
          storage_hints: string | null
          storage_min_duration: string | null
          subsample_suffix: string | null
          tags: Json
          updated_at: string
          v2o5_content: number | null
        }
        Insert: {
          bigbag_number?: string | null
          category?: string | null
          created_at?: string
          created_by: string
          current_holder_id?: string | null
          description: string
          disposal_category?: string | null
          disposal_hints?: string | null
          disposal_method?: string | null
          hazard_categories?: Json | null
          id?: string
          is_hazardous?: boolean
          is_used_catalyst?: boolean
          location_id?: string | null
          lot_number?: string | null
          mixture_batch_id?: string | null
          operating_hours?: number | null
          order_id?: string | null
          parent_sample_id?: string | null
          pilot_plant_order_id?: string | null
          post_measurement_action?:
            | Database["public"]["Enums"]["post_measurement_action"]
            | null
          post_measurement_action_text?: string | null
          prepared_for_measurement_id?: string | null
          project_id: string
          raw_material_code?: string | null
          raw_material_id?: string | null
          sample_group?: string | null
          sample_name: string
          sample_number: string
          sampled_at?: string | null
          sampled_by?: string | null
          status?: Database["public"]["Enums"]["sample_status"]
          storage_expiry_date?: string | null
          storage_hints?: string | null
          storage_min_duration?: string | null
          subsample_suffix?: string | null
          tags?: Json
          updated_at?: string
          v2o5_content?: number | null
        }
        Update: {
          bigbag_number?: string | null
          category?: string | null
          created_at?: string
          created_by?: string
          current_holder_id?: string | null
          description?: string
          disposal_category?: string | null
          disposal_hints?: string | null
          disposal_method?: string | null
          hazard_categories?: Json | null
          id?: string
          is_hazardous?: boolean
          is_used_catalyst?: boolean
          location_id?: string | null
          lot_number?: string | null
          mixture_batch_id?: string | null
          operating_hours?: number | null
          order_id?: string | null
          parent_sample_id?: string | null
          pilot_plant_order_id?: string | null
          post_measurement_action?:
            | Database["public"]["Enums"]["post_measurement_action"]
            | null
          post_measurement_action_text?: string | null
          prepared_for_measurement_id?: string | null
          project_id?: string
          raw_material_code?: string | null
          raw_material_id?: string | null
          sample_group?: string | null
          sample_name?: string
          sample_number?: string
          sampled_at?: string | null
          sampled_by?: string | null
          status?: Database["public"]["Enums"]["sample_status"]
          storage_expiry_date?: string | null
          storage_hints?: string | null
          storage_min_duration?: string | null
          subsample_suffix?: string | null
          tags?: Json
          updated_at?: string
          v2o5_content?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "samples_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_mixture_batch_id_fkey"
            columns: ["mixture_batch_id"]
            isOneToOne: false
            referencedRelation: "mixture_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "measurement_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_parent_sample_id_fkey"
            columns: ["parent_sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_pilot_plant_order_id_fkey"
            columns: ["pilot_plant_order_id"]
            isOneToOne: false
            referencedRelation: "measurement_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_prepared_for_measurement_id_fkey"
            columns: ["prepared_for_measurement_id"]
            isOneToOne: false
            referencedRelation: "order_measurements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      service_blocks: {
        Row: {
          category: string
          content: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_system: boolean
          kind: string
          name: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          category?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          kind: string
          name: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          category?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          kind?: string
          name?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      service_data_fields: {
        Row: {
          archived: boolean
          category: string | null
          created_at: string
          created_by: string | null
          decimal_places: number | null
          default_value: string | null
          description: string | null
          display_name: string
          field_key: string
          field_type: Database["public"]["Enums"]["service_field_type"]
          id: string
          is_required: boolean
          is_result: boolean
          legacy_parameter_id: string | null
          max_value: number | null
          min_value: number | null
          parent_field_id: string | null
          readonly: boolean
          ref_target: string | null
          result_label: string | null
          select_options: Json
          service_id: string
          sort_order: number
          unit: string | null
          updated_at: string
          validation: Json
        }
        Insert: {
          archived?: boolean
          category?: string | null
          created_at?: string
          created_by?: string | null
          decimal_places?: number | null
          default_value?: string | null
          description?: string | null
          display_name: string
          field_key: string
          field_type?: Database["public"]["Enums"]["service_field_type"]
          id?: string
          is_required?: boolean
          is_result?: boolean
          legacy_parameter_id?: string | null
          max_value?: number | null
          min_value?: number | null
          parent_field_id?: string | null
          readonly?: boolean
          ref_target?: string | null
          result_label?: string | null
          select_options?: Json
          service_id: string
          sort_order?: number
          unit?: string | null
          updated_at?: string
          validation?: Json
        }
        Update: {
          archived?: boolean
          category?: string | null
          created_at?: string
          created_by?: string | null
          decimal_places?: number | null
          default_value?: string | null
          description?: string | null
          display_name?: string
          field_key?: string
          field_type?: Database["public"]["Enums"]["service_field_type"]
          id?: string
          is_required?: boolean
          is_result?: boolean
          legacy_parameter_id?: string | null
          max_value?: number | null
          min_value?: number | null
          parent_field_id?: string | null
          readonly?: boolean
          ref_target?: string | null
          result_label?: string | null
          select_options?: Json
          service_id?: string
          sort_order?: number
          unit?: string | null
          updated_at?: string
          validation?: Json
        }
        Relationships: [
          {
            foreignKeyName: "service_data_fields_parent_field_id_fkey"
            columns: ["parent_field_id"]
            isOneToOne: false
            referencedRelation: "service_data_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_data_fields_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_dependencies: {
        Row: {
          created_at: string
          id: string
          note: string | null
          order_index: number
          requires_service_id: string
          service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          order_index?: number
          requires_service_id: string
          service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          order_index?: number
          requires_service_id?: string
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_dependencies_requires_service_id_fkey"
            columns: ["requires_service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_dependencies_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_document_templates: {
        Row: {
          content: string
          created_at: string
          description: string | null
          enabled: boolean
          footer_html: string | null
          format: string
          header_html: string | null
          id: string
          kind: string
          name: string
          orientation: string
          paper: string
          service_id: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          footer_html?: string | null
          format?: string
          header_html?: string | null
          id?: string
          kind?: string
          name: string
          orientation?: string
          paper?: string
          service_id: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          footer_html?: string | null
          format?: string
          header_html?: string | null
          id?: string
          kind?: string
          name?: string
          orientation?: string
          paper?: string
          service_id?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_document_templates_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_field_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          file_name: string
          file_size_bytes: number | null
          file_type: string | null
          id: string
          is_active: boolean
          name: string
          service_data_field_id: string
          sort_order: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name: string
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          is_active?: boolean
          name: string
          service_data_field_id: string
          sort_order?: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          is_active?: boolean
          name?: string
          service_data_field_id?: string
          sort_order?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_field_templates_service_data_field_id_fkey"
            columns: ["service_data_field_id"]
            isOneToOne: false
            referencedRelation: "service_data_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      service_form_layouts: {
        Row: {
          created_at: string
          id: string
          layout: Json
          role_view: string
          service_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          layout?: Json
          role_view: string
          service_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          layout?: Json
          role_view?: string
          service_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_form_layouts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_form_links: {
        Row: {
          created_at: string
          form_definition_id: string
          id: string
          order_index: number
          role_view: string | null
          service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          form_definition_id: string
          id?: string
          order_index?: number
          role_view?: string | null
          service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          form_definition_id?: string
          id?: string
          order_index?: number
          role_view?: string | null
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_form_links_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_form_links_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_forms: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          form_type: string
          id: string
          is_global: boolean
          layout: Json
          name: string
          schema: Json
          service_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          form_type?: string
          id?: string
          is_global?: boolean
          layout?: Json
          name: string
          schema?: Json
          service_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          form_type?: string
          id?: string
          is_global?: boolean
          layout?: Json
          name?: string
          schema?: Json
          service_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_forms_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_package_items: {
        Row: {
          created_at: string
          id: string
          package_id: string
          service_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          package_id: string
          service_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          package_id?: string
          service_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_package_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_package_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_package_workflow_map: {
        Row: {
          append_steps: Json
          created_at: string
          id: string
          package_id: string
          prepend_steps: Json
          requires_kneading: boolean
          template_id: string
          updated_at: string
        }
        Insert: {
          append_steps?: Json
          created_at?: string
          id?: string
          package_id: string
          prepend_steps?: Json
          requires_kneading?: boolean
          template_id: string
          updated_at?: string
        }
        Update: {
          append_steps?: Json
          created_at?: string
          id?: string
          package_id?: string
          prepend_steps?: Json
          requires_kneading?: boolean
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_package_workflow_map_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: true
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_package_workflow_map_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      service_packages: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      service_parameter_definitions: {
        Row: {
          conditional_on: string | null
          conditional_value: string | null
          default_value: string | null
          description: string | null
          id: string
          is_required: boolean
          max_value: number | null
          min_value: number | null
          parameter_category: string
          parameter_name: string
          parameter_type: string
          select_options: Json | null
          service_id: string
          sort_order: number
          unit: string | null
        }
        Insert: {
          conditional_on?: string | null
          conditional_value?: string | null
          default_value?: string | null
          description?: string | null
          id?: string
          is_required?: boolean
          max_value?: number | null
          min_value?: number | null
          parameter_category?: string
          parameter_name: string
          parameter_type?: string
          select_options?: Json | null
          service_id: string
          sort_order?: number
          unit?: string | null
        }
        Update: {
          conditional_on?: string | null
          conditional_value?: string | null
          default_value?: string | null
          description?: string | null
          id?: string
          is_required?: boolean
          max_value?: number | null
          min_value?: number | null
          parameter_category?: string
          parameter_name?: string
          parameter_type?: string
          select_options?: Json | null
          service_id?: string
          sort_order?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_parameter_definitions_conditional_on_fkey"
            columns: ["conditional_on"]
            isOneToOne: false
            referencedRelation: "service_parameter_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_parameter_definitions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_rules: {
        Row: {
          created_at: string
          definition: Json
          id: string
          service_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          definition?: Json
          id?: string
          service_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          definition?: Json
          id?: string
          service_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_rules_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_versions: {
        Row: {
          change_summary: string | null
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["service_version_entity"]
          id: string
          label: string | null
          published_at: string | null
          published_by: string | null
          service_id: string | null
          snapshot: Json
          status: Database["public"]["Enums"]["service_version_status"]
          version_no: number
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["service_version_entity"]
          id?: string
          label?: string | null
          published_at?: string | null
          published_by?: string | null
          service_id?: string | null
          snapshot: Json
          status?: Database["public"]["Enums"]["service_version_status"]
          version_no: number
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["service_version_entity"]
          id?: string
          label?: string | null
          published_at?: string | null
          published_by?: string | null
          service_id?: string | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["service_version_status"]
          version_no?: number
        }
        Relationships: []
      }
      service_workflow_definitions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          graph: Json
          id: string
          is_active: boolean
          name: string
          service_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          graph?: Json
          id?: string
          is_active?: boolean
          name?: string
          service_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          graph?: Json
          id?: string
          is_active?: boolean
          name?: string
          service_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_workflow_definitions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_workflow_step_services: {
        Row: {
          created_at: string
          id: string
          service_id: string
          step_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          service_id: string
          step_id: string
        }
        Update: {
          created_at?: string
          id?: string
          service_id?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_workflow_step_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_workflow_step_services_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "service_workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      service_workflow_steps: {
        Row: {
          assignee_user_id: string | null
          auto_actions: Json
          condition_expr: Json
          created_at: string
          description: string | null
          due_hours: number | null
          escalation_role: string | null
          form_id: string | null
          id: string
          is_mandatory: boolean
          locked_field_ids: Json
          name: string
          notify_config: Json
          order_index: number
          role_required: string | null
          role_view_key: string | null
          step_key: string
          step_type: string
          updated_at: string
          workflow_id: string
        }
        Insert: {
          assignee_user_id?: string | null
          auto_actions?: Json
          condition_expr?: Json
          created_at?: string
          description?: string | null
          due_hours?: number | null
          escalation_role?: string | null
          form_id?: string | null
          id?: string
          is_mandatory?: boolean
          locked_field_ids?: Json
          name: string
          notify_config?: Json
          order_index?: number
          role_required?: string | null
          role_view_key?: string | null
          step_key: string
          step_type?: string
          updated_at?: string
          workflow_id: string
        }
        Update: {
          assignee_user_id?: string | null
          auto_actions?: Json
          condition_expr?: Json
          created_at?: string
          description?: string | null
          due_hours?: number | null
          escalation_role?: string | null
          form_id?: string | null
          id?: string
          is_mandatory?: boolean
          locked_field_ids?: Json
          name?: string
          notify_config?: Json
          order_index?: number
          role_required?: string | null
          role_view_key?: string | null
          step_key?: string
          step_type?: string
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_workflow_steps_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "service_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "service_workflow_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      service_workflows: {
        Row: {
          created_at: string
          definition: Json
          id: string
          service_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          definition?: Json
          id?: string
          service_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          definition?: Json
          id?: string
          service_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_workflows_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "measurement_services"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_locations: {
        Row: {
          created_at: string
          description: string | null
          hall: string | null
          id: string
          name: string
          position: string | null
          room: string | null
          shelf: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hall?: string | null
          id?: string
          name: string
          position?: string | null
          room?: string | null
          shelf?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hall?: string | null
          id?: string
          name?: string
          position?: string | null
          room?: string | null
          shelf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          updated_by: string
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      user_absences: {
        Row: {
          absence_type: Database["public"]["Enums"]["absence_type"]
          comment: string | null
          created_at: string
          end_at: string
          external_id: string | null
          id: string
          last_synced_at: string | null
          outlook_event_id: string | null
          start_at: string
          sync_source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          absence_type: Database["public"]["Enums"]["absence_type"]
          comment?: string | null
          created_at?: string
          end_at: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          outlook_event_id?: string | null
          start_at: string
          sync_source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          absence_type?: Database["public"]["Enums"]["absence_type"]
          comment?: string | null
          created_at?: string
          end_at?: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          outlook_event_id?: string | null
          start_at?: string
          sync_source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          custom_role_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          custom_role_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          custom_role_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_work_schedules: {
        Row: {
          created_at: string
          created_by: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
          valid_from: string
          weekly_hours: number
          works_friday: boolean
          works_monday: boolean
          works_saturday: boolean
          works_sunday: boolean
          works_thursday: boolean
          works_tuesday: boolean
          works_wednesday: boolean
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
          valid_from?: string
          weekly_hours?: number
          works_friday?: boolean
          works_monday?: boolean
          works_saturday?: boolean
          works_sunday?: boolean
          works_thursday?: boolean
          works_tuesday?: boolean
          works_wednesday?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          valid_from?: string
          weekly_hours?: number
          works_friday?: boolean
          works_monday?: boolean
          works_saturday?: boolean
          works_sunday?: boolean
          works_thursday?: boolean
          works_tuesday?: boolean
          works_wednesday?: boolean
        }
        Relationships: []
      }
      work_logs: {
        Row: {
          comment: string | null
          created_at: string
          hours: number
          id: string
          order_measurement_id: string
          user_id: string
          work_date: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          hours: number
          id?: string
          order_measurement_id: string
          user_id: string
          work_date?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          hours?: number
          id?: string
          order_measurement_id?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_logs_order_measurement_id_fkey"
            columns: ["order_measurement_id"]
            isOneToOne: false
            referencedRelation: "order_measurements"
            referencedColumns: ["id"]
          },
        ]
      }
      work_object_origins: {
        Row: {
          created_at: string
          default_reference_type: Database["public"]["Enums"]["reference_type"]
          default_workflow_template_id: string | null
          id: string
          is_active: boolean
          key: string
          label_de: string
          label_en: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_reference_type?: Database["public"]["Enums"]["reference_type"]
          default_workflow_template_id?: string | null
          id?: string
          is_active?: boolean
          key: string
          label_de: string
          label_en: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_reference_type?: Database["public"]["Enums"]["reference_type"]
          default_workflow_template_id?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label_de?: string
          label_en?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      work_package_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      workflow_process_links: {
        Row: {
          created_at: string
          id: string
          order_index: number
          process_template_id: string
          updated_at: string
          workflow_template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number
          process_template_id: string
          updated_at?: string
          workflow_template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          process_template_id?: string
          updated_at?: string
          workflow_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_process_links_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_process_links_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_template_steps: {
        Row: {
          condition_expr: Json
          created_at: string
          description: string | null
          due_hours: number | null
          form_id: string | null
          id: string
          is_mandatory: boolean
          name: string
          order_index: number
          role_required: string | null
          step_key: string
          step_type: string
          template_id: string
          updated_at: string
        }
        Insert: {
          condition_expr?: Json
          created_at?: string
          description?: string | null
          due_hours?: number | null
          form_id?: string | null
          id?: string
          is_mandatory?: boolean
          name: string
          order_index: number
          role_required?: string | null
          step_key: string
          step_type?: string
          template_id: string
          updated_at?: string
        }
        Update: {
          condition_expr?: Json
          created_at?: string
          description?: string | null
          due_hours?: number | null
          form_id?: string | null
          id?: string
          is_mandatory?: boolean
          name?: string
          order_index?: number
          role_required?: string | null
          step_key?: string
          step_type?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_template_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          origin: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          origin?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          origin?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      workstation_downtimes: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          downtime_type: Database["public"]["Enums"]["downtime_type"]
          end_at: string
          id: string
          start_at: string
          status: Database["public"]["Enums"]["downtime_status"]
          updated_at: string
          workstation_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          downtime_type: Database["public"]["Enums"]["downtime_type"]
          end_at: string
          id?: string
          start_at: string
          status?: Database["public"]["Enums"]["downtime_status"]
          updated_at?: string
          workstation_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          downtime_type?: Database["public"]["Enums"]["downtime_type"]
          end_at?: string
          id?: string
          start_at?: string
          status?: Database["public"]["Enums"]["downtime_status"]
          updated_at?: string
          workstation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workstation_downtimes_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      workstation_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          due_date: string | null
          hourly_rate: number
          id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          workstation_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          hourly_rate?: number
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          workstation_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          hourly_rate?: number
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          workstation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workstation_tasks_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      workstations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          responsible_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          responsible_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          responsible_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      unified_batches: {
        Row: {
          batch_kind: string | null
          batch_number: string | null
          created_at: string | null
          expiry_date: string | null
          id: string | null
          notes: string | null
          produced_at: string | null
          produced_by: string | null
          product_name: string | null
          quantity: number | null
          recipe_id: string | null
          recipe_name: string | null
          source_id: string | null
          status: string | null
          unit: string | null
        }
        Relationships: []
      }
      v_project_wp_without_funding: {
        Row: {
          end_date: string | null
          project_id: string | null
          project_work_package_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["milestone_status"] | null
          title: string | null
        }
        Insert: {
          end_date?: string | null
          project_id?: string | null
          project_work_package_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["milestone_status"] | null
          title?: string | null
        }
        Update: {
          end_date?: string | null
          project_id?: string | null
          project_work_package_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["milestone_status"] | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_work_packages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _clone_form_definition: {
        Args: { _new_scope?: string; _source_form_id: string }
        Returns: string
      }
      _order_lock_bypass: { Args: never; Returns: boolean }
      activate_mixture_recipe_version: {
        Args: { _version_id: string }
        Returns: undefined
      }
      add_batch_to_container: {
        Args: {
          _batch_id: string
          _comment?: string
          _container_id: string
          _movement_date?: string
          _quantity: number
        }
        Returns: string
      }
      add_project_document: {
        Args: {
          _bump_major?: boolean
          _change_comment?: string
          _doc_kind: Database["public"]["Enums"]["project_document_kind"]
          _file_name: string
          _file_size: number
          _file_type: string
          _project_id: string
          _storage_path: string
        }
        Returns: string
      }
      assign_analysis_request_to_sample: {
        Args: { _request_id: string; _sample_id: string }
        Returns: string
      }
      book_container_consumption: {
        Args: {
          _allocations?: Json
          _comment?: string
          _container_id: string
          _movement_date?: string
          _order_measurement_id?: string
          _project_id?: string
          _project_reference?: string
          _quantity: number
        }
        Returns: string
      }
      book_replacement_sample: {
        Args: {
          p_note?: string
          p_order_id: string
          p_original_sample_id: string
          p_reason: string
          p_replacement_sample_id: string
        }
        Returns: string
      }
      bootstrap_order_workflow: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      can_correct_results: { Args: { _user_id: string }; Returns: boolean }
      can_edit_project_governance: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_designer: { Args: { _uid: string }; Returns: boolean }
      can_view_others_vacation: { Args: { _user_id: string }; Returns: boolean }
      can_view_portfolio: {
        Args: { _portfolio_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_project_governance: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      check_user_absence_conflict: {
        Args: { _end: string; _start: string; _user_id: string }
        Returns: {
          absence_type: Database["public"]["Enums"]["absence_type"]
          end_at: string
          id: string
          start_at: string
        }[]
      }
      check_workstation_downtime_conflict: {
        Args: { _end: string; _start: string; _workstation_id: string }
        Returns: {
          downtime_type: Database["public"]["Enums"]["downtime_type"]
          end_at: string
          id: string
          start_at: string
          status: Database["public"]["Enums"]["downtime_status"]
        }[]
      }
      claim_measurement: { Args: { _measurement_id: string }; Returns: string }
      clone_template_as_new_version: {
        Args: { _template_id: string }
        Returns: string
      }
      complete_mixture_batch: {
        Args: { _batch_id: string; _produced_quantity?: number }
        Returns: undefined
      }
      copy_mixture: {
        Args: {
          _as_template?: boolean
          _new_name: string
          _new_number?: string
          _source_id: string
        }
        Returns: string
      }
      correct_measurement_result: {
        Args: { p_new_value: number; p_reason: string; p_result_id: string }
        Returns: string
      }
      correct_mixture_batch_quantity: {
        Args: {
          _batch_id: string
          _new_produced_quantity: number
          _reason: string
        }
        Returns: undefined
      }
      correct_mixture_weighing: {
        Args: {
          _new_actual_quantity: number
          _new_container_id: string
          _new_notes: string
          _reason: string
          _weighing_id: string
        }
        Returns: undefined
      }
      count_service_references: { Args: { _service_id: string }; Returns: Json }
      create_mixture_recipe_version:
        | {
            Args: { _copy_from?: string; _mixture_id: string; _notes?: string }
            Returns: string
          }
        | {
            Args: {
              _change_reason?: string
              _change_summary?: string
              _copy_from?: string
              _mixture_id: string
              _notes?: string
              _version_label?: string
            }
            Returns: string
          }
      create_order_workflow_instance: {
        Args: { _order_id: string; _process_template_ids: string[] }
        Returns: string[]
      }
      create_subsample: {
        Args: {
          _description?: string
          _measurement_id?: string
          _name?: string
          _parent_sample_id: string
        }
        Returns: string
      }
      delete_service_safe: { Args: { _service_id: string }; Returns: undefined }
      diff_recipe_versions: {
        Args: { _version_a: string; _version_b: string }
        Returns: Json
      }
      expand_order_workflows: { Args: { _order_id: string }; Returns: number }
      expand_service_workflow: {
        Args: { _measurement_id: string }
        Returns: number
      }
      finalize_mixture_batch: {
        Args: { _batch_id: string; _produced_quantity: number }
        Returns: undefined
      }
      finalize_project_closure: {
        Args: { _closure_id: string }
        Returns: undefined
      }
      get_container_positions: {
        Args: { _container_id: string; _include_depleted?: boolean }
        Returns: {
          added_at: string
          batch_id: string
          batch_number: string
          created_at: string
          delivery_date: string
          initial_quantity: number
          manufacturer_batch: string
          position_id: string
          position_no: number
          quantity: number
          status: string
        }[]
      }
      get_order_preparation_overview: {
        Args: { _order_id: string }
        Returns: {
          is_ready: boolean
          measurement_id: string
          measurement_number: string
          origin: string
          parent_sample_id: string
          parent_sample_number: string
          preparation_note: string
          requires_subsample: boolean
          sample_id: string
          sample_name: string
          sample_number: string
          service_id: string
          service_name: string
          status: string
          subsample_suffix: string
        }[]
      }
      get_portfolio_controlling_report: {
        Args: { _filters?: Json }
        Returns: Json
      }
      get_portfolio_cost_journal: {
        Args: { _end?: string; _portfolio_id: string; _start?: string }
        Returns: {
          amount: number
          category: string
          description: string
          item_date: string
          project_id: string
          project_name: string
          project_number: string
        }[]
      }
      get_portfolio_costs_by_category: {
        Args: { _end?: string; _portfolio_id: string; _start?: string }
        Returns: {
          amount: number
          category_id: string
          category_name: string
        }[]
      }
      get_portfolio_costs_by_month: {
        Args: { _end?: string; _portfolio_id: string; _start?: string }
        Returns: {
          cost_total: number
          expenses_cost: number
          material_cost: number
          month: string
          personnel_cost: number
        }[]
      }
      get_portfolio_costs_by_project: {
        Args: { _end?: string; _portfolio_id: string; _start?: string }
        Returns: {
          budget_total: number
          consumables_cost: number
          cost_total: number
          expenses_cost: number
          knetung_cost: number
          personnel_cost: number
          project_id: string
          project_name: string
          project_number: string
        }[]
      }
      get_portfolio_costs_by_work_package: {
        Args: { _end?: string; _portfolio_id: string; _start?: string }
        Returns: {
          amount: number
          category_id: string
          category_name: string
          name: string
          portfolio_work_package_id: string
        }[]
      }
      get_portfolio_dashboard: {
        Args: { _portfolio_id: string }
        Returns: Json
      }
      get_portfolio_ffg_summary: {
        Args: { _portfolio_id: string }
        Returns: {
          category_id: string
          category_name: string
          hours: number
          work_package_code: string
          work_package_id: string
          work_package_name: string
        }[]
      }
      get_portfolio_hours_by_category: {
        Args: { _end?: string; _portfolio_id: string; _start?: string }
        Returns: {
          category_id: string
          category_name: string
          minutes: number
        }[]
      }
      get_portfolio_hours_by_month: {
        Args: { _end?: string; _portfolio_id: string; _start?: string }
        Returns: {
          hours: number
          month: string
        }[]
      }
      get_portfolio_hours_by_person: {
        Args: { _end?: string; _portfolio_id: string; _start?: string }
        Returns: {
          entries_count: number
          first_name: string
          hours: number
          last_name: string
          person_id: string
          project_count: number
          short_code: string
        }[]
      }
      get_portfolio_hours_by_project: {
        Args: { _end?: string; _portfolio_id: string; _start?: string }
        Returns: {
          entries_count: number
          hours: number
          project_id: string
          project_name: string
          project_number: string
        }[]
      }
      get_portfolio_hours_by_task: {
        Args: { _end?: string; _portfolio_id: string; _start?: string }
        Returns: {
          minutes: number
          task_id: string
          task_name: string
          work_package_id: string
          work_package_name: string
        }[]
      }
      get_portfolio_hours_by_work_package: {
        Args: { _end?: string; _portfolio_id: string; _start?: string }
        Returns: {
          category_id: string
          category_name: string
          code: string
          minutes: number
          name: string
          portfolio_work_package_id: string
        }[]
      }
      get_portfolio_milestone_timeline: {
        Args: { _portfolio_id: string }
        Returns: {
          completed_at: string
          description: string
          id: string
          milestone_date: string
          milestone_type: string
          portfolio_id: string
          project_id: string
          project_name: string
          project_number: string
          sort_date: string
          source: string
          status: string
          title: string
        }[]
      }
      get_portfolio_person_journal: {
        Args: { _end?: string; _portfolio_id: string; _start?: string }
        Returns: {
          duration_minutes: number
          entry_date: string
          entry_id: string
          entry_type: string
          first_name: string
          hours: number
          last_name: string
          note: string
          person_id: string
          project_id: string
          project_name: string
          project_number: string
          short_code: string
        }[]
      }
      get_portfolio_summary: {
        Args: { _end?: string; _portfolio_id: string; _start?: string }
        Returns: Json
      }
      get_raw_material_derived_samples: {
        Args: { _raw_material_batch_id?: string; _raw_material_id: string }
        Returns: {
          consumed_quantity: number
          consumed_unit: string
          mixture_batch_id: string
          mixture_batch_number: string
          mixture_id: string
          mixture_name: string
          raw_material_batch_id: string
          raw_material_batch_number: string
          sample_created_at: string
          sample_id: string
          sample_name: string
          sample_number: string
        }[]
      }
      get_sample_traceability: { Args: { _sample_id: string }; Returns: Json }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_work_schedule: {
        Args: { _on_date?: string; _user_id: string }
        Returns: {
          created_at: string
          created_by: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
          valid_from: string
          weekly_hours: number
          works_friday: boolean
          works_monday: boolean
          works_saturday: boolean
          works_sunday: boolean
          works_thursday: boolean
          works_tuesday: boolean
          works_wednesday: boolean
        }
        SetofOptions: {
          from: "*"
          to: "user_work_schedules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      global_field_usage: { Args: { _field_id: string }; Returns: Json }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_project_role: {
        Args: {
          _project_id: string
          _role: Database["public"]["Enums"]["project_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_snippet_into_template: {
        Args: { _snippet_id: string; _target_template_id: string }
        Returns: number
      }
      is_assigned_to_measurement: {
        Args: { _measurement_id: string; _user_id: string }
        Returns: boolean
      }
      is_assigned_to_order: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      is_order_creator: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      is_order_creator_via_measurement: {
        Args: { _measurement_id: string; _user_id: string }
        Returns: boolean
      }
      is_order_locked: { Args: { _order_id: string }; Returns: boolean }
      is_pmo: { Args: { _user_id: string }; Returns: boolean }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      measurement_has_official_result: {
        Args: { _measurement_id: string }
        Returns: boolean
      }
      measurement_is_ready: {
        Args: { _measurement_id: string }
        Returns: boolean
      }
      mixture_recipe_availability: {
        Args: { _scale?: number; _version_id: string }
        Returns: {
          available: number
          material_name: string
          material_number: string
          missing: number
          raw_material_id: string
          required: number
          unit: string
        }[]
      }
      next_reference_number: {
        Args: {
          p_origin: string
          p_reference_type: Database["public"]["Enums"]["reference_type"]
        }
        Returns: string
      }
      order_has_official_result: {
        Args: { _order_id: string }
        Returns: boolean
      }
      pp_complete_block: {
        Args: { _block_id: string; _data?: Json; _notes?: string }
        Returns: undefined
      }
      pp_round_minutes_to_15: {
        Args: { _from: string; _to: string }
        Returns: number
      }
      pp_seed_blocks: { Args: { _order_id: string }; Returns: undefined }
      pp_start_block: { Args: { _block_id: string }; Returns: undefined }
      priority_enum_to_int: {
        Args: { p: Database["public"]["Enums"]["order_priority"] }
        Returns: number
      }
      process_step_raw_material_availability: {
        Args: { _scale?: number; _step_id: string }
        Returns: {
          available: number
          material_name: string
          material_number: string
          missing: number
          psrm_id: string
          raw_material_id: string
          required: number
          unit: string
        }[]
      }
      produce_mixture_batch: {
        Args: {
          _concentration: string
          _consumptions: Json
          _mixture_id: string
          _notes: string
          _produced_quantity: number
          _unit: string
        }
        Returns: string
      }
      project_has_official_result: {
        Args: { _project_id: string }
        Returns: boolean
      }
      reassign_measurement_sample: {
        Args: {
          p_measurement_id: string
          p_new_sample_id: string
          p_reason: string
        }
        Returns: string
      }
      recompute_order_workflow_status: {
        Args: { _order_id: string }
        Returns: undefined
      }
      record_container_movement: {
        Args: {
          _comment?: string
          _container_id: string
          _movement_type: Database["public"]["Enums"]["container_movement_type"]
          _new_quantity?: number
          _quantity?: number
          _reference?: string
          _to_location_id?: string
          _to_location_note?: string
        }
        Returns: string
      }
      record_mixture_weighing: {
        Args: {
          _actual_quantity: number
          _batch_id: string
          _notes?: string
          _raw_material_batch_id: string
          _raw_material_id: string
          _step_id: string
          _target_quantity: number
          _unit: string
        }
        Returns: string
      }
      release_mixture_batch: { Args: { _batch_id: string }; Returns: undefined }
      resolve_workflow_template: {
        Args: { p_order_id: string }
        Returns: {
          requires_kneading: boolean
          template_id: string
        }[]
      }
      snapshot_template: { Args: { _template_id: string }; Returns: Json }
      start_mixture_batch:
        | { Args: { _batch_id: string }; Returns: undefined }
        | {
            Args: {
              _mixture_id: string
              _planned_quantity: number
              _recipe_version_id: string
              _scale_factor?: number
              _unit?: string
            }
            Returns: string
          }
      weigh_mixture_batch: {
        Args: {
          _concentration?: string
          _mixture_id: string
          _notes?: string
          _planned_quantity?: number
          _unit?: string
          _weighings?: Json
        }
        Returns: string
      }
      wf_complete_step: {
        Args: { _notes?: string; _response?: Json; _run_id: string }
        Returns: {
          assigned_role: string | null
          assigned_to: string | null
          auto_time_minutes: number | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          form_response: Json
          id: string
          notes: string | null
          opened_at: string | null
          opened_by: string | null
          order_id: string
          order_index: number
          status: Database["public"]["Enums"]["step_run_status"]
          step_id: string | null
          step_key: string
          step_snapshot: Json
          time_entry_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "order_step_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      wf_finalize_order: {
        Args: { _order_id: string }
        Returns: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          legacy_order_id: string | null
          locked_at: string | null
          order_number: string | null
          project_id: string | null
          sample_ids: string[]
          shared_data: Json
          status: Database["public"]["Enums"]["order_instance_status"]
          template_id: string | null
          template_snapshot: Json
          title: string | null
          updated_at: string
          workflow_status: Database["public"]["Enums"]["order_workflow_status_new"]
        }
        SetofOptions: {
          from: "*"
          to: "order_instances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      wf_reopen_step: {
        Args: { _run_id: string }
        Returns: {
          assigned_role: string | null
          assigned_to: string | null
          auto_time_minutes: number | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          form_response: Json
          id: string
          notes: string | null
          opened_at: string | null
          opened_by: string | null
          order_id: string
          order_index: number
          status: Database["public"]["Enums"]["step_run_status"]
          step_id: string | null
          step_key: string
          step_snapshot: Json
          time_entry_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "order_step_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      wf_round_minutes: { Args: { _minutes: number }; Returns: number }
      wf_seed_from_template: {
        Args: { _order_id: string; _template_id?: string }
        Returns: {
          assigned_role: string | null
          assigned_to: string | null
          auto_time_minutes: number | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          form_response: Json
          id: string
          notes: string | null
          opened_at: string | null
          opened_by: string | null
          order_id: string
          order_index: number
          status: Database["public"]["Enums"]["step_run_status"]
          step_id: string | null
          step_key: string
          step_snapshot: Json
          time_entry_id: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "order_step_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      wf_seed_positions_for_task: {
        Args: { _task_id: string }
        Returns: number
      }
      wf_start_step: {
        Args: { _run_id: string }
        Returns: {
          assigned_role: string | null
          assigned_to: string | null
          auto_time_minutes: number | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          form_response: Json
          id: string
          notes: string | null
          opened_at: string | null
          opened_by: string | null
          order_id: string
          order_index: number
          status: Database["public"]["Enums"]["step_run_status"]
          step_id: string | null
          step_key: string
          step_snapshot: Json
          time_entry_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "order_step_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      wf_start_task: { Args: { _task_id: string }; Returns: undefined }
    }
    Enums: {
      absence_type: "urlaub" | "krankheit" | "weiterbildung" | "sonstiges"
      app_role: "master" | "auftraggeber" | "durchfuehrer"
      change_request_status: "pending" | "approved" | "rejected" | "withdrawn"
      container_kind:
        | "fass"
        | "kanister"
        | "sack"
        | "big_bag"
        | "ibc"
        | "tank"
        | "flasche"
        | "sonstige"
        | "kiste"
      container_movement_type:
        | "eingang"
        | "umlagerung"
        | "verbrauch"
        | "korrektur_plus"
        | "korrektur_minus"
        | "inventur"
        | "entsorgung"
        | "reservierung"
        | "freigabe_reservierung"
      container_status:
        | "verfuegbar"
        | "reserviert"
        | "in_verwendung"
        | "leer"
        | "gesperrt"
        | "entsorgt"
      decision_status: "active" | "superseded" | "rejected"
      downtime_status: "geplant" | "aktiv" | "abgeschlossen"
      downtime_type: "wartung" | "reparatur" | "sonstiges"
      form_scope: "template" | "global"
      masse_type: "DK" | "GK" | "KK" | "MK" | "PK"
      measurement_status: "open" | "in_progress" | "completed"
      milestone_status: "planned" | "in_progress" | "completed"
      mixture_batch_status: "produced" | "discarded"
      mixture_category: "mischung" | "loesung"
      mixture_deviation_kind: "time" | "quantity" | "additional_raw" | "process"
      mixture_exec_status:
        | "geplant"
        | "laufend"
        | "abgeschlossen"
        | "abgebrochen"
        | "freigegeben"
      mixture_movement_type: "eingang" | "ausgang"
      mixture_template_kind:
        | "standard"
        | "customer"
        | "development"
        | "pilot"
        | "production"
      order_instance_status:
        | "draft"
        | "planned"
        | "in_progress"
        | "completed"
        | "cancelled"
      order_kind: "pilot_plant" | "labor" | "combined" | "legacy"
      order_priority: "normal" | "wichtig" | "hoechste"
      order_status: "open" | "in_progress" | "completed"
      order_type: "customer" | "production" | "rnd"
      order_workflow_status_new:
        | "entwurf"
        | "geplant"
        | "in_progress"
        | "waiting"
        | "review"
        | "abgeschlossen"
        | "abgebrochen"
      pilot_plant_block_key:
        | "stammdaten"
        | "rezeptur"
        | "knetung"
        | "extrusion"
        | "trocknung"
        | "brennen"
        | "probenentnahme"
        | "uebergabe"
        | "abschluss"
      pilot_plant_block_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "skipped"
      portfolio_document_category:
        | "foerderantrag"
        | "foerdervertrag"
        | "zwischenbericht"
        | "endbericht"
        | "praesentation"
        | "publikation"
        | "patent"
        | "nachweis"
        | "sonstiges"
      portfolio_milestone_status: "offen" | "erledigt" | "ueberfaellig"
      portfolio_milestone_type:
        | "antrag"
        | "genehmigung"
        | "zwischenbericht"
        | "review"
        | "abschluss"
        | "sonstiges"
      portfolio_status:
        | "planung"
        | "aktiv"
        | "pausiert"
        | "abgeschlossen"
        | "abgebrochen"
      post_measurement_action:
        | "aufbewahren"
        | "entsorgen"
        | "zurueck"
        | "andere"
      process_template_kind: "labor" | "pilot_plant"
      process_template_scope: "template" | "snippet" | "global"
      project_closure_status: "draft" | "in_approval" | "approved"
      project_document_kind: "application" | "report"
      project_role: "owner" | "leader" | "member"
      project_status: "active" | "completed"
      raw_batch_inspection_status:
        | "ausstehend"
        | "laufend"
        | "bestanden"
        | "nicht_bestanden"
      raw_batch_release_status:
        | "gesperrt"
        | "in_pruefung"
        | "freigegeben"
        | "abgelehnt"
      reference_type:
        | "experiment"
        | "serial"
        | "batch"
        | "complaint"
        | "customer_ref"
        | "internal"
      sample_status:
        | "neu"
        | "eingelagert"
        | "in_bearbeitung"
        | "teilweise_verbraucht"
        | "vollstaendig_verbraucht"
        | "entsorgt"
        | "zurueckgesendet"
      service_category: "labor" | "pilot_plant"
      service_field_type:
        | "text"
        | "longtext"
        | "number"
        | "decimal"
        | "percent"
        | "date"
        | "time"
        | "datetime"
        | "boolean"
        | "select"
        | "multiselect"
        | "file"
        | "image"
        | "barcode"
        | "qrcode"
        | "ref_customer"
        | "ref_material"
        | "ref_product"
        | "ref_machine"
        | "ref_employee"
        | "ref_location"
        | "ref_batch"
        | "ref_serial"
        | "repeater"
        | "handwriting"
        | "computed"
      service_version_entity: "form_layout" | "document_template" | "block"
      service_version_status: "draft" | "published" | "archived"
      stakeholder_channel: "email" | "phone" | "meeting" | "portal" | "other"
      stakeholder_frequency:
        | "daily"
        | "weekly"
        | "biweekly"
        | "monthly"
        | "quarterly"
        | "adhoc"
      step_condition_kind:
        | "temperature"
        | "ph"
        | "previous_step"
        | "manual_release"
        | "custom"
      step_position_status:
        | "open"
        | "in_progress"
        | "completed"
        | "not_feasible"
      step_run_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "skipped"
        | "cancelled"
      step_time_mode: "relative" | "absolute" | "condition"
      task_status: "open" | "in_progress" | "completed"
      traffic_light_status: "green" | "yellow" | "red"
      workflow_status:
        | "entwurf"
        | "geplant"
        | "pp_in_progress"
        | "pp_completed"
        | "samples_created"
        | "waiting_analysis"
        | "analysis_in_progress"
        | "results_complete"
        | "abgeschlossen"
      wp_dependency_type: "FS" | "FF" | "SS" | "SF"
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
    Enums: {
      absence_type: ["urlaub", "krankheit", "weiterbildung", "sonstiges"],
      app_role: ["master", "auftraggeber", "durchfuehrer"],
      change_request_status: ["pending", "approved", "rejected", "withdrawn"],
      container_kind: [
        "fass",
        "kanister",
        "sack",
        "big_bag",
        "ibc",
        "tank",
        "flasche",
        "sonstige",
        "kiste",
      ],
      container_movement_type: [
        "eingang",
        "umlagerung",
        "verbrauch",
        "korrektur_plus",
        "korrektur_minus",
        "inventur",
        "entsorgung",
        "reservierung",
        "freigabe_reservierung",
      ],
      container_status: [
        "verfuegbar",
        "reserviert",
        "in_verwendung",
        "leer",
        "gesperrt",
        "entsorgt",
      ],
      decision_status: ["active", "superseded", "rejected"],
      downtime_status: ["geplant", "aktiv", "abgeschlossen"],
      downtime_type: ["wartung", "reparatur", "sonstiges"],
      form_scope: ["template", "global"],
      masse_type: ["DK", "GK", "KK", "MK", "PK"],
      measurement_status: ["open", "in_progress", "completed"],
      milestone_status: ["planned", "in_progress", "completed"],
      mixture_batch_status: ["produced", "discarded"],
      mixture_category: ["mischung", "loesung"],
      mixture_deviation_kind: ["time", "quantity", "additional_raw", "process"],
      mixture_exec_status: [
        "geplant",
        "laufend",
        "abgeschlossen",
        "abgebrochen",
        "freigegeben",
      ],
      mixture_movement_type: ["eingang", "ausgang"],
      mixture_template_kind: [
        "standard",
        "customer",
        "development",
        "pilot",
        "production",
      ],
      order_instance_status: [
        "draft",
        "planned",
        "in_progress",
        "completed",
        "cancelled",
      ],
      order_kind: ["pilot_plant", "labor", "combined", "legacy"],
      order_priority: ["normal", "wichtig", "hoechste"],
      order_status: ["open", "in_progress", "completed"],
      order_type: ["customer", "production", "rnd"],
      order_workflow_status_new: [
        "entwurf",
        "geplant",
        "in_progress",
        "waiting",
        "review",
        "abgeschlossen",
        "abgebrochen",
      ],
      pilot_plant_block_key: [
        "stammdaten",
        "rezeptur",
        "knetung",
        "extrusion",
        "trocknung",
        "brennen",
        "probenentnahme",
        "uebergabe",
        "abschluss",
      ],
      pilot_plant_block_status: [
        "pending",
        "in_progress",
        "completed",
        "skipped",
      ],
      portfolio_document_category: [
        "foerderantrag",
        "foerdervertrag",
        "zwischenbericht",
        "endbericht",
        "praesentation",
        "publikation",
        "patent",
        "nachweis",
        "sonstiges",
      ],
      portfolio_milestone_status: ["offen", "erledigt", "ueberfaellig"],
      portfolio_milestone_type: [
        "antrag",
        "genehmigung",
        "zwischenbericht",
        "review",
        "abschluss",
        "sonstiges",
      ],
      portfolio_status: [
        "planung",
        "aktiv",
        "pausiert",
        "abgeschlossen",
        "abgebrochen",
      ],
      post_measurement_action: [
        "aufbewahren",
        "entsorgen",
        "zurueck",
        "andere",
      ],
      process_template_kind: ["labor", "pilot_plant"],
      process_template_scope: ["template", "snippet", "global"],
      project_closure_status: ["draft", "in_approval", "approved"],
      project_document_kind: ["application", "report"],
      project_role: ["owner", "leader", "member"],
      project_status: ["active", "completed"],
      raw_batch_inspection_status: [
        "ausstehend",
        "laufend",
        "bestanden",
        "nicht_bestanden",
      ],
      raw_batch_release_status: [
        "gesperrt",
        "in_pruefung",
        "freigegeben",
        "abgelehnt",
      ],
      reference_type: [
        "experiment",
        "serial",
        "batch",
        "complaint",
        "customer_ref",
        "internal",
      ],
      sample_status: [
        "neu",
        "eingelagert",
        "in_bearbeitung",
        "teilweise_verbraucht",
        "vollstaendig_verbraucht",
        "entsorgt",
        "zurueckgesendet",
      ],
      service_category: ["labor", "pilot_plant"],
      service_field_type: [
        "text",
        "longtext",
        "number",
        "decimal",
        "percent",
        "date",
        "time",
        "datetime",
        "boolean",
        "select",
        "multiselect",
        "file",
        "image",
        "barcode",
        "qrcode",
        "ref_customer",
        "ref_material",
        "ref_product",
        "ref_machine",
        "ref_employee",
        "ref_location",
        "ref_batch",
        "ref_serial",
        "repeater",
        "handwriting",
        "computed",
      ],
      service_version_entity: ["form_layout", "document_template", "block"],
      service_version_status: ["draft", "published", "archived"],
      stakeholder_channel: ["email", "phone", "meeting", "portal", "other"],
      stakeholder_frequency: [
        "daily",
        "weekly",
        "biweekly",
        "monthly",
        "quarterly",
        "adhoc",
      ],
      step_condition_kind: [
        "temperature",
        "ph",
        "previous_step",
        "manual_release",
        "custom",
      ],
      step_position_status: [
        "open",
        "in_progress",
        "completed",
        "not_feasible",
      ],
      step_run_status: [
        "pending",
        "in_progress",
        "completed",
        "skipped",
        "cancelled",
      ],
      step_time_mode: ["relative", "absolute", "condition"],
      task_status: ["open", "in_progress", "completed"],
      traffic_light_status: ["green", "yellow", "red"],
      workflow_status: [
        "entwurf",
        "geplant",
        "pp_in_progress",
        "pp_completed",
        "samples_created",
        "waiting_analysis",
        "analysis_in_progress",
        "results_complete",
        "abgeschlossen",
      ],
      wp_dependency_type: ["FS", "FF", "SS", "SF"],
    },
  },
} as const
