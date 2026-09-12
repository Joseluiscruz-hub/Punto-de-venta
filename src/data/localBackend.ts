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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function canOperateShift(state: DatabaseState, context: RequestContext, shift: Shift) {
  const user = state.users.find(
    (candidate) =>
      candidate.id === context.userId &&
      candidate.tenantId === context.tenantId &&
      candidate.storeId === context.storeId,
  );
  return shift.userId === context.userId || user?.role === 'ADMIN' || user?.role === 'MANAGER';
}

function assertCanOperateShift(state: DatabaseState, context: RequestContext, shift: Shift) {
  if (!canOperateShift(state, context, shift)) {
    throw new Error(
      'La caja está abierta por otro cajero. Solicita apoyo de un administrador o gerente.',
    );
  }
}

function isDatabaseState(value: unknown): value is DatabaseState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DatabaseState>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.tenants) &&
    Array.isArray(candidate.stores) &&
    Array.isArray(candidate.users) &&
    Array.isArray(candidate.products) &&
    Array.isArray(candidate.storeProducts) &&
    Array.isArray(candidate.sales) &&
    Array.isArray(candidate.saleItems) &&
    Array.isArray(candidate.movements) &&
    Array.isArray(candidate.shifts) &&
    Array.isArray(candidate.clients)
  );
}

function migrateLocalDatabase(database: DatabaseState) {
  let changed = false;
  if (!Array.isArray(database.cashMovements)) {
    database.cashMovements = [];
    changed = true;
  }
  if (!Array.isArray(database.returns)) {
    database.returns = [];
    changed = true;
  }
  if (!Array.isArray(database.returnItems)) {
    database.returnItems = [];
    changed = true;
  }
  for (const client of database.clients) {
    if (client.storeCredit === undefined) {
      client.storeCredit = 0;
      changed = true;
    }
  }
  for (const shift of database.shifts) {
    if (shift.refundsCash === undefined) {
      shift.refundsCash = 0;
      changed = true;
    }
    if (shift.cashIn === undefined) {
      shift.cashIn = 0;
      changed = true;
    }
    if (shift.differenceThreshold === undefined) {
      shift.differenceThreshold = 50;
      changed = true;
    }
    if (shift.salesCount === undefined) {
      shift.salesCount = 0;
      changed = true;
    }
  }
  for (const product of database.products) {
    const genericName = genericSeedProductNames.get(product.name);
    if (genericName) {
      product.name = genericName;
      changed = true;
    }
    if (demoProductBarcodes.has(product.barcode)) {
      product.active = false;
      changed = true;
    }
  }
  if (database.products.length === 0) {
    const tenantId = database.tenants[0]?.id ?? 't1';
    const storeIds = database.stores.map((store) => store.id);
    const catalog = buildAbarrotesSeed(tenantId, storeIds);
    database.products = catalog.products;
    database.storeProducts = catalog.storeProducts;
    changed = true;
  }
  return changed;
}

function defaultStorage(): StorageAdapter {
  if (typeof window === 'undefined') {
    const values = new Map<string, string>();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
  }
  return window.localStorage;
}

function normalizeProduct(
  input: CreateProductInput | UpdateProductInput,
): CreateProductInput | UpdateProductInput {
  const imageUrl = input.imageUrl?.trim();
  const product = {
    ...input,
    barcode: input.barcode.trim(),
    name: input.name.trim(),
    category: input.category.trim(),
    imageUrl: imageUrl || undefined,
  };

  if (!product.barcode || !product.name || !product.category) {
    throw new Error('Codigo, nombre y categoria son obligatorios');
  }

  if (
    product.imageUrl &&
    !/^https?:\/\/i.test(product.imageUrl) &&
    !product.imageUrl.startsWith('/')
  ) {
    throw new Error('La imagen debe ser una URL http(s) o una ruta local que empiece con /');
  }

  for (const [label, value] of [
    ['costo', product.cost],
    ['precio', product.price],
    ['existencia', product.stock],
    ['stock minimo', product.minStock],
  ] as const) {
    if (!Number.isFinite(value) || value < 0)
      throw new Error(`El ${label} debe ser un numero mayor o igual a cero`);
  }

  if (!Number.isInteger(product.stock) || !Number.isInteger(product.minStock)) {
    throw new Error('La existencia y el stock minimo deben ser numeros enteros');
  }

  return product;
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function createLocalBackend(options: LocalBackendOptions = {}) {
  const storage = options.storage ?? defaultStorage();
  const latencyMs = options.latencyMs ?? 80;
  const now = options.now ?? (() => new Date());
  const createId =
    options.createId ??
    ((prefix: string) => {
      const value =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return `${prefix}-${value}`;
    });

  const load = (): DatabaseState => {
    const raw = storage.getItem(DATABASE_KEY);
    if (!raw) {
      const seeded = seedDatabase();
      storage.setItem(DATABASE_KEY, JSON.stringify(seeded));
      return seeded;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (isDatabaseState(parsed)) {
        if (migrateLocalDatabase(parsed)) {
          storage.setItem(DATABASE_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    } catch {
      // A damaged local database is replaced with a known-good seed.
    }

    const seeded = seedDatabase();
    storage.setItem(DATABASE_KEY, JSON.stringify(seeded));
    return seeded;
  };

  let database = load();
  const wait = () =>
    latencyMs > 0
      ? new Promise<void>((resolve) => setTimeout(resolve, latencyMs))
      : Promise.resolve();
  const persist = (next: DatabaseState) => {
    storage.setItem(DATABASE_KEY, JSON.stringify(next));
    database = next;
  };
  const transaction = <T>(operation: (draft: DatabaseState) => T): T => {
    const draft = clone(database);
    const result = operation(draft);
    persist(draft);
    return clone(result);
  };
  const productView = (
    db: DatabaseState,
    context: RequestContext,
    product: Product,
  ): ProductView => {
    const inventory = db.storeProducts.find(
      (item) =>
        item.productId === product.id &&
        item.storeId === context.storeId &&
        item.tenantId === context.tenantId,
    );
    return { ...product, stock: inventory?.stock ?? 0, minStock: inventory?.minStock ?? 0 };
  };
  const saleWithItems = (db: DatabaseState, sale: Sale): Sale => {
    const items = db.saleItems
      .filter((item) => item.saleId === sale.id)
      .map((item) => ({
        ...item,
        name: db.products.find((product) => product.id === item.productId)?.name ?? 'Desconocido',
        returnedQuantity: db.returnItems
          .filter((returned) => returned.saleItemId === item.id)
          .reduce((sum, returned) => sum + returned.quantity, 0),
      }));
    const returnedTotal = roundMoney(
      db.returns
        .filter((saleReturn) => saleReturn.saleId === sale.id)
        .reduce((sum, saleReturn) => sum + saleReturn.total, 0),
    );
    return {
      ...sale,
      items,
      returnedTotal,
      returnStatus:
        returnedTotal === 0
          ? 'NONE'
          : items.every((item) => item.returnedQuantity >= item.quantity)
            ? 'FULL'
            : 'PARTIAL',
    };
  };

  return {
    async login(username: string, pin: string): Promise<LoginResponse> {
      await wait();
      const normalizedUsername = username.trim().toLowerCase();
      const user = database.users.find(
        (item) => item.username.toLowerCase() === normalizedUsername,
      );
      if (!user || credentials[user.username] !== pin) throw new Error('Credenciales invalidas');

      const tenant = database.tenants.find((item) => item.id === user.tenantId);
      const store = database.stores.find((item) => item.id === user.storeId);
      if (!tenant || !store) throw new Error('La cuenta no tiene una empresa o sucursal valida');

      return clone({ user, tenant, store, token: createId('session') });
    },

    async deleteProduct(context: RequestContext, productId: string): Promise<void> {
      await wait();
      transaction((draft) => {
        const product = draft.products.find(
          (item) => item.id === productId && item.tenantId === context.tenantId,
        );
        if (!product) throw new Error('Producto no encontrado');
        const hasSales = draft.saleItems.some((item) => item.productId === productId);
        if (hasSales) throw new Error('No se puede eliminar un producto con historial de ventas');
        draft.products = draft.products.filter((item) => item.id !== productId);
        draft.storeProducts = draft.storeProducts.filter((item) => item.productId !== productId);
        draft.movements = draft.movements.filter((item) => item.productId !== productId);
