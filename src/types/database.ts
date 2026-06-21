export type LoadStatus =
  | "Booked"
  | "Dispatched"
  | "Picked Up"
  | "In Transit"
  | "Delivered"
  | "Closed"
  | "Cancelled";

export type DocumentCategory =
  | "Rate Confirmation"
  | "Invoice"
  | "BOL"
  | "Fuel Receipt"
  | "Lumper Receipt"
  | "Insurance"
  | "Carrier Packet"
  | "Other";

export const loadStatuses: LoadStatus[] = [
  "Booked",
  "Dispatched",
  "Picked Up",
  "In Transit",
  "Delivered",
  "Closed",
  "Cancelled",
];

export const documentCategories: DocumentCategory[] = [
  "Rate Confirmation",
  "Invoice",
  "BOL",
  "Fuel Receipt",
  "Lumper Receipt",
  "Insurance",
  "Carrier Packet",
  "Other",
];

export type UnitType = "Truck" | "Trailer";

export const unitTypes: UnitType[] = ["Truck", "Trailer"];

export type MaintenanceReminderType =
  | "Monthly service"
  | "90-day inspection"
  | "Annual inspection"
  | "Oil change"
  | "Repair follow-up"
  | "Daily repair log";

export type RepairLogType = "Repair" | "Daily repair log";

export const repairLogTypes: RepairLogType[] = ["Repair", "Daily repair log"];

export const maintenanceReminderTypes: MaintenanceReminderType[] = [
  "Monthly service",
  "90-day inspection",
  "Annual inspection",
  "Oil change",
  "Repair follow-up",
];

export type Database = {
  public: {
    Tables: {
      drivers: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          truck_number: string | null;
          trailer_number: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          truck_number?: string | null;
          trailer_number?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["drivers"]["Insert"]>;
        Relationships: [];
      };
      brokers: {
        Row: {
          id: string;
          company_name: string;
          contact_name: string | null;
          phone: string | null;
          email: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_name: string;
          contact_name?: string | null;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["brokers"]["Insert"]>;
        Relationships: [];
      };
      loads: {
        Row: {
          id: string;
          load_number: string;
          broker_id: string | null;
          carrier_company: string | null;
          driver_id: string | null;
          pickup_location: string;
          pickup_date: string | null;
          delivery_location: string;
          delivery_date: string | null;
          is_round_trip: boolean;
          round_trip_details: string | null;
          load_rate: number;
          driver_pay: number;
          dispatcher_fee: number;
          fuel_cost: number;
          notes: string | null;
          status: LoadStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          load_number: string;
          broker_id?: string | null;
          carrier_company?: string | null;
          driver_id?: string | null;
          pickup_location: string;
          pickup_date?: string | null;
          delivery_location: string;
          delivery_date?: string | null;
          is_round_trip?: boolean;
          round_trip_details?: string | null;
          load_rate?: number;
          driver_pay?: number;
          dispatcher_fee?: number;
          fuel_cost?: number;
          notes?: string | null;
          status?: LoadStatus;
        };
        Update: Partial<Database["public"]["Tables"]["loads"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "loads_broker_id_fkey";
            columns: ["broker_id"];
            isOneToOne: false;
            referencedRelation: "brokers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loads_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          load_id: string;
          invoice_sent: boolean;
          invoice_sent_date: string | null;
          client_paid: boolean;
          client_amount_received: number;
          client_date_received: string | null;
          driver_paid: boolean;
          driver_amount_paid: number;
          driver_date_paid: string | null;
          dispatcher_fee_amount: number;
          dispatcher_paid: boolean;
          dispatcher_date_paid: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          load_id: string;
          invoice_sent?: boolean;
          invoice_sent_date?: string | null;
          client_paid?: boolean;
          client_amount_received?: number;
          client_date_received?: string | null;
          driver_paid?: boolean;
          driver_amount_paid?: number;
          driver_date_paid?: string | null;
          dispatcher_fee_amount?: number;
          dispatcher_paid?: boolean;
          dispatcher_date_paid?: string | null;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["payments"]["Insert"], "load_id">>;
        Relationships: [
          {
            foreignKeyName: "payments_load_id_fkey";
            columns: ["load_id"];
            isOneToOne: true;
            referencedRelation: "loads";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          load_id: string;
          file_name: string;
          category: DocumentCategory;
          notes: string | null;
          storage_path: string;
          created_at: string;
        };
        Insert: {
          load_id: string;
          file_name: string;
          category: DocumentCategory;
          notes?: string | null;
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "documents_load_id_fkey";
            columns: ["load_id"];
            isOneToOne: false;
            referencedRelation: "loads";
            referencedColumns: ["id"];
          },
        ];
      };
      notes: {
        Row: {
          id: string;
          load_id: string;
          note_text: string;
          created_at: string;
        };
        Insert: {
          load_id: string;
          note_text: string;
        };
        Update: Partial<Database["public"]["Tables"]["notes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "notes_load_id_fkey";
            columns: ["load_id"];
            isOneToOne: false;
            referencedRelation: "loads";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_logs: {
        Row: {
          id: string;
          load_id: string | null;
          action: string;
          created_at: string;
        };
        Insert: {
          load_id?: string | null;
          action: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "activity_logs_load_id_fkey";
            columns: ["load_id"];
            isOneToOne: false;
            referencedRelation: "loads";
            referencedColumns: ["id"];
          },
        ];
      };
      fleet_units: {
        Row: {
          id: string;
          unit_number: string;
          unit_type: UnitType;
          company: string | null;
          odometer: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unit_number: string;
          unit_type: UnitType;
          company?: string | null;
          odometer?: number | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["fleet_units"]["Insert"]>;
        Relationships: [];
      };
      service_records: {
        Row: {
          id: string;
          unit_id: string;
          service_date: string | null;
          odometer: number | null;
          description: string;
          cost: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          unit_id: string;
          service_date?: string | null;
          odometer?: number | null;
          description: string;
          cost?: number;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["service_records"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "service_records_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "fleet_units";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_records: {
        Row: {
          id: string;
          unit_id: string;
          inspection_date: string | null;
          odometer: number | null;
          inspector: string | null;
          result: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          unit_id: string;
          inspection_date?: string | null;
          odometer?: number | null;
          inspector?: string | null;
          result?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["inspection_records"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "inspection_records_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "fleet_units";
            referencedColumns: ["id"];
          },
        ];
      };
      repair_logs: {
        Row: {
          id: string;
          unit_id: string;
          repair_date: string | null;
          odometer: number | null;
          description: string;
          log_type: RepairLogType;
          cost: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          unit_id: string;
          repair_date?: string | null;
          odometer?: number | null;
          description: string;
          log_type?: RepairLogType;
          cost?: number;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["repair_logs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "repair_logs_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "fleet_units";
            referencedColumns: ["id"];
          },
        ];
      };
      maintenance_reminders: {
        Row: {
          id: string;
          unit_id: string;
          reminder_type: MaintenanceReminderType;
          due_date: string | null;
          due_odometer: number | null;
          interval_days: number | null;
          interval_miles: number | null;
          warning_days: number;
          warning_miles: number;
          notes: string | null;
          snoozed_until: string | null;
          completed_at: string | null;
          completed_by: string | null;
          completed_by_email: string | null;
          completion_record_table: "service_records" | "inspection_records" | "repair_logs" | null;
          completion_record_id: string | null;
          created_by: string | null;
          created_by_email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          reminder_type: MaintenanceReminderType;
          due_date?: string | null;
          due_odometer?: number | null;
          interval_days?: number | null;
          interval_miles?: number | null;
          warning_days?: number;
          warning_miles?: number;
          notes?: string | null;
          snoozed_until?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          completed_by_email?: string | null;
          completion_record_table?: "service_records" | "inspection_records" | "repair_logs" | null;
          completion_record_id?: string | null;
          created_by?: string | null;
          created_by_email?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["maintenance_reminders"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "maintenance_reminders_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "fleet_units";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      complete_maintenance_reminder: {
        Args: {
          p_reminder_id: string;
          p_completed_date?: string;
          p_odometer?: number | null;
          p_notes?: string | null;
          p_cost?: number;
        };
        Returns: string | null;
      };
    };
    Enums: {
      load_status: LoadStatus;
      document_category: DocumentCategory;
      unit_type: UnitType;
    };
  };
};
