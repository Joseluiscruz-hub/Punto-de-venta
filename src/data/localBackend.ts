import type {
  Client,
  CreateProductInput,
  LoginResponse,
  ProcessSaleInput,
  Product,
  ProductView,
  RequestContext,
  Sale,
  SaleItem,
  Shift,
  StockMovement,
  StockMovementView,
  Store,
  StoreProduct,
  Tenant,
  UpdateProductInput,
  User,
} from '../models/types';

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
  movements: StockMovement[];
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

function seedDatabase(): DatabaseState {
  return {
    version: 1,
    tenants: [{ id: 't1', name: 'El Triunfo', plan: 'PREMIUM' }],
    stores: [
      { id: 's1', tenantId: 't1', name: 'Sucursal Principal', address: 'Centro' },
      { id: 's2', tenantId: 't1', name: 'Sucursal Norte', address: 'Norte' },
    ],
    users: [
      { id: 'u1', tenantId: 't1', storeId: 's1', username: 'admin', name: 'Administrador', role: 'ADMIN' },
      { id: 'u2', tenantId: 't1', storeId: 's1', username: 'caja1', name: 'Cajero Principal', role: 'CASHIER' },
    ],
    products: [
      { id: 'p1', tenantId: 't1', barcode: '75010001', name: 'Leche Entera Alpura 1L', category: 'Lacteos', cost: 18.5, price: 25 },
      { id: 'p2', tenantId: 't1', barcode: '75010002', name: 'Pan Bimbo Blanco', category: 'Panaderia', cost: 30, price: 42 },
      { id: 'p3', tenantId: 't1', barcode: '75010003', name: 'Coca-Cola 600ml', category: 'Bebidas', cost: 11, price: 18 },
    ],
    storeProducts: [
      { id: 'sp1', tenantId: 't1', storeId: 's1', productId: 'p1', stock: 45, minStock: 10 },
      { id: 'sp2', tenantId: 't1', storeId: 's1', productId: 'p2', stock: 12, minStock: 15 },
      { id: 'sp3', tenantId: 't1', storeId: 's1', productId: 'p3', stock: 120, minStock: 24 },
    ],
    sales: [],
    saleItems: [],
    movements: [],
    shifts: [],
    clients: [
      { id: 'c1', tenantId: 't1', name: 'Publico General', points: 0, totalSpent: 0 },
      { id: 'c2', tenantId: 't1', name: 'Juan Cliente Especial', email: 'juan@mail.com', points: 150, totalSpent: 1250 },
    ],
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isDatabaseState(value: unknown): value is DatabaseState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DatabaseState>;
  return candidate.version === 1
    && Array.isArray(candidate.tenants)
    && Array.isArray(candidate.stores)
    && Array.isArray(candidate.users)
    && Array.isArray(candidate.products)
    && Array.isArray(candidate.storeProducts)
    && Array.isArray(candidate.sales)
    && Array.isArray(candidate.saleItems)
    && Array.isArray(candidate.movements)
    && Array.isArray(candidate.shifts)
    && Array.isArray(candidate.clients);
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

function normalizeProduct(input: CreateProductInput | UpdateProductInput): CreateProductInput | UpdateProductInput {
  const product = {
    ...input,
    barcode: input.barcode.trim(),
    name: input.name.trim(),
    category: input.category.trim(),
  };

  if (!product.barcode || !product.name || !product.category) {
    throw new Error('Codigo, nombre y categoria son obligatorios');
  }

  for (const [label, value] of [
    ['costo', product.cost],
    ['precio', product.price],
    ['existencia', product.stock],
    ['stock minimo', product.minStock],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`El ${label} debe ser un numero mayor o igual a cero`);
  }

  if (!Number.isInteger(product.stock) || !Number.isInteger(product.minStock)) {
    throw new Error('La existencia y el stock minimo deben ser numeros enteros');
  }

  return product;
}

export function createLocalBackend(options: LocalBackendOptions = {}) {
  const storage = options.storage ?? defaultStorage();
  const latencyMs = options.latencyMs ?? 80;
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? ((prefix: string) => {
    const value = typeof crypto !== 'undefined' && 'randomUUID' in crypto
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
      if (isDatabaseState(parsed)) return parsed;
    } catch {
      // A damaged local database is replaced with a known-good seed.
    }

    const seeded = seedDatabase();
    storage.setItem(DATABASE_KEY, JSON.stringify(seeded));
    return seeded;
  };

  let database = load();
  const wait = () => latencyMs > 0 ? new Promise<void>((resolve) => setTimeout(resolve, latencyMs)) : Promise.resolve();
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
  const productView = (db: DatabaseState, context: RequestContext, product: Product): ProductView => {
    const inventory = db.storeProducts.find((item) => item.productId === product.id
      && item.storeId === context.storeId
      && item.tenantId === context.tenantId);
    return { ...product, stock: inventory?.stock ?? 0, minStock: inventory?.minStock ?? 0 };
  };
  const saleWithItems = (db: DatabaseState, sale: Sale): Sale => ({
    ...sale,
    items: db.saleItems.filter((item) => item.saleId === sale.id).map((item) => ({
      ...item,
      name: db.products.find((product) => product.id === item.productId)?.name ?? 'Desconocido',
    })),
  });

  return {
    async login(username: string, pin: string): Promise<LoginResponse> {
      await wait();
      const normalizedUsername = username.trim().toLowerCase();
      const user = database.users.find((item) => item.username.toLowerCase() === normalizedUsername);
      if (!user || credentials[user.username] !== pin) throw new Error('Credenciales invalidas');

      const tenant = database.tenants.find((item) => item.id === user.tenantId);
      const store = database.stores.find((item) => item.id === user.storeId);
      if (!tenant || !store) throw new Error('La cuenta no tiene una empresa o sucursal valida');

      return clone({ user, tenant, store, token: createId('session') });
    },

    async deleteProduct(context: RequestContext, productId: string): Promise<void> {
      await wait();
      transaction((draft) => {
        const product = draft.products.find((item) => item.id === productId && item.tenantId === context.tenantId);
        if (!product) throw new Error('Producto no encontrado');
        const hasSales = draft.saleItems.some((item) => item.productId === productId);
        if (hasSales) throw new Error('No se puede eliminar un producto con historial de ventas');
        draft.products = draft.products.filter((item) => item.id !== productId);
        draft.storeProducts = draft.storeProducts.filter((item) => item.productId !== productId);
        draft.movements = draft.movements.filter((item) => item.productId !== productId);
      });
    },

    async getStoreProducts(context: RequestContext): Promise<ProductView[]> {
      await wait();
      return clone(database.products
        .filter((product) => product.tenantId === context.tenantId)
        .map((product) => productView(database, context, product)));
    },

    async saveProduct(context: RequestContext, input: CreateProductInput | UpdateProductInput): Promise<ProductView> {
      await wait();
      const productData = normalizeProduct(input);
      return transaction((draft) => {
        const productId = 'id' in productData ? productData.id : undefined;
        const duplicate = draft.products.find((item) => item.tenantId === context.tenantId
          && item.barcode === productData.barcode
          && item.id !== productId);
        if (duplicate) throw new Error(`Ya existe un producto con el codigo ${productData.barcode}`);

        if (!productId) {
          const product: Product = {
            id: createId('product'),
            tenantId: context.tenantId,
            barcode: productData.barcode,
            name: productData.name,
            category: productData.category,
            cost: productData.cost,
            price: productData.price,
          };
          const inventory: StoreProduct = {
            id: createId('inventory'),
            tenantId: context.tenantId,
            storeId: context.storeId,
            productId: product.id,
            stock: productData.stock,
            minStock: productData.minStock,
          };
          draft.products.push(product);
          draft.storeProducts.push(inventory);
          if (inventory.stock > 0) {
            draft.movements.push({
              id: createId('movement'),
              tenantId: context.tenantId,
              storeId: context.storeId,
              productId: product.id,
              userId: context.userId,
              type: 'PURCHASE',
              quantity: inventory.stock,
              date: now().toISOString(),
              reason: 'Inventario inicial',
            });
          }
          return { ...product, stock: inventory.stock, minStock: inventory.minStock };
        }

        const productIndex = draft.products.findIndex((item) => item.id === productId && item.tenantId === context.tenantId);
        if (productIndex < 0) throw new Error('Producto no encontrado');
        draft.products[productIndex] = {
          ...draft.products[productIndex],
          barcode: productData.barcode,
          name: productData.name,
          category: productData.category,
          cost: productData.cost,
          price: productData.price,
        };

        let inventory = draft.storeProducts.find((item) => item.productId === productId
          && item.storeId === context.storeId
          && item.tenantId === context.tenantId);
        if (!inventory) {
          inventory = {
            id: createId('inventory'),
            tenantId: context.tenantId,
            storeId: context.storeId,
            productId,
            stock: 0,
            minStock: 0,
          };
          draft.storeProducts.push(inventory);
        }

        const adjustment = productData.stock - inventory.stock;
        inventory.stock = productData.stock;
        inventory.minStock = productData.minStock;
        if (adjustment !== 0) {
          draft.movements.push({
            id: createId('movement'),
            tenantId: context.tenantId,
            storeId: context.storeId,
            productId,
            userId: context.userId,
            type: 'ADJUSTMENT',
            quantity: adjustment,
            date: now().toISOString(),
            reason: 'Ajuste manual',
          });
        }

        return { ...draft.products[productIndex], stock: inventory.stock, minStock: inventory.minStock };
      });
    },

    async saveProductsBulk(context: RequestContext, products: CreateProductInput[]): Promise<void> {
      for (const product of products) await this.saveProduct(context, product);
    },

    async processSale(context: RequestContext, input: ProcessSaleInput): Promise<Sale> {
      await wait();
      if (input.items.length === 0) throw new Error('La venta debe incluir al menos un producto');

      const existing = input.externalId
        ? database.sales.find((sale) => sale.externalId === input.externalId && sale.tenantId === context.tenantId)
        : undefined;
      if (existing) return clone(saleWithItems(database, existing));

      return transaction((draft) => {
        const lines = input.items.map((requested) => {
          if (!Number.isInteger(requested.quantity) || requested.quantity <= 0) {
            throw new Error(`La cantidad de ${requested.name} no es valida`);
          }
          const product = draft.products.find((item) => item.id === requested.id && item.tenantId === context.tenantId);
          const inventory = draft.storeProducts.find((item) => item.productId === requested.id
            && item.storeId === context.storeId
            && item.tenantId === context.tenantId);
          if (!product || !inventory) throw new Error(`El producto ${requested.name} ya no esta disponible`);
          if (inventory.stock < requested.quantity) throw new Error(`Stock insuficiente para ${product.name}`);
          return { product, inventory, quantity: requested.quantity };
        });

        const total = lines.reduce((sum, line) => sum + line.quantity * line.product.price, 0);
        if (!Number.isFinite(input.amountTendered) || input.amountTendered < 0) throw new Error('El importe recibido no es valido');
        if (input.paymentMethod === 'CASH' && input.amountTendered < total) throw new Error('El efectivo recibido es menor al total');

        const sale: Sale = {
          id: createId('sale'),
          externalId: input.externalId,
          tenantId: context.tenantId,
          storeId: context.storeId,
          cashierId: context.userId,
          clientId: input.clientId,
          datetime: input.offlineDate ?? now().toISOString(),
          total,
          paymentMethod: input.paymentMethod,
          amountTendered: input.amountTendered,
          changeAmount: input.paymentMethod === 'CASH' ? input.amountTendered - total : 0,
          itemsCount: lines.reduce((sum, line) => sum + line.quantity, 0),
        };
        draft.sales.push(sale);

        for (const line of lines) {
          line.inventory.stock -= line.quantity;
          draft.saleItems.push({
            id: createId('sale-item'),
            saleId: sale.id,
            productId: line.product.id,
            quantity: line.quantity,
            price: line.product.price,
            cost: line.product.cost,
            subtotal: line.product.price * line.quantity,
          });
          draft.movements.push({
            id: createId('movement'),
            tenantId: context.tenantId,
            storeId: context.storeId,
            productId: line.product.id,
            userId: context.userId,
            type: 'SALE',
            quantity: -line.quantity,
            date: sale.datetime,
            reason: `Venta ${sale.id}`,
          });
        }

        if (input.clientId) {
          const client = draft.clients.find((item) => item.id === input.clientId && item.tenantId === context.tenantId);
          if (!client) throw new Error('Cliente no encontrado');
          client.points += Math.floor(total * 0.01);
          client.totalSpent += total;
          client.lastVisit = sale.datetime;
        }

        const shift = draft.shifts.find((item) => item.status === 'OPEN'
          && item.userId === context.userId
          && item.storeId === context.storeId);
        if (shift) {
          if (input.paymentMethod === 'CASH') {
            shift.salesCash += total;
            shift.expectedCash += total;
          } else {
            shift.salesCard += total;
          }
        }

        return saleWithItems(draft, sale);
      });
    },

    async getActiveShift(context: RequestContext): Promise<Shift | null> {
      await wait();
      return clone(database.shifts.find((shift) => shift.status === 'OPEN'
        && shift.userId === context.userId
        && shift.storeId === context.storeId) ?? null);
    },

    async openShift(context: RequestContext, initialCash: number): Promise<Shift> {
      await wait();
      if (!Number.isFinite(initialCash) || initialCash < 0) throw new Error('El fondo inicial no es valido');
      return transaction((draft) => {
        const existing = draft.shifts.find((shift) => shift.status === 'OPEN'
          && shift.userId === context.userId
          && shift.storeId === context.storeId);
        if (existing) throw new Error('Ya existe un turno abierto para este usuario');
        const shift: Shift = {
          id: createId('shift'),
          tenantId: context.tenantId,
          storeId: context.storeId,
          userId: context.userId,
          startTime: now().toISOString(),
          initialCash,
          expectedCash: initialCash,
          status: 'OPEN',
          salesCash: 0,
          salesCard: 0,
          cashOut: 0,
        };
        draft.shifts.push(shift);
        return shift;
      });
    },

    async closeShift(context: RequestContext, actualCash: number): Promise<Shift> {
      await wait();
      if (!Number.isFinite(actualCash) || actualCash < 0) throw new Error('El efectivo contado no es valido');
      return transaction((draft) => {
        const shift = draft.shifts.find((item) => item.status === 'OPEN'
          && item.userId === context.userId
          && item.storeId === context.storeId);
        if (!shift) throw new Error('No hay un turno activo para cerrar');
        shift.status = 'CLOSED';
        shift.endTime = now().toISOString();
        shift.actualCash = actualCash;
        shift.difference = actualCash - shift.expectedCash;
        return shift;
      });
    },

    async getShifts(context: RequestContext): Promise<Shift[]> {
      await wait();
      return clone(database.shifts
        .filter((shift) => shift.tenantId === context.tenantId && shift.storeId === context.storeId)
        .sort((a, b) => b.startTime.localeCompare(a.startTime)));
    },

    async getClients(context: Pick<RequestContext, 'tenantId'>): Promise<Client[]> {
      await wait();
      return clone(database.clients.filter((client) => client.tenantId === context.tenantId));
    },

    async saveClient(context: Pick<RequestContext, 'tenantId'>, input: Partial<Client>): Promise<Client> {
      await wait();
      const name = input.name?.trim();
      if (!name) throw new Error('El nombre del cliente es obligatorio');
      return transaction((draft) => {
        if (input.id) {
          const client = draft.clients.find((item) => item.id === input.id && item.tenantId === context.tenantId);
          if (!client) throw new Error('Cliente no encontrado');
          Object.assign(client, {
            name,
            email: input.email?.trim() || undefined,
            phone: input.phone?.trim() || undefined,
            taxId: input.taxId?.trim() || undefined,
          });
          return client;
        }
        const client: Client = {
          id: createId('client'),
          tenantId: context.tenantId,
          name,
          email: input.email?.trim() || undefined,
          phone: input.phone?.trim() || undefined,
          taxId: input.taxId?.trim() || undefined,
          points: 0,
          totalSpent: 0,
        };
        draft.clients.push(client);
        return client;
      });
    },

    async deleteClient(context: Pick<RequestContext, 'tenantId'>, clientId: string): Promise<void> {
      await wait();
      transaction((draft) => {
        if (draft.sales.some((sale) => sale.clientId === clientId)) {
          throw new Error('No se puede eliminar un cliente con historial de ventas');
        }
        const count = draft.clients.length;
        draft.clients = draft.clients.filter((client) => !(client.id === clientId && client.tenantId === context.tenantId));
        if (draft.clients.length === count) throw new Error('Cliente no encontrado');
      });
    },

    async getSales(context: Pick<RequestContext, 'tenantId'> & Partial<Pick<RequestContext, 'storeId'>>): Promise<Sale[]> {
      await wait();
      return clone(database.sales
        .filter((sale) => sale.tenantId === context.tenantId && (!context.storeId || sale.storeId === context.storeId))
        .sort((a, b) => b.datetime.localeCompare(a.datetime))
        .map((sale) => saleWithItems(database, sale)));
    },

    async getStockMovements(context: Pick<RequestContext, 'tenantId'> & Partial<Pick<RequestContext, 'storeId'>>): Promise<StockMovementView[]> {
      await wait();
      return clone(database.movements
        .filter((movement) => movement.tenantId === context.tenantId
          && (!context.storeId || movement.storeId === context.storeId))
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((movement) => ({
          ...movement,
          productName: database.products.find((product) => product.id === movement.productId)?.name ?? 'N/A',
          userName: database.users.find((user) => user.id === movement.userId)?.name ?? 'N/A',
        })));
    },
  };
}

export const BackendAPI = createLocalBackend();
