import type {
  Client,
  CreateProductInput,
  LoginResponse,
  ProcessSaleInput,
  ProductView,
  RequestContext,
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
  saveProduct(context: RequestContext, product: CreateProductInput | UpdateProductInput): Promise<ProductView>;
  saveProductsBulk(context: RequestContext, products: CreateProductInput[]): Promise<void>;
  processSale(context: RequestContext, sale: ProcessSaleInput): Promise<Sale>;
  getActiveShift(context: RequestContext): Promise<Shift | null>;
  openShift(context: RequestContext, initialCash: number): Promise<Shift>;
  closeShift(context: RequestContext, actualCash: number): Promise<Shift>;
  getShifts(context: RequestContext): Promise<Shift[]>;
  getClients(context: Pick<RequestContext, 'tenantId' | 'storeId'>): Promise<Client[]>;
  saveClient(context: Pick<RequestContext, 'tenantId' | 'storeId'>, client: Partial<Client>): Promise<Client>;
  deleteClient(context: Pick<RequestContext, 'tenantId' | 'storeId'>, clientId: string): Promise<void>;
  getSales(context: Pick<RequestContext, 'tenantId'> & Partial<Pick<RequestContext, 'storeId'>>): Promise<Sale[]>;
  getStockMovements(context: Pick<RequestContext, 'tenantId'> & Partial<Pick<RequestContext, 'storeId'>>): Promise<StockMovementView[]>;
}

const localContract: BackendContract = {
  ...localBackend,
  logout: async () => undefined,
};

const useApi = import.meta.env.VITE_BACKEND_MODE === 'api'
  || (import.meta.env.VITE_BACKEND_MODE !== 'local' && import.meta.env.DEV);

export const BackendAPI: BackendContract = useApi ? remoteBackend : localContract;
