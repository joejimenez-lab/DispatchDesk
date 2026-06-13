export type LoadStatus =
  | "Booked"
  | "Dispatched"
  | "Picked Up"
  | "In Transit"
  | "Delivered"
  | "POD Received"
  | "Invoiced"
  | "Client Paid"
  | "Driver Paid"
  | "Dispatcher Paid"
  | "Closed"
  | "Cancelled";

export type DocumentCategory =
  | "Rate Confirmation"
  | "POD"
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
  "POD Received",
  "Invoiced",
  "Client Paid",
  "Driver Paid",
  "Dispatcher Paid",
  "Closed",
  "Cancelled",
];

export const documentCategories: DocumentCategory[] = [
  "Rate Confirmation",
  "POD",
  "Invoice",
  "BOL",
  "Fuel Receipt",
  "Lumper Receipt",
  "Insurance",
  "Carrier Packet",
  "Other",
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
          load_rate: number;
          driver_pay: number;
          dispatcher_fee: number;
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
          load_rate?: number;
          driver_pay?: number;
          dispatcher_fee?: number;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      load_status: LoadStatus;
      document_category: DocumentCategory;
    };
  };
};
