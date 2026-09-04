import type {
  AuditEvent,
  AuditEventQuery,
  CashMovement,
  Client,
  CreateCashMovementInput,
  CreateProductInput,
  LoginResponse,
  ProcessSaleInput,
  ProductView,
  RequestContext,
  ReturnSaleInput,
  ReturnSaleResult,
  Sale,
  Shift,
  StockMovementView,
  UpdateProductInput,
} from '../models/types';
import { BackendAPI as localBackend } from './localBackend';
import { remoteBackend } from './remoteBackend';

export interface BackendContract {
  login(username: string, pin: string): Promise<LoginResponse>;
  logout(): Promise<void>;
  deleteProduct(context: RequestContext, productId: string): Promise<void>;
  getStoreProducts(context: RequestContext): Promise<ProductView[]>;
  saveProduct(
    context: RequestContext,
    product: CreateProductInput | UpdateProductInput,
  ): Promise<ProductView>;
  saveProductsBulk(context: RequestContext, products: CreateProductInput[]): Promise<void>;
  processSale(context: RequestContext, sale: ProcessSaleInput): Promise<Sale>;
  returnSale(
    context: RequestContext,
    saleId: string,
    input: ReturnSaleInput,
  ): Promise<ReturnSaleResult>;
  getActiveShift(context: RequestContext): Promise<Shift | null>;
  openShift(context: RequestContext, initialCash: number): Promise<Shift>;
  closeShift(context: RequestContext, actualCash: number): Promise<Shift>;
  addCashMovement(
    context: RequestContext,
    shiftId: string,
    movement: CreateCashMovementInput,
  ): Promise<CashMovement>;
  getCashMovements(context: RequestContext, shiftId: string): Promise<CashMovement[]>;
  getShifts(context: RequestContext): Promise<Shift[]>;
  getClients(context: Pick<RequestContext, 'tenantId' | 'storeId'>): Promise<Client[]>;
  saveClient(
    context: Pick<RequestContext, 'tenantId' | 'storeId'>,
    client: Partial<Client>,
  ): Promise<Client>;
  deleteClient(
    context: Pick<RequestContext, 'tenantId' | 'storeId'>,
    clientId: string,
  ): Promise<void>;
  getSales(
    context: Pick<RequestContext, 'tenantId'> & Partial<Pick<RequestContext, 'storeId'>>,
  ): Promise<Sale[]>;
  getStockMovements(
    context: Pick<RequestContext, 'tenantId'> & Partial<Pick<RequestContext, 'storeId'>>,
  ): Promise<StockMovementView[]>;
  getAuditEvents(
    context: Pick<RequestContext, 'tenantId' | 'storeId'>,
    query?: AuditEventQuery,
  ): Promise<AuditEvent[]>;
}

const localContract: BackendContract = {
  ...localBackend,
  logout: async () => undefined,
};

// A production build must never fall back silently to browser-only demo data.
// The local backend is opt-in and is used only by the GitHub Pages demo.
const useApi = import.meta.env.VITE_BACKEND_MODE !== 'local';

export const BackendAPI: BackendContract = useApi ? remoteBackend : localContract;
