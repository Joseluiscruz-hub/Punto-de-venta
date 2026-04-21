export type Money = number;
export type Id = string;
export type ISODateString = string;

export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';

export interface User {
  id: Id;
  username: string;
  name: string;
  role: Role;
}

export interface Product {
  id: Id;
  barcode: string;
  name: string;
  price: Money;
  cost: Money;
  stock: number;
  minStock: number;
  category: string;
  imageUrl?: string;
}

export interface SaleItem {
  productId: Id;
  name: string;
  price: Money;
  quantity: number;
  subtotal: Money;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';

export interface Sale {
  id: Id;
  date: ISODateString;
  items: SaleItem[];
  total: Money;
  paymentMethod: PaymentMethod;
  cashReceived?: Money;
  change?: Money;
  userId: Id;
  isOfflineSync?: boolean;
}

export interface ProcessSaleInput {
  items: SaleItem[];
  paymentMethod: PaymentMethod;
  cashReceived?: Money;
  isOfflineSync?: boolean;
  offlineDate?: ISODateString;
}

export interface CreateProductInput extends Omit<Product, 'id'> {}
