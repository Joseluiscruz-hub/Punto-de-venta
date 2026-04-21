export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';
export type PaymentMethod = 'CASH' | 'CARD';
export type MovementType = 'SALE' | 'PURCHASE' | 'ADJUSTMENT';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
}

export interface SaleItem extends Product {
  quantity: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  datetime: string;
  cashierId: string;
  items: SaleItem[];
  total: number;
  paymentMethod: PaymentMethod;
  amountTendered: number;
  change: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  userId: string;
  type: MovementType;
  quantity: number;
  date: string;
  reason?: string;
}
