export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt?: string;
}

export interface Business {
  id: string;
  name: string;
  businessType: string;
  phone?: string;
  email?: string;
  address?: string;
  logo?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  product_count?: number;
  created_at?: string;
}

export interface Product {
  id: string;
  business_id: string;
  category_id?: string;
  category_name?: string;
  name: string;
  sku?: string;
  barcode?: string;
  brand?: string;
  description?: string;
  purchase_price: number;
  selling_price: number;
  tax_percentage: number;
  current_stock: number;
  min_stock: number;
  unit: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  created_at?: string;
  updated_at?: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  total_spent: number;
  created_at?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountPercent?: number;
  tax: number;
}

export interface Sale {
  id: string;
  business_id: string;
  invoice_number: string;
  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  cashier_name?: string;
  subtotal: number;
  discount: number;
  tax: number;
  grand_total: number;
  payment_method: 'CASH' | 'CARD' | 'UPI' | 'SPLIT';
  payment_status: 'PAID' | 'PARTIAL' | 'UNPAID';
  status: 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
  subtotal: number;
  sku?: string;
  barcode?: string;
}

export interface Payment {
  id: string;
  sale_id: string;
  payment_method: 'CASH' | 'CARD' | 'UPI' | 'SPLIT';
  amount: number;
  status: string;
  created_at: string;
}

export interface HeldSale {
  id: string;
  business_id: string;
  user_id?: string;
  customer_id?: string;
  customer_name?: string;
  cashier_name?: string;
  cart_json: string;
  note?: string;
  created_at: string;
}

export interface ReceiptData {
  business: Business;
  settings: Record<string, string>;
  sale: Sale;
  items: SaleItem[];
  payments: Payment[];
}

export interface InventoryTransaction {
  id: string;
  business_id: string;
  product_id: string;
  product_name?: string;
  sku?: string;
  barcode?: string;
  unit?: string;
  transaction_type: 'STOCK_IN' | 'STOCK_OUT' | 'SALE' | 'RETURN' | 'ADJUSTMENT';
  quantity: number;
  reference_id?: string;
  notes?: string;
  user_id?: string;
  user_name?: string;
  created_at: string;
}

export interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  productsSold: number;
  grossProfit: number;
  todayExpenses: number;
  lowStockItems: number;
  totalProducts: number;
  totalCustomers: number;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entity_id?: string;
  metadata?: string;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}
