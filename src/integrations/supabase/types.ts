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
      measurement_orders: {
        Row: {
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          notes: string | null
          order_number: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          priority: Database["public"]["Enums"]["order_priority"]
          project_id: string
          ranking: number | null
          sample_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          due_date?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          priority?: Database["public"]["Enums"]["order_priority"]
          project_id: string
          ranking?: number | null
          sample_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          order_type?: Database["public"]["Enums"]["order_type"]
          priority?: Database["public"]["Enums"]["order_priority"]
          project_id?: string
          ranking?: number | null
          sample_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
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
      measurement_results: {
        Row: {
          created_at: string
          id: string
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
          id?: string
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
          id?: string
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
          category: Database["public"]["Enums"]["service_category"]
          color: string | null
          created_at: string
          department: string | null
          description: string | null
          hourly_rate: number
          icon: string | null
          id: string
          price: number | null
          responsible_user_id: string | null
          service_name: string
          standard_duration_hours: number
          updated_at: string
          workstation_id: string | null
        }
        Insert: {
          active?: boolean
          category: Database["public"]["Enums"]["service_category"]
          color?: string | null
          created_at?: string
          department?: string | null
          description?: string | null
          hourly_rate?: number
          icon?: string | null
          id?: string
          price?: number | null
          responsible_user_id?: string | null
          service_name: string
          standard_duration_hours?: number
          updated_at?: string
          workstation_id?: string | null
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["service_category"]
          color?: string | null
          created_at?: string
          department?: string | null
          description?: string | null
          hourly_rate?: number
          icon?: string | null
          id?: string
          price?: number | null
          responsible_user_id?: string | null
          service_name?: string
          standard_duration_hours?: number
          updated_at?: string
          workstation_id?: string | null
        }
        Relationships: [
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
          created_at: string
          deviation_abs: number | null
          deviation_pct: number | null
          id: string
          inventory_movement_id: string | null
          notes: string | null
          raw_material_batch_id: string | null
          raw_material_id: string
          step_id: string | null
          target_quantity: number | null
          unit: string
          weighed_at: string
          weighed_by: string | null
        }
        Insert: {
          actual_quantity: number
          batch_id: string
          created_at?: string
          deviation_abs?: number | null
          deviation_pct?: number | null
          id?: string
          inventory_movement_id?: string | null
          notes?: string | null
          raw_material_batch_id?: string | null
          raw_material_id: string
          step_id?: string | null
          target_quantity?: number | null
          unit?: string
          weighed_at?: string
          weighed_by?: string | null
        }
        Update: {
          actual_quantity?: number
          batch_id?: string
          created_at?: string
          deviation_abs?: number | null
          deviation_pct?: number | null
          id?: string
          inventory_movement_id?: string | null
          notes?: string | null
          raw_material_batch_id?: string | null
          raw_material_id?: string
          step_id?: string | null
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
      order_measurements: {
        Row: {
          actual_duration_hours: number | null
          assigned_to: string | null
          created_at: string
          due_date: string | null
          duration_deviation_reason: string | null
          estimated_delivery_date: string | null
          id: string
          measurement_number: string
          order_id: string
          planned_end_date: string | null
          planned_hours: number | null
          planned_start_date: string | null
          priority: number
          processing_time_hours: number
          ranking: number | null
          service_id: string
          status: Database["public"]["Enums"]["measurement_status"]
          updated_at: string
          workstation_id: string | null
        }
        Insert: {
          actual_duration_hours?: number | null
          assigned_to?: string | null
          created_at?: string
          due_date?: string | null
          duration_deviation_reason?: string | null
          estimated_delivery_date?: string | null
          id?: string
          measurement_number: string
          order_id: string
          planned_end_date?: string | null
          planned_hours?: number | null
          planned_start_date?: string | null
          priority?: number
          processing_time_hours?: number
          ranking?: number | null
          service_id: string
          status?: Database["public"]["Enums"]["measurement_status"]
          updated_at?: string
          workstation_id?: string | null
        }
        Update: {
          actual_duration_hours?: number | null
          assigned_to?: string | null
          created_at?: string
          due_date?: string | null
          duration_deviation_reason?: string | null
          estimated_delivery_date?: string | null
          id?: string
          measurement_number?: string
          order_id?: string
          planned_end_date?: string | null
          planned_hours?: number | null
          planned_start_date?: string | null
          priority?: number
          processing_time_hours?: number
          ranking?: number | null
          service_id?: string
          status?: Database["public"]["Enums"]["measurement_status"]
          updated_at?: string
          workstation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_measurements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "measurement_orders"
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
            foreignKeyName: "order_measurements_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
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
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
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
          project_id: string
          updated_at: string
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
          project_id: string
          updated_at?: string
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
          project_id?: string
          updated_at?: string
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
            foreignKeyName: "project_time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_weekly_reviews: {
        Row: {
          author_role_snapshot: string
          author_user_id: string
          completed_this_week: string
          created_at: string
          currently_working_on: string
          help_needed: string
          id: string
          iso_week: number
          iso_year: number
          next_steps: string
          other_comments: string
          overall_rating: number
          project_id: string
          review_date: string
          risks: string
        }
        Insert: {
          author_role_snapshot?: string
          author_user_id: string
          completed_this_week?: string
          created_at?: string
          currently_working_on?: string
          help_needed?: string
          id?: string
          iso_week: number
          iso_year: number
          next_steps?: string
          other_comments?: string
          overall_rating: number
          project_id: string
          review_date?: string
          risks?: string
        }
        Update: {
          author_role_snapshot?: string
          author_user_id?: string
          completed_this_week?: string
          created_at?: string
          currently_working_on?: string
          help_needed?: string
          id?: string
          iso_week?: number
          iso_year?: number
          next_steps?: string
          other_comments?: string
          overall_rating?: number
          project_id?: string
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
        ]
      }
      project_work_packages: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          milestone_id: string | null
          project_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["milestone_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          milestone_id?: string | null
          project_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["milestone_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          milestone_id?: string | null
          project_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["milestone_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
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
          project_name?: string | null
          project_number?: string
          project_status?: Database["public"]["Enums"]["project_status"]
          start_date?: string | null
          traffic_light?: Database["public"]["Enums"]["traffic_light_status"]
          updated_at?: string
        }
        Relationships: []
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
          created_at: string
          created_by: string
          current_quantity: number
          id: string
          initial_quantity: number
          kind: Database["public"]["Enums"]["container_kind"]
          location_id: string | null
          location_note: string | null
          notes: string | null
          raw_material_id: string
          reserved_quantity: number
          status: Database["public"]["Enums"]["container_status"]
          unit: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          batch_id?: string | null
          container_code: string
          created_at?: string
          created_by: string
          current_quantity?: number
          id?: string
          initial_quantity?: number
          kind?: Database["public"]["Enums"]["container_kind"]
          location_id?: string | null
          location_note?: string | null
          notes?: string | null
          raw_material_id: string
          reserved_quantity?: number
          status?: Database["public"]["Enums"]["container_status"]
          unit?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          batch_id?: string | null
          container_code?: string
          created_at?: string
          created_by?: string
          current_quantity?: number
          id?: string
          initial_quantity?: number
          kind?: Database["public"]["Enums"]["container_kind"]
          location_id?: string | null
          location_note?: string | null
          notes?: string | null
          raw_material_id?: string
          reserved_quantity?: number
          status?: Database["public"]["Enums"]["container_status"]
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
          location_id: string | null
          mixture_batch_id: string | null
          parent_sample_id: string | null
          post_measurement_action:
            | Database["public"]["Enums"]["post_measurement_action"]
            | null
          post_measurement_action_text: string | null
          project_id: string
          sample_group: string | null
          sample_name: string
          sample_number: string
          sampled_at: string | null
          sampled_by: string | null
          status: Database["public"]["Enums"]["sample_status"]
          storage_expiry_date: string | null
          storage_hints: string | null
          storage_min_duration: string | null
          tags: Json
          updated_at: string
        }
        Insert: {
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
          location_id?: string | null
          mixture_batch_id?: string | null
          parent_sample_id?: string | null
          post_measurement_action?:
            | Database["public"]["Enums"]["post_measurement_action"]
            | null
          post_measurement_action_text?: string | null
          project_id: string
          sample_group?: string | null
          sample_name: string
          sample_number: string
          sampled_at?: string | null
          sampled_by?: string | null
          status?: Database["public"]["Enums"]["sample_status"]
          storage_expiry_date?: string | null
          storage_hints?: string | null
          storage_min_duration?: string | null
          tags?: Json
          updated_at?: string
        }
        Update: {
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
          location_id?: string | null
          mixture_batch_id?: string | null
          parent_sample_id?: string | null
          post_measurement_action?:
            | Database["public"]["Enums"]["post_measurement_action"]
            | null
          post_measurement_action_text?: string | null
          project_id?: string
          sample_group?: string | null
          sample_name?: string
          sample_number?: string
          sampled_at?: string | null
          sampled_by?: string | null
          status?: Database["public"]["Enums"]["sample_status"]
          storage_expiry_date?: string | null
          storage_hints?: string | null
          storage_min_duration?: string | null
          tags?: Json
          updated_at?: string
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
            foreignKeyName: "samples_parent_sample_id_fkey"
            columns: ["parent_sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          legacy_parameter_id: string | null
          max_value: number | null
          min_value: number | null
          parent_field_id: string | null
          readonly: boolean
          ref_target: string | null
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
          legacy_parameter_id?: string | null
          max_value?: number | null
          min_value?: number | null
          parent_field_id?: string | null
          readonly?: boolean
          ref_target?: string | null
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
          legacy_parameter_id?: string | null
          max_value?: number | null
          min_value?: number | null
          parent_field_id?: string | null
          readonly?: boolean
          ref_target?: string | null
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
    }
    Functions: {
      activate_mixture_recipe_version: {
        Args: { _version_id: string }
        Returns: undefined
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
      book_container_consumption: {
        Args: {
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
      can_edit_project_governance: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_others_vacation: { Args: { _user_id: string }; Returns: boolean }
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
      diff_recipe_versions: {
        Args: { _version_a: string; _version_b: string }
        Returns: Json
      }
      finalize_project_closure: {
        Args: { _closure_id: string }
        Returns: undefined
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
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
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
      priority_enum_to_int: {
        Args: { p: Database["public"]["Enums"]["order_priority"] }
        Returns: number
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
      order_priority: "normal" | "wichtig" | "hoechste"
      order_status: "open" | "in_progress" | "completed"
      order_type: "customer" | "production" | "rnd"
      post_measurement_action:
        | "aufbewahren"
        | "entsorgen"
        | "zurueck"
        | "andere"
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
      step_time_mode: "relative" | "absolute" | "condition"
      task_status: "open" | "in_progress" | "completed"
      traffic_light_status: "green" | "yellow" | "red"
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
      order_priority: ["normal", "wichtig", "hoechste"],
      order_status: ["open", "in_progress", "completed"],
      order_type: ["customer", "production", "rnd"],
      post_measurement_action: [
        "aufbewahren",
        "entsorgen",
        "zurueck",
        "andere",
      ],
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
      step_time_mode: ["relative", "absolute", "condition"],
      task_status: ["open", "in_progress", "completed"],
      traffic_light_status: ["green", "yellow", "red"],
    },
  },
} as const
