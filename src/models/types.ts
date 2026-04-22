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

export interface Customer {
  id: Id;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  totalSpent: Money;
  lastVisit: ISODateString;
}

export interface PurchaseItem {
  productId: Id;
  name: string;
  cost: Money;
  quantity: number;
  subtotal: Money;
}

export interface Purchase {
  id: Id;
  date: ISODateString;
  provider: string;
  items: PurchaseItem[];
  total: Money;
  status: 'COMPLETED' | 'PENDING';
}

export interface SaleItem {
  productId: Id;
  name: string;
  price: Money;
  quantity: number;
  subtotal: Money;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED';

export interface Sale {
  id: Id;
  date: ISODateString;
  items: SaleItem[];
  total: Money;
  paymentMethod: PaymentMethod;
  cashReceived?: Money;
  change?: Money;
  userId: Id;
  customerId?: Id;
  isOfflineSync?: boolean;
}

export interface StoreConfig {
  name: string;
  address: string;
  phone: string;
  taxId: string;
  currency: string;
  taxRate: number;
}

export interface ProcessSaleInput {
  items: SaleItem[];
  paymentMethod: PaymentMethod;
  cashReceived?: Money;
  customerId?: Id;
  isOfflineSync?: boolean;
  offlineDate?: ISODateString;
}

export interface CreateProductInput extends Omit<Product, 'id'> {}
export interface CreateCustomerInput extends Omit<Customer, 'id' | 'totalSpent' | 'lastVisit'> {}
export interface CreatePurchaseInput extends Omit<Purchase, 'id'> {}
