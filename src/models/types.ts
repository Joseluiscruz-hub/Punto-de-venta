export type Money = number;
export type Id = string;
export type ISODateString = string;

export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';
export type Plan = 'BASIC' | 'PRO' | 'PREMIUM';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED';
export type RefundMethod = 'CASH' | 'STORE_CREDIT';
export type CashMovementType = 'CASH_IN' | 'CASH_OUT';
export type ReturnStatus = 'NONE' | 'PARTIAL' | 'FULL';
export type MovementType = 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'RETURN' | 'CASH_IN' | 'CASH_OUT';
export type Feature =
  'POS' | 'INVENTORY' | 'MULTISTORE' | 'AUDIT' | 'OFFLINE' | 'API' | 'CASH_CONTROL';
export type ShiftStatus = 'OPEN' | 'CLOSED';
export type View = 'pos' | 'dashboard' | 'inventory' | 'sales' | 'movements' | 'corte' | 'clients' | 'audit';

export interface Shift {
  id: Id;
  tenantId: Id;
  storeId: Id;
  registerId?: Id;
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
  refundsCash: Money;
  cashIn: Money;
  cashOut: Money; // Gastos o retiros durante el turno
  salesCount: number;
  differenceThreshold: Money;
}

export interface CashMovement {
  id: Id;
  externalId: Id;
  tenantId: Id;
  storeId: Id;
  registerId?: Id;
  shiftId: Id;
  userId: Id;
  type: CashMovementType;
  amount: Money;
  reason: string;
  createdAt: ISODateString;
}

export interface CreateCashMovementInput {
  externalId: Id;
  type: CashMovementType;
  amount: Money;
  reason: string;
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
  storeCredit: Money;
  totalSpent: Money;
  lastVisit?: ISODateString;
}

export interface Product {
  id: Id;
  tenantId: Id;
  barcode: string;
  name: string;
  category: string;
  imageUrl?: string;
  cost: Money;
  price: Money;
  active?: boolean;
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
  externalId?: Id;
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
  returnedTotal: Money;
  returnStatus: ReturnStatus;
}

export interface SaleItemWithName extends SaleItem {
  name: string;
  returnedQuantity: number;
}

export interface SaleReturnItem {
  id: Id;
  returnId: Id;
  saleItemId: Id;
  productId: Id;
  name: string;
  quantity: number;
  price: Money;
  subtotal: Money;
}

export interface SaleReturn {
  id: Id;
  tenantId: Id;
  storeId: Id;
  saleId: Id;
  shiftId: Id;
  userId: Id;
  refundMethod: RefundMethod;
  total: Money;
  reason: string;
  createdAt: ISODateString;
  items: SaleReturnItem[];
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
  register?: CashRegister;
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
  imageUrl?: string;
  cost: Money;
  price: Money;
  stock: number;
  minStock: number;
}

export interface UpdateProductInput extends CreateProductInput {
  id: Id;
  expectedStock: number;
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
  externalId?: Id;
}

export interface ReturnSaleInput {
  items: Array<{ saleItemId: Id; quantity: number }>;
  refundMethod: RefundMethod;
  reason: string;
}

export interface ReturnSaleResult {
  sale: Sale;
  saleReturn: SaleReturn;
}

export interface CashRegister {
  id: Id;
  storeId: Id;
  code: string;
  name: string;
}

export interface LoginInput {
  username: string;
  pin: string;
}

export interface LoginResponse {
  user: User;
  tenant: Tenant;
  store: Store;
  register?: CashRegister;
  token: string;
}

export interface AuditEvent {
  id: Id;
  tenantId: Id;
  actorUserId?: Id;
  actorName?: string;
  storeId?: Id;
  action: string;
  entityType: string;
  entityId?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  createdAt: ISODateString;
}

export interface AuditEventQuery {
  action?: string;
  entityType?: string;
  storeId?: Id;
  from?: ISODateString;
  to?: ISODateString;
  q?: string;
  limit?: number;
}
