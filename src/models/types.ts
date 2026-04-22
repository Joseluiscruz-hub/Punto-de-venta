export type Money = number;
export type Id = string;
export type ISODateString = string;

export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';
export type Plan = 'BASIC' | 'PRO' | 'PREMIUM';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED';
export type MovementType = 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'RETURN' | 'CASH_IN' | 'CASH_OUT';
export type Feature = 'POS' | 'INVENTORY' | 'MULTISTORE' | 'AUDIT' | 'OFFLINE' | 'API' | 'CASH_CONTROL';
export type ShiftStatus = 'OPEN' | 'CLOSED';

export interface Shift {
  id: Id;
  tenantId: Id;
  storeId: Id;
  userId: Id;
  startTime: ISODateString;
  endTime?: ISODateString;
  initialCash: Money;
  expectedCash: Money;
  actualCash?: Money;
  difference?: Money;
  status: ShiftStatus;
  salesCash: Money;
  salesCard: Money;
  cashOut: Money; // Gastos o retiros durante el turno
}

export interface Tenant {
  id: Id;
  name: string;
  plan: Plan;
}

export interface Store {
  id: Id;
  tenantId: Id;
  name: string;
  address: string;
}

export interface User {
  id: Id;
  tenantId: Id;
  storeId: Id;
  username: string;
  name: string;
  role: Role;
}

export interface Client {
  id: Id;
  tenantId: Id;
  name: string;
  email?: string;
  phone?: string;
  taxId?: string; // RFC o similar
  points: number;
  totalSpent: Money;
  lastVisit?: ISODateString;
}

export interface Product {
  id: Id;
  tenantId: Id;
  barcode: string;
  name: string;
  category: string;
  cost: Money;
  price: Money;
}

export interface StoreProduct {
  id: Id;
  tenantId: Id;
  storeId: Id;
  productId: Id;
  stock: number;
  minStock: number;
}

export interface SaleItem {
  id: Id;
  saleId: Id;
  productId: Id;
  quantity: number;
  price: Money;
  cost: Money;
  subtotal: Money;
}

export interface Sale {
  id: Id;
  tenantId: Id;
  storeId: Id;
  cashierId: Id;
  clientId?: Id;
  datetime: ISODateString;
  total: Money;
  paymentMethod: PaymentMethod;
  amountTendered: Money;
  changeAmount: Money;
  itemsCount: number;
  items?: SaleItemWithName[];
}

export interface SaleItemWithName extends SaleItem {
  name: string;
}

export interface StockMovement {
  id: Id;
  tenantId: Id;
  storeId: Id;
  productId: Id;
  userId: Id;
  type: MovementType;
  quantity: number;
  date: ISODateString;
  reason: string;
}

export interface ProductView extends Product {
  stock: number;
  minStock: number;
}

export interface StockMovementView extends StockMovement {
  productName: string;
  userName: string;
}

export interface Session {
  user: User;
  tenant: Tenant;
  store: Store;
  token: string;
}

export interface RequestContext {
  tenantId: Id;
  storeId: Id;
  userId: Id;
}

export interface CreateProductInput {
  barcode: string;
  name: string;
  category: string;
  cost: Money;
  price: Money;
  stock: number;
  minStock: number;
}

export interface UpdateProductInput extends CreateProductInput {
  id: Id;
}

export interface CartItem extends ProductView {
  quantity: number;
  subtotal: Money;
}

export interface ProcessSaleInput {
  items: CartItem[];
  paymentMethod: PaymentMethod;
  amountTendered: Money;
  clientId?: Id;
  isOfflineSync?: boolean;
  offlineDate?: ISODateString;
}

export interface LoginInput {
  username: string;
  pin: string;
}

export interface LoginResponse {
  user: User;
  tenant: Tenant;
  store: Store;
  token: string;
}
