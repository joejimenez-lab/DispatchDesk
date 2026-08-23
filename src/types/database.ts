export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type LoadStatus = Database["public"]["Enums"]["load_status"]
export type DocumentCategory = Database["public"]["Enums"]["document_category"]
export type ExpenseCategory = Database["public"]["Enums"]["expense_category"]
export type UnitType = Database["public"]["Enums"]["unit_type"]
export type MaintenanceReminderType = "Monthly service" | "90-day inspection" | "Annual inspection" | "Oil change" | "Repair follow-up" | "Daily repair log"
export type RepairLogType = "Repair" | "Daily repair log"

export const loadStatuses: LoadStatus[] = ["Booked", "Dispatched", "Picked Up", "In Transit", "Delivered", "Closed", "Cancelled"]
export const documentCategories: DocumentCategory[] = ["Rate Confirmation", "Invoice", "BOL", "Fuel Receipt", "Lumper Receipt", "Insurance", "Carrier Packet", "Other"]
export const expenseCategories: ExpenseCategory[] = ["Fuel", "Maintenance", "Tolls", "Insurance", "Permits", "Parking", "Parts", "Supplies", "Other"]
export const unitTypes: UnitType[] = ["Truck", "Trailer"]
export const repairLogTypes: RepairLogType[] = ["Repair", "Daily repair log"]
export const maintenanceReminderTypes: MaintenanceReminderType[] = ["Monthly service", "90-day inspection", "Annual inspection", "Oil change", "Repair follow-up"]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          load_id: string | null
          organization_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          load_id?: string | null
          organization_id?: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          load_id?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bookkeeping_expense_groups: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_email: string | null
          driver_id: string | null
          expense_date: string
          id: string
          ifta_fuel_purchase_id: string | null
          inspection_record_id: string | null
          load_id: string | null
          notes: string | null
          organization_id: string
          repair_log_id: string | null
          service_record_id: string | null
          source_id: string | null
          source_type: string
          unit_id: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          driver_id?: string | null
          expense_date: string
          id?: string
          ifta_fuel_purchase_id?: string | null
          inspection_record_id?: string | null
          load_id?: string | null
          notes?: string | null
          organization_id?: string
          repair_log_id?: string | null
          service_record_id?: string | null
          source_id?: string | null
          source_type?: string
          unit_id?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          driver_id?: string | null
          expense_date?: string
          id?: string
          ifta_fuel_purchase_id?: string | null
          inspection_record_id?: string | null
          load_id?: string | null
          notes?: string | null
          organization_id?: string
          repair_log_id?: string | null
          service_record_id?: string | null
          source_id?: string | null
          source_type?: string
          unit_id?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookkeeping_expense_groups_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookkeeping_expense_groups_ifta_fuel_purchase_id_fkey"
            columns: ["ifta_fuel_purchase_id"]
            isOneToOne: false
            referencedRelation: "ifta_fuel_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookkeeping_expense_groups_inspection_record_id_fkey"
            columns: ["inspection_record_id"]
            isOneToOne: false
            referencedRelation: "inspection_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookkeeping_expense_groups_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookkeeping_expense_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookkeeping_expense_groups_repair_log_id_fkey"
            columns: ["repair_log_id"]
            isOneToOne: false
            referencedRelation: "repair_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookkeeping_expense_groups_service_record_id_fkey"
            columns: ["service_record_id"]
            isOneToOne: false
            referencedRelation: "service_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookkeeping_expense_groups_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "fleet_units"
            referencedColumns: ["id"]
          },
        ]
      }
      bookkeeping_expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          group_id: string
          id: string
          line_type: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          group_id: string
          id?: string
          line_type?: string
          organization_id?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          group_id?: string
          id?: string
          line_type?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookkeeping_expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "bookkeeping_expense_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookkeeping_expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bookkeeping_receipts: {
        Row: {
          content_type: string
          created_at: string
          file_name: string
          file_size: number
          group_id: string
          id: string
          organization_id: string
          storage_path: string
        }
        Insert: {
          content_type: string
          created_at?: string
          file_name: string
          file_size: number
          group_id: string
          id?: string
          organization_id?: string
          storage_path: string
        }
        Update: {
          content_type?: string
          created_at?: string
          file_name?: string
          file_size?: number
          group_id?: string
          id?: string
          organization_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookkeeping_receipts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "bookkeeping_expense_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookkeeping_receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brokers: {
        Row: {
          company_name: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_name: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brokers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: Database["public"]["Enums"]["document_category"]
          created_at: string
          file_name: string
          id: string
          load_id: string
          notes: string | null
          organization_id: string
          storage_path: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          file_name: string
          id?: string
          load_id: string
          notes?: string | null
          organization_id?: string
          storage_path: string
        }
        Update: {
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          file_name?: string
          id?: string
          load_id?: string
          notes?: string | null
          organization_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          trailer_number: string | null
          truck_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          trailer_number?: string | null
          truck_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          trailer_number?: string | null
          truck_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_units: {
        Row: {
          company: string | null
          created_at: string
          id: string
          notes: string | null
          odometer: number | null
          organization_id: string
          unit_number: string
          unit_type: Database["public"]["Enums"]["unit_type"]
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          odometer?: number | null
          organization_id?: string
          unit_number: string
          unit_type: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          odometer?: number | null
          organization_id?: string
          unit_number?: string
          unit_type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ifta_fuel_purchases: {
        Row: {
          amount_paid: number
          city: string | null
          created_at: string
          gallons: number
          id: string
          notes: string | null
          organization_id: string
          purchase_date: string
          state: string
          truck_number: string
          unit_id: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount_paid?: number
          city?: string | null
          created_at?: string
          gallons: number
          id?: string
          notes?: string | null
          organization_id?: string
          purchase_date: string
          state: string
          truck_number: string
          unit_id?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount_paid?: number
          city?: string | null
          created_at?: string
          gallons?: number
          id?: string
          notes?: string | null
          organization_id?: string
          purchase_date?: string
          state?: string
          truck_number?: string
          unit_id?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ifta_fuel_purchases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ifta_fuel_purchases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "fleet_units"
            referencedColumns: ["id"]
          },
        ]
      }
      ifta_trip_miles: {
        Row: {
          id: string
          miles: number
          organization_id: string
          state: string
          trip_id: string
        }
        Insert: {
          id?: string
          miles: number
          organization_id?: string
          state: string
          trip_id: string
        }
        Update: {
          id?: string
          miles?: number
          organization_id?: string
          state?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ifta_trip_miles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ifta_trip_miles_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "ifta_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      ifta_trips: {
        Row: {
          created_at: string
          dropoff_city: string
          end_date: string | null
          id: string
          notes: string | null
          organization_id: string
          pickup_city: string
          start_date: string
          truck_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dropoff_city: string
          end_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          pickup_city: string
          start_date: string
          truck_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dropoff_city?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          pickup_city?: string
          start_date?: string
          truck_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ifta_trips_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_records: {
        Row: {
          cost: number
          created_at: string
          id: string
          inspection_date: string | null
          inspector: string | null
          notes: string | null
          odometer: number | null
          organization_id: string
          result: string | null
          unit_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          id?: string
          inspection_date?: string | null
          inspector?: string | null
          notes?: string | null
          odometer?: number | null
          organization_id?: string
          result?: string | null
          unit_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          inspection_date?: string | null
          inspector?: string | null
          notes?: string | null
          odometer?: number | null
          organization_id?: string
          result?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_records_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "fleet_units"
            referencedColumns: ["id"]
          },
        ]
      }
      load_deductions: {
        Row: {
          amount: number
          created_at: string
          id: string
          label: string
          load_id: string
          organization_id: string
          position: number
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          label: string
          load_id: string
          organization_id?: string
          position?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          label?: string
          load_id?: string
          organization_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "load_deductions_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_deductions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loads: {
        Row: {
          broker_id: string | null
          carrier_company: string | null
          created_at: string
          delivery_date: string | null
          delivery_location: string
          dispatcher_fee: number
          driver_id: string | null
          driver_pay: number
          factoring_amount: number
          factoring_fixed_amount: number
          factoring_mode: string
          factoring_percent: number
          fleet_company: string | null
          fuel_cost: number
          id: string
          is_round_trip: boolean
          load_number: string
          load_rate: number
          notes: string | null
          organization_id: string
          pickup_date: string | null
          pickup_location: string
          return_location: string | null
          round_trip_details: string | null
          status: Database["public"]["Enums"]["load_status"]
          trailer_number: string | null
          trailer_unit_id: string | null
          truck_number: string | null
          truck_unit_id: string | null
          updated_at: string
        }
        Insert: {
          broker_id?: string | null
          carrier_company?: string | null
          created_at?: string
          delivery_date?: string | null
          delivery_location: string
          dispatcher_fee?: number
          driver_id?: string | null
          driver_pay?: number
          factoring_amount?: number
          factoring_fixed_amount?: number
          factoring_mode?: string
          factoring_percent?: number
          fleet_company?: string | null
          fuel_cost?: number
          id?: string
          is_round_trip?: boolean
          load_number: string
          load_rate?: number
          notes?: string | null
          organization_id?: string
          pickup_date?: string | null
          pickup_location: string
          return_location?: string | null
          round_trip_details?: string | null
          status?: Database["public"]["Enums"]["load_status"]
          trailer_number?: string | null
          trailer_unit_id?: string | null
          truck_number?: string | null
          truck_unit_id?: string | null
          updated_at?: string
        }
        Update: {
          broker_id?: string | null
          carrier_company?: string | null
          created_at?: string
          delivery_date?: string | null
          delivery_location?: string
          dispatcher_fee?: number
          driver_id?: string | null
          driver_pay?: number
          factoring_amount?: number
          factoring_fixed_amount?: number
          factoring_mode?: string
          factoring_percent?: number
          fleet_company?: string | null
          fuel_cost?: number
          id?: string
          is_round_trip?: boolean
          load_number?: string
          load_rate?: number
          notes?: string | null
          organization_id?: string
          pickup_date?: string | null
          pickup_location?: string
          return_location?: string | null
          round_trip_details?: string | null
          status?: Database["public"]["Enums"]["load_status"]
          trailer_number?: string | null
          trailer_unit_id?: string | null
          truck_number?: string | null
          truck_unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loads_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_trailer_unit_id_fkey"
            columns: ["trailer_unit_id"]
            isOneToOne: false
            referencedRelation: "fleet_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_truck_unit_id_fkey"
            columns: ["truck_unit_id"]
            isOneToOne: false
            referencedRelation: "fleet_units"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_reminders: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          completed_by_email: string | null
          completion_record_id: string | null
          completion_record_table: string | null
          created_at: string
          created_by: string | null
          created_by_email: string | null
          due_date: string | null
          due_odometer: number | null
          id: string
          interval_days: number | null
          interval_miles: number | null
          notes: string | null
          organization_id: string
          reminder_type: string
          snoozed_until: string | null
          unit_id: string
          updated_at: string
          warning_days: number
          warning_miles: number
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          completed_by_email?: string | null
          completion_record_id?: string | null
          completion_record_table?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          due_date?: string | null
          due_odometer?: number | null
          id?: string
          interval_days?: number | null
          interval_miles?: number | null
          notes?: string | null
          organization_id?: string
          reminder_type: string
          snoozed_until?: string | null
          unit_id: string
          updated_at?: string
          warning_days?: number
          warning_miles?: number
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          completed_by_email?: string | null
          completion_record_id?: string | null
          completion_record_table?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          due_date?: string | null
          due_odometer?: number | null
          id?: string
          interval_days?: number | null
          interval_miles?: number | null
          notes?: string | null
          organization_id?: string
          reminder_type?: string
          snoozed_until?: string | null
          unit_id?: string
          updated_at?: string
          warning_days?: number
          warning_miles?: number
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_reminders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_reminders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "fleet_units"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          created_at: string
          id: string
          load_id: string
          note_text: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          load_id: string
          note_text: string
          organization_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          load_id?: string
          note_text?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          client_amount_received: number
          client_date_received: string | null
          client_paid: boolean
          created_at: string
          dispatcher_date_paid: string | null
          dispatcher_fee_amount: number
          dispatcher_paid: boolean
          driver_amount_paid: number
          driver_date_paid: string | null
          driver_paid: boolean
          id: string
          invoice_sent: boolean
          invoice_sent_date: string | null
          load_id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          client_amount_received?: number
          client_date_received?: string | null
          client_paid?: boolean
          created_at?: string
          dispatcher_date_paid?: string | null
          dispatcher_fee_amount?: number
          dispatcher_paid?: boolean
          driver_amount_paid?: number
          driver_date_paid?: string | null
          driver_paid?: boolean
          id?: string
          invoice_sent?: boolean
          invoice_sent_date?: string | null
          load_id: string
          organization_id?: string
          updated_at?: string
        }
        Update: {
          client_amount_received?: number
          client_date_received?: string | null
          client_paid?: boolean
          created_at?: string
          dispatcher_date_paid?: string | null
          dispatcher_fee_amount?: number
          dispatcher_paid?: boolean
          driver_amount_paid?: number
          driver_date_paid?: string | null
          driver_paid?: boolean
          id?: string
          invoice_sent?: boolean
          invoice_sent_date?: string | null
          load_id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: true
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      repair_logs: {
        Row: {
          cost: number
          created_at: string
          description: string
          id: string
          log_type: string
          notes: string | null
          odometer: number | null
          organization_id: string
          repair_date: string | null
          unit_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          description: string
          id?: string
          log_type?: string
          notes?: string | null
          odometer?: number | null
          organization_id?: string
          repair_date?: string | null
          unit_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          description?: string
          id?: string
          log_type?: string
          notes?: string | null
          odometer?: number | null
          organization_id?: string
          repair_date?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "fleet_units"
            referencedColumns: ["id"]
          },
        ]
      }
      service_records: {
        Row: {
          cost: number
          created_at: string
          description: string
          id: string
          notes: string | null
          odometer: number | null
          organization_id: string
          service_date: string | null
          unit_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          odometer?: number | null
          organization_id?: string
          service_date?: string | null
          unit_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          odometer?: number | null
          organization_id?: string
          service_date?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_records_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "fleet_units"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_cleanup_jobs: {
        Row: {
          bucket_id: string
          created_at: string
          document_id: string | null
          expense_group_id: string | null
          id: string
          last_attempted_at: string | null
          last_error: string | null
          load_id: string | null
          organization_id: string
          source: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          bucket_id?: string
          created_at?: string
          document_id?: string | null
          expense_group_id?: string | null
          id?: string
          last_attempted_at?: string | null
          last_error?: string | null
          load_id?: string | null
          organization_id?: string
          source: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          document_id?: string | null
          expense_group_id?: string | null
          id?: string
          last_attempted_at?: string | null
          last_error?: string | null
          load_id?: string | null
          organization_id?: string
          source?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_cleanup_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_ai_assistant_rate_limit: {
        Args: never
        Returns: {
          allowed: boolean
          retry_after_seconds: number
        }[]
      }
      complete_maintenance_reminder: {
        Args: {
          p_completed_date?: string
          p_cost?: number
          p_notes?: string
          p_odometer?: number
          p_reminder_id: string
        }
        Returns: string
      }
      complete_maintenance_with_expense: {
        Args: {
          p_completed_date: string
          p_cost_mode: string
          p_group_id: string
          p_labor_cost: number
          p_notes: string
          p_odometer: number
          p_parts_cost: number
          p_receipt?: Json
          p_reminder_id: string
          p_total_cost: number
          p_vendor: string
        }
        Returns: Json
      }
      create_load_with_deductions: {
        Args: { p_deductions: Json; p_load: Json }
        Returns: string
      }
      create_manual_bookkeeping_expense: {
        Args: { p_expense: Json; p_group_id: string; p_receipt?: Json }
        Returns: string
      }
      current_organization_id: { Args: never; Returns: string }
      delete_document_with_cleanup: {
        Args: { p_document_id: string }
        Returns: {
          bucket_id: string
          job_id: string
          load_id: string
          storage_path: string
        }[]
      }
      delete_ifta_fuel_purchase_with_expense: {
        Args: { p_purchase_id: string }
        Returns: {
          bucket_id: string
          expense_group_id: string
          job_id: string
          storage_path: string
        }[]
      }
      delete_load_with_document_cleanup: {
        Args: { p_load_id: string }
        Returns: {
          bucket_id: string
          job_id: string
          load_id: string
          storage_path: string
        }[]
      }
      queue_bookkeeping_group_delete: {
        Args: { p_allow_source?: string; p_group_id: string }
        Returns: {
          bucket_id: string
          expense_group_id: string
          job_id: string
          storage_path: string
        }[]
      }
      queue_bookkeeping_receipt_delete: {
        Args: { p_receipt_id: string }
        Returns: {
          bucket_id: string
          expense_group_id: string
          job_id: string
          storage_path: string
        }[]
      }
      reconcile_operational_expenses: {
        Args: { p_apply?: boolean }
        Returns: Json
      }
      save_ifta_fuel_purchase_with_expense: {
        Args: {
          p_group_id: string
          p_purchase: Json
          p_purchase_id: string
          p_receipt?: Json
        }
        Returns: string
      }
      update_bookkeeping_expense_group: {
        Args: { p_expense: Json; p_group_id: string; p_lines: Json }
        Returns: undefined
      }
      update_load_with_payment:
        | {
            Args: { p_load: Json; p_load_id: string; p_payment: Json }
            Returns: undefined
          }
        | {
            Args: {
              p_deductions: Json
              p_load: Json
              p_load_id: string
              p_payment: Json
            }
            Returns: undefined
          }
    }
    Enums: {
      document_category:
        | "Rate Confirmation"
        | "Invoice"
        | "BOL"
        | "Fuel Receipt"
        | "Lumper Receipt"
        | "Insurance"
        | "Carrier Packet"
        | "Other"
      expense_category:
        | "Fuel"
        | "Maintenance"
        | "Tolls"
        | "Insurance"
        | "Permits"
        | "Parking"
        | "Parts"
        | "Supplies"
        | "Other"
      load_status:
        | "Booked"
        | "Dispatched"
        | "Picked Up"
        | "In Transit"
        | "Delivered"
        | "Closed"
        | "Cancelled"
      unit_type: "Truck" | "Trailer"
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
      document_category: [
        "Rate Confirmation",
        "Invoice",
        "BOL",
        "Fuel Receipt",
        "Lumper Receipt",
        "Insurance",
        "Carrier Packet",
        "Other",
      ],
      expense_category: [
        "Fuel",
        "Maintenance",
        "Tolls",
        "Insurance",
        "Permits",
        "Parking",
        "Parts",
        "Supplies",
        "Other",
      ],
      load_status: [
        "Booked",
        "Dispatched",
        "Picked Up",
        "In Transit",
        "Delivered",
        "Closed",
        "Cancelled",
      ],
      unit_type: ["Truck", "Trailer"],
    },
  },
} as const
