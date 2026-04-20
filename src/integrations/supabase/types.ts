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
          created_at: string
          hourly_rate: number
          id: string
          responsible_user_id: string | null
          service_name: string
          standard_duration_hours: number
          updated_at: string
          workstation_id: string | null
        }
        Insert: {
          active?: boolean
          category: Database["public"]["Enums"]["service_category"]
          created_at?: string
          hourly_rate?: number
          id?: string
          responsible_user_id?: string | null
          service_name: string
          standard_duration_hours?: number
          updated_at?: string
          workstation_id?: string | null
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          hourly_rate?: number
          id?: string
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
      profiles: {
        Row: {
          created_at: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
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
          short_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      project_time_entries: {
        Row: {
          created_at: string
          created_by: string
          duration_minutes: number
          entry_date: string
          id: string
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
          id?: string
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
          id?: string
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
          id: string
          notes: string | null
          raw_material_id: string
          supplier: string | null
          updated_at: string
        }
        Insert: {
          batch_number: string
          created_at?: string
          delivery_date?: string | null
          delivery_quantity?: number | null
          id?: string
          notes?: string | null
          raw_material_id: string
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          batch_number?: string
          created_at?: string
          delivery_date?: string | null
          delivery_quantity?: number | null
          id?: string
          notes?: string | null
          raw_material_id?: string
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
          created_at: string
          created_by: string
          default_location_id: string | null
          description: string | null
          id: string
          material_name: string
          material_number: string
          price_per_kg: number | null
          supplier: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          default_location_id?: string | null
          description?: string | null
          id?: string
          material_name: string
          material_number: string
          price_per_kg?: number | null
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_location_id?: string | null
          description?: string | null
          id?: string
          material_name?: string
          material_number?: string
          price_per_kg?: number | null
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
          parent_sample_id: string | null
          post_measurement_action:
            | Database["public"]["Enums"]["post_measurement_action"]
            | null
          post_measurement_action_text: string | null
          project_id: string
          sample_group: string | null
          sample_name: string
          sample_number: string
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
          parent_sample_id?: string | null
          post_measurement_action?:
            | Database["public"]["Enums"]["post_measurement_action"]
            | null
          post_measurement_action_text?: string | null
          project_id: string
          sample_group?: string | null
          sample_name: string
          sample_number: string
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
          parent_sample_id?: string | null
          post_measurement_action?:
            | Database["public"]["Enums"]["post_measurement_action"]
            | null
          post_measurement_action_text?: string | null
          project_id?: string
          sample_group?: string | null
          sample_name?: string
          sample_number?: string
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
      storage_locations: {
        Row: {
          created_at: string
          hall: string
          id: string
          position: string | null
          room: string | null
          shelf: string | null
        }
        Insert: {
          created_at?: string
          hall: string
          id?: string
          position?: string | null
          room?: string | null
          shelf?: string | null
        }
        Update: {
          created_at?: string
          hall?: string
          id?: string
          position?: string | null
          room?: string | null
          shelf?: string | null
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
      [_ in never]: never
    }
    Functions: {
      can_view_others_vacation: { Args: { _user_id: string }; Returns: boolean }
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
      priority_enum_to_int: {
        Args: { p: Database["public"]["Enums"]["order_priority"] }
        Returns: number
      }
    }
    Enums: {
      absence_type: "urlaub" | "krankheit" | "weiterbildung" | "sonstiges"
      app_role: "master" | "auftraggeber" | "durchfuehrer"
      downtime_status: "geplant" | "aktiv" | "abgeschlossen"
      downtime_type: "wartung" | "reparatur" | "sonstiges"
      measurement_status: "open" | "in_progress" | "completed"
      milestone_status: "planned" | "in_progress" | "completed"
      order_priority: "normal" | "wichtig" | "hoechste"
      order_status: "open" | "in_progress" | "completed"
      order_type: "customer" | "production" | "rnd"
      post_measurement_action:
        | "aufbewahren"
        | "entsorgen"
        | "zurueck"
        | "andere"
      project_role: "owner" | "leader" | "member"
      project_status: "active" | "completed"
      sample_status:
        | "neu"
        | "eingelagert"
        | "in_bearbeitung"
        | "teilweise_verbraucht"
        | "vollstaendig_verbraucht"
        | "entsorgt"
        | "zurueckgesendet"
      service_category: "labor" | "pilot_plant"
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
      downtime_status: ["geplant", "aktiv", "abgeschlossen"],
      downtime_type: ["wartung", "reparatur", "sonstiges"],
      measurement_status: ["open", "in_progress", "completed"],
      milestone_status: ["planned", "in_progress", "completed"],
      order_priority: ["normal", "wichtig", "hoechste"],
      order_status: ["open", "in_progress", "completed"],
      order_type: ["customer", "production", "rnd"],
      post_measurement_action: [
        "aufbewahren",
        "entsorgen",
        "zurueck",
        "andere",
      ],
      project_role: ["owner", "leader", "member"],
      project_status: ["active", "completed"],
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
      task_status: ["open", "in_progress", "completed"],
      traffic_light_status: ["green", "yellow", "red"],
    },
  },
} as const
