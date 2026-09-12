import type {
  AuditEvent,
  AuditEventQuery,
  CashMovement,
  Client,
  CreateCashMovementInput,
  CreateProductInput,
  LoginResponse,
  ProcessSaleInput,
  Product,
  ProductView,
  RequestContext,
  ReturnSaleInput,
  ReturnSaleResult,
  Sale,
  SaleItem,
  SaleReturn,
  SaleReturnItem,
  Shift,
  StockMovement,
  StockMovementView,
  Store,
  StoreProduct,
  Tenant,
  UpdateProductInput,
  User,
} from '../models/types';
import { buildAbarrotesSeed } from './abarrotesCatalog';

const DATABASE_KEY = 'el-triunfo.database.v1';

interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface DatabaseState {
  version: 1;
  tenants: Tenant[];
  stores: Store[];
  users: User[];
  products: Product[];
  storeProducts: StoreProduct[];
  sales: Sale[];
  saleItems: SaleItem[];
  returns: SaleReturn[];
  returnItems: SaleReturnItem[];
  movements: StockMovement[];
  cashMovements: CashMovement[];
  shifts: Shift[];
  clients: Client[];
}

interface LocalBackendOptions {
  storage?: StorageAdapter;
  latencyMs?: number;
  now?: () => Date;
  createId?: (prefix: string) => string;
}

const credentials: Record<string, string> = {
  admin: '1234',
  caja1: '0000',
};

const genericSeedProductNames = new Map([
  ['Leche Entera Alpura 1L', 'Leche entera 1L'],
  ['Pan Bimbo Blanco', 'Pan blanco 680g'],
  ['Coca-Cola 600ml', 'Refresco cola 600ml'],
]);
const demoProductBarcodes = new Set(['75010001', '75010002', '75010003']);

function seedDatabase(): DatabaseState {
  const stores = [
    { id: 's1', tenantId: 't1', name: 'Sucursal Principal', address: 'Centro' },
    { id: 's2', tenantId: 't1', name: 'Sucursal Norte', address: 'Norte' },
  ];
  const catalog = buildAbarrotesSeed(
    't1',
    stores.map((store) => store.id),
  );
  return {
    version: 1,
    tenants: [{ id: 't1', name: 'El Triunfo', plan: 'PREMIUM' }],
    stores,
    users: [
      {
        id: 'u1',
        tenantId: 't1',
        storeId: 's1',
        username: 'admin',
        name: 'Administrador',
        role: 'ADMIN',
      },
      {
        id: 'u2',
        tenantId: 't1',
        storeId: 's1',
        username: 'caja1',
        name: 'Cajero Principal',
        role: 'CASHIER',
      },
    ],
    products: catalog.products,
    storeProducts: catalog.storeProducts,
    sales: [],
    saleItems: [],
    returns: [],
    returnItems: [],
    movements: [],
    cashMovements: [],
    shifts: [],
    clients: [
      {
        id: 'c1',
        tenantId: 't1',
        name: 'Publico General',
        points: 0,
        storeCredit: 0,
        totalSpent: 0,
      },
      {
        id: 'c2',
        tenantId: 't1',
        name: 'Juan Cliente Especial',
        email: 'juan@mail.com',
        points: 150,
        storeCredit: 0,
        totalSpent: 1250,
      },
    ],
  };
}

function clone&lt;T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// TRUNCATED_TEST - if this lands, full push needed
export const BackendAPI = createLocalBackend();
