// Product page JSONB sub-types
export type KeyPoint = { icon: string; title: string; description: string };
export type SpecItem = { label: string; value: string };
export type ProcessStep = { step: number; title: string; description: string; image?: string };
export type FigmaEmbed = { title: string; url: string };

export type Database = {
  public: {
    Tables: {
      company_info: {
        Row: {
          id: string;
          name: string;
          ceo_name: string;
          biz_number: string;
          biz_type: string;
          biz_category: string;
          address: string;
          phone: string;
          email: string | null;
          bank_name: string | null;
          bank_account: string | null;
          bank_holder: string | null;
          stamp_image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          ceo_name: string;
          biz_number: string;
          biz_type?: string;
          biz_category?: string;
          address?: string;
          phone?: string;
          email?: string | null;
          bank_name?: string | null;
          bank_account?: string | null;
          bank_holder?: string | null;
          stamp_image_url?: string | null;
        };
        Update: {
          name?: string;
          ceo_name?: string;
          biz_number?: string;
          biz_type?: string;
          biz_category?: string;
          address?: string;
          phone?: string;
          email?: string | null;
          bank_name?: string | null;
          bank_account?: string | null;
          bank_holder?: string | null;
          stamp_image_url?: string | null;
        };
      };
      companies: {
        Row: {
          id: string;
          name: string;
          ceo_name: string;
          biz_number: string;
          biz_type: string | null;
          biz_category: string | null;
          address: string | null;
          phone: string | null;
          email: string | null;
          contact_person: string | null;
          contact_phone: string | null;
          biz_cert_image_url: string | null;
          notes: string | null;
          company_type: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          ceo_name: string;
          biz_number: string;
          biz_type?: string | null;
          biz_category?: string | null;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          contact_person?: string | null;
          contact_phone?: string | null;
          biz_cert_image_url?: string | null;
          notes?: string | null;
          company_type?: string;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          ceo_name?: string;
          biz_number?: string;
          biz_type?: string | null;
          biz_category?: string | null;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          contact_person?: string | null;
          contact_phone?: string | null;
          biz_cert_image_url?: string | null;
          notes?: string | null;
          company_type?: string;
          is_active?: boolean;
        };
      };
      products: {
        Row: {
          id: string;
          name: string;
          category: string;
          unit: string;
          box_quantity: number;
          cost_price: number;
          selling_price: number;
          description: string | null;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          category: string;
          unit?: string;
          box_quantity?: number;
          cost_price?: number;
          selling_price?: number;
          description?: string | null;
          image_url?: string | null;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          category?: string;
          unit?: string;
          box_quantity?: number;
          cost_price?: number;
          selling_price?: number;
          description?: string | null;
          image_url?: string | null;
          is_active?: boolean;
        };
      };
      company_prices: {
        Row: {
          id: string;
          company_id: string;
          product_id: string;
          custom_price: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          product_id: string;
          custom_price: number;
        };
        Update: {
          company_id?: string;
          product_id?: string;
          custom_price?: number;
        };
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          company_id: string;
          order_date: string;
          status: string;
          total_amount: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          order_number: string;
          company_id: string;
          order_date?: string;
          status?: string;
          total_amount?: number;
          notes?: string | null;
        };
        Update: {
          order_number?: string;
          company_id?: string;
          order_date?: string;
          status?: string;
          total_amount?: number;
          notes?: string | null;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          product_name: string;
          unit: string;
          quantity: number;
          unit_price: number;
          amount: number;
          created_at: string;
        };
        Insert: {
          order_id: string;
          product_id: string;
          product_name: string;
          unit?: string;
          quantity?: number;
          unit_price?: number;
          amount?: number;
        };
        Update: {
          order_id?: string;
          product_id?: string;
          product_name?: string;
          unit?: string;
          quantity?: number;
          unit_price?: number;
          amount?: number;
        };
      };
      statements: {
        Row: {
          id: string;
          statement_number: string;
          order_id: string | null;
          company_id: string;
          statement_date: string;
          supply_amount: number;
          tax_amount: number;
          total_amount: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          statement_number: string;
          order_id?: string | null;
          company_id: string;
          statement_date?: string;
          supply_amount?: number;
          tax_amount?: number;
          total_amount?: number;
          notes?: string | null;
        };
        Update: {
          statement_number?: string;
          order_id?: string | null;
          company_id?: string;
          statement_date?: string;
          supply_amount?: number;
          tax_amount?: number;
          total_amount?: number;
          notes?: string | null;
        };
      };
      statement_items: {
        Row: {
          id: string;
          statement_id: string;
          product_name: string;
          specification: string | null;
          unit: string;
          quantity: number;
          unit_price: number;
          amount: number;
          created_at: string;
        };
        Insert: {
          statement_id: string;
          product_name: string;
          specification?: string | null;
          unit?: string;
          quantity?: number;
          unit_price?: number;
          amount?: number;
        };
        Update: {
          statement_id?: string;
          product_name?: string;
          specification?: string | null;
          unit?: string;
          quantity?: number;
          unit_price?: number;
          amount?: number;
        };
      };
      quotes: {
        Row: {
          id: string;
          quote_number: string;
          company_id: string;
          quote_date: string;
          valid_until: string | null;
          status: string;
          supply_amount: number;
          tax_amount: number;
          total_amount: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          quote_number: string;
          company_id: string;
          quote_date?: string;
          valid_until?: string | null;
          status?: string;
          supply_amount?: number;
          tax_amount?: number;
          total_amount?: number;
          notes?: string | null;
        };
        Update: {
          quote_number?: string;
          company_id?: string;
          quote_date?: string;
          valid_until?: string | null;
          status?: string;
          supply_amount?: number;
          tax_amount?: number;
          total_amount?: number;
          notes?: string | null;
        };
      };
      quote_items: {
        Row: {
          id: string;
          quote_id: string;
          product_id: string | null;
          product_name: string;
          specification: string | null;
          unit: string;
          quantity: number;
          unit_price: number;
          amount: number;
          created_at: string;
        };
        Insert: {
          quote_id: string;
          product_id?: string | null;
          product_name: string;
          specification?: string | null;
          unit?: string;
          quantity?: number;
          unit_price?: number;
          amount?: number;
        };
        Update: {
          quote_id?: string;
          product_id?: string | null;
          product_name?: string;
          specification?: string | null;
          unit?: string;
          quantity?: number;
          unit_price?: number;
          amount?: number;
        };
      };
      billings: {
        Row: {
          id: string;
          billing_number: string;
          company_id: string;
          billing_month: string;
          total_supply: number;
          total_tax: number;
          total_amount: number;
          paid_amount: number;
          status: string;
          paid_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          billing_number: string;
          company_id: string;
          billing_month: string;
          total_supply?: number;
          total_tax?: number;
          total_amount?: number;
          paid_amount?: number;
          status?: string;
          paid_date?: string | null;
          notes?: string | null;
        };
        Update: {
          billing_number?: string;
          company_id?: string;
          billing_month?: string;
          total_supply?: number;
          total_tax?: number;
          total_amount?: number;
          paid_amount?: number;
          status?: string;
          paid_date?: string | null;
          notes?: string | null;
        };
      };
      payments: {
        Row: {
          id: string;
          billing_id: string;
          amount: number;
          payment_date: string;
          payment_method: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          billing_id: string;
          amount: number;
          payment_date?: string;
          payment_method?: string | null;
          notes?: string | null;
        };
        Update: {
          billing_id?: string;
          amount?: number;
          payment_date?: string;
          payment_method?: string | null;
          notes?: string | null;
        };
      };
      inventory: {
        Row: {
          id: string;
          product_id: string;
          current_stock: number;
          safety_stock: number;
          last_in_date: string | null;
          last_out_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          product_id: string;
          current_stock?: number;
          safety_stock?: number;
          last_in_date?: string | null;
          last_out_date?: string | null;
        };
        Update: {
          product_id?: string;
          current_stock?: number;
          safety_stock?: number;
          last_in_date?: string | null;
          last_out_date?: string | null;
        };
      };
      inventory_logs: {
        Row: {
          id: string;
          product_id: string;
          type: string;
          quantity: number;
          reason: string | null;
          reference_id: string | null;
          reference_type: string | null;
          company_id: string | null;
          unit_price: number;
          log_date: string;
          created_at: string;
        };
        Insert: {
          product_id: string;
          type: string;
          quantity: number;
          reason?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          company_id?: string | null;
          unit_price?: number;
          log_date?: string;
        };
        Update: {
          product_id?: string;
          type?: string;
          quantity?: number;
          reason?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          company_id?: string | null;
          unit_price?: number;
          log_date?: string;
        };
      };
      expenses: {
        Row: {
          id: string;
          expense_date: string;
          category: string;
          description: string;
          amount: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          expense_date?: string;
          category?: string;
          description: string;
          amount?: number;
          notes?: string | null;
        };
        Update: {
          expense_date?: string;
          category?: string;
          description?: string;
          amount?: number;
          notes?: string | null;
        };
      };
      product_pages: {
        Row: {
          id: string;
          product_id: string;
          hero_image: string | null;
          subtitle: string | null;
          feature_title: string | null;
          feature_description: string | null;
          feature_image: string | null;
          key_points: KeyPoint[];
          specs: SpecItem[];
          detail_description: string | null;
          detail_images: string[];
          process_title: string | null;
          process_steps: ProcessStep[];
          gallery_images: string[];
          figma_urls: FigmaEmbed[];
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          product_id: string;
          hero_image?: string | null;
          subtitle?: string | null;
          feature_title?: string | null;
          feature_description?: string | null;
          feature_image?: string | null;
          key_points?: KeyPoint[];
          specs?: SpecItem[];
          detail_description?: string | null;
          detail_images?: string[];
          process_title?: string | null;
          process_steps?: ProcessStep[];
          gallery_images?: string[];
          figma_urls?: FigmaEmbed[];
          is_published?: boolean;
        };
        Update: {
          product_id?: string;
          hero_image?: string | null;
          subtitle?: string | null;
          feature_title?: string | null;
          feature_description?: string | null;
          feature_image?: string | null;
          key_points?: KeyPoint[];
          specs?: SpecItem[];
          detail_description?: string | null;
          detail_images?: string[];
          process_title?: string | null;
          process_steps?: ProcessStep[];
          gallery_images?: string[];
          figma_urls?: FigmaEmbed[];
          is_published?: boolean;
        };
      };
      members: {
        Row: {
          id: string;
          login_id: string | null;
          password_hash: string | null;
          name: string;
          company_name: string | null;
          phone: string | null;
          email: string | null;
          provider: string;
          provider_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          login_id?: string | null;
          password_hash?: string | null;
          name: string;
          company_name?: string | null;
          phone?: string | null;
          email?: string | null;
          provider?: string;
          provider_id?: string | null;
          is_active?: boolean;
        };
        Update: {
          login_id?: string | null;
          password_hash?: string | null;
          name?: string;
          company_name?: string | null;
          phone?: string | null;
          email?: string | null;
          provider?: string;
          provider_id?: string | null;
          is_active?: boolean;
        };
      };
      popups: {
        Row: {
          id: string;
          title: string;
          content: string | null;
          image_url: string | null;
          link_url: string | null;
          is_active: boolean;
          sort_order: number;
          start_date: string | null;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          content?: string | null;
          image_url?: string | null;
          link_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          start_date?: string | null;
          end_date?: string | null;
        };
        Update: {
          title?: string;
          content?: string | null;
          image_url?: string | null;
          link_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          start_date?: string | null;
          end_date?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

// Helper types
export type CompanyInfo = Database["public"]["Tables"]["company_info"]["Row"];
export type Company = Database["public"]["Tables"]["companies"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type CompanyPrice = Database["public"]["Tables"]["company_prices"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type Statement = Database["public"]["Tables"]["statements"]["Row"];
export type StatementItem = Database["public"]["Tables"]["statement_items"]["Row"];
export type Quote = Database["public"]["Tables"]["quotes"]["Row"];
export type QuoteItem = Database["public"]["Tables"]["quote_items"]["Row"];
export type Billing = Database["public"]["Tables"]["billings"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];

// Join types
export type OrderWithCompany = Order & { companies: Company };
export type OrderWithItems = Order & { companies: Company; order_items: OrderItem[] };
export type StatementWithCompany = Statement & { companies: Company };
export type StatementWithItems = Statement & { companies: Company; statement_items: StatementItem[] };
export type QuoteWithCompany = Quote & { companies: Company };
export type QuoteWithItems = Quote & { companies: Company; quote_items: QuoteItem[] };
export type BillingWithCompany = Billing & { companies: Company };
export type BillingWithPayments = Billing & { companies: Company; payments: Payment[] };
export type Inventory = Database["public"]["Tables"]["inventory"]["Row"];
export type InventoryLog = Database["public"]["Tables"]["inventory_logs"]["Row"];
export type Expense = Database["public"]["Tables"]["expenses"]["Row"];
export type InventoryWithProduct = Inventory & { products: Product };
export type ProductPage = Database["public"]["Tables"]["product_pages"]["Row"];
export type ProductPageWithProduct = ProductPage & { products: Product };
export type Popup = Database["public"]["Tables"]["popups"]["Row"];
export type Member = Database["public"]["Tables"]["members"]["Row"];
