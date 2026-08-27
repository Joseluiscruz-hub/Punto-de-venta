import type {
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
  return {
    version: 1,
    tenants: [{ id: 't1', name: 'El Triunfo', plan: 'PREMIUM' }],
    stores: [
      { id: 's1', tenantId: 't1', name: 'Sucursal Principal', address: 'Centro' },
      { id: 's2', tenantId: 't1', name: 'Sucursal Norte', address: 'Norte' },
    ],
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
    products: [],
    storeProducts: [],
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
    !/^https?:\/\//i.test(product.imageUrl) &&
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
      });
    },

    async getStoreProducts(context: RequestContext): Promise<ProductView[]> {
      await wait();
      return clone(
        database.products
          .filter((product) => product.tenantId === context.tenantId && product.active !== false)
          .map((product) => productView(database, context, product)),
      );
    },

    async saveProduct(
      context: RequestContext,
      input: CreateProductInput | UpdateProductInput,
    ): Promise<ProductView> {
      await wait();
      const productData = normalizeProduct(input);
      return transaction((draft) => {
        const productId = 'id' in productData ? productData.id : undefined;
        const duplicate = draft.products.find(
          (item) =>
            item.tenantId === context.tenantId &&
            item.barcode === productData.barcode &&
            item.id !== productId,
        );
        if (duplicate)
          throw new Error(`Ya existe un producto con el codigo ${productData.barcode}`);

        if (!productId) {
          const product: Product = {
            id: createId('product'),
            tenantId: context.tenantId,
            barcode: productData.barcode,
            name: productData.name,
            category: productData.category,
            imageUrl: productData.imageUrl,
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

        const productIndex = draft.products.findIndex(
          (item) => item.id === productId && item.tenantId === context.tenantId,
        );
        if (productIndex < 0) throw new Error('Producto no encontrado');
        draft.products[productIndex] = {
          ...draft.products[productIndex],
          barcode: productData.barcode,
          name: productData.name,
          category: productData.category,
          imageUrl: productData.imageUrl,
          cost: productData.cost,
          price: productData.price,
        };

        let inventory = draft.storeProducts.find(
          (item) =>
            item.productId === productId &&
            item.storeId === context.storeId &&
            item.tenantId === context.tenantId,
        );
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

        if (!('expectedStock' in productData) || inventory.stock !== productData.expectedStock) {
          throw new Error(
            'La existencia cambio mientras editabas. Recarga el producto antes de ajustar el stock.',
          );
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

        return {
          ...draft.products[productIndex],
          stock: inventory.stock,
          minStock: inventory.minStock,
        };
      });
    },

    async saveProductsBulk(context: RequestContext, products: CreateProductInput[]): Promise<void> {
      await wait();
      const normalized = products.map((product) => normalizeProduct(product) as CreateProductInput);
      transaction((draft) => {
        const seen = new Set<string>();
        for (const productData of normalized) {
          if (seen.has(productData.barcode))
            throw new Error(`El archivo contiene codigos repetidos: ${productData.barcode}`);
          seen.add(productData.barcode);
          const duplicate = draft.products.find(
            (item) => item.tenantId === context.tenantId && item.barcode === productData.barcode,
          );
          if (duplicate)
            throw new Error(`Ya existe un producto con el codigo ${productData.barcode}`);
        }

        for (const productData of normalized) {
          const product: Product = {
            id: createId('product'),
            tenantId: context.tenantId,
            barcode: productData.barcode,
            name: productData.name,
            category: productData.category,
            imageUrl: productData.imageUrl,
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
              reason: 'Importacion inicial',
            });
          }
        }
      });
    },

    async processSale(context: RequestContext, input: ProcessSaleInput): Promise<Sale> {
      await wait();
      if (input.items.length === 0) throw new Error('La venta debe incluir al menos un producto');

      const existing = input.externalId
        ? database.sales.find(
            (sale) => sale.externalId === input.externalId && sale.tenantId === context.tenantId,
          )
        : undefined;
      if (existing) {
        const canReplay =
          existing.storeId === context.storeId &&
          (existing.cashierId === context.userId ||
            database.users.find((user) => user.id === context.userId)?.role === 'ADMIN' ||
            database.users.find((user) => user.id === context.userId)?.role === 'MANAGER');
        if (!canReplay)
          throw new Error('El identificador de la venta ya fue utilizado en otra operación');
        return clone(saleWithItems(database, existing));
      }

      return transaction((draft) => {
        const shift = draft.shifts.find(
          (item) =>
            item.status === 'OPEN' &&
            item.tenantId === context.tenantId &&
            item.storeId === context.storeId,
        );
        if (!shift) throw new Error('Debes abrir un turno antes de vender');
        assertCanOperateShift(draft, context, shift);

        const requestedItems = Array.from(
          input.items
            .reduce((items, item) => {
              const previous = items.get(item.id);
              items.set(item.id, {
                ...item,
                quantity: (previous?.quantity ?? 0) + item.quantity,
              });
              return items;
            }, new Map<string, ProcessSaleInput['items'][number]>())
            .values(),
        );
        const lines = requestedItems.map((requested) => {
          if (!Number.isInteger(requested.quantity) || requested.quantity <= 0) {
            throw new Error(`La cantidad de ${requested.name} no es valida`);
          }
          const product = draft.products.find(
            (item) => item.id === requested.id && item.tenantId === context.tenantId,
          );
          const inventory = draft.storeProducts.find(
            (item) =>
              item.productId === requested.id &&
              item.storeId === context.storeId &&
              item.tenantId === context.tenantId,
          );
          if (!product || !inventory)
            throw new Error(`El producto ${requested.name} ya no esta disponible`);
          if (inventory.stock < requested.quantity)
            throw new Error(`Stock insuficiente para ${product.name}`);
          return { product, inventory, quantity: requested.quantity };
        });

        const total = lines.reduce((sum, line) => sum + line.quantity * line.product.price, 0);
        if (!Number.isFinite(input.amountTendered) || input.amountTendered < 0)
          throw new Error('El importe recibido no es valido');
        if (input.paymentMethod === 'CASH' && input.amountTendered < total)
          throw new Error('El efectivo recibido es menor al total');
        if (
          input.paymentMethod === 'MIXED' &&
          (input.amountTendered <= 0 || input.amountTendered >= total)
        )
          throw new Error('El pago mixto requiere una parte en efectivo menor al total');

        const cashPortion =
          input.paymentMethod === 'CASH'
            ? total
            : input.paymentMethod === 'MIXED'
              ? input.amountTendered
              : 0;
        const electronicPortion = total - cashPortion;

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
          returnedTotal: 0,
          returnStatus: 'NONE',
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
          const client = draft.clients.find(
            (item) => item.id === input.clientId && item.tenantId === context.tenantId,
          );
          if (!client) throw new Error('Cliente no encontrado');
          client.points += Math.floor(total * 0.01);
          client.totalSpent += total;
          client.lastVisit = sale.datetime;
        }

        if (cashPortion > 0) {
          shift.salesCash += cashPortion;
          shift.expectedCash += cashPortion;
        }
        if (electronicPortion > 0) {
          shift.salesCard += electronicPortion;
        }

        return saleWithItems(draft, sale);
      });
    },

    async returnSale(
      context: RequestContext,
      saleId: string,
      input: ReturnSaleInput,
    ): Promise<ReturnSaleResult> {
      await wait();
      if (!input.reason.trim()) throw new Error('El motivo de la devolucion es obligatorio');
      if (input.items.length === 0)
        throw new Error('Selecciona al menos un articulo para devolver');

      return transaction((draft) => {
        const sale = draft.sales.find(
          (item) =>
            item.id === saleId &&
            item.tenantId === context.tenantId &&
            item.storeId === context.storeId,
        );
        if (!sale) throw new Error('Venta no encontrada');

        const shift = draft.shifts.find(
          (item) =>
            item.status === 'OPEN' &&
            item.tenantId === context.tenantId &&
            item.storeId === context.storeId,
        );
        if (!shift) throw new Error('Debes abrir un turno antes de registrar una devolucion');
        assertCanOperateShift(draft, context, shift);
        if (input.refundMethod === 'STORE_CREDIT' && !sale.clientId) {
          throw new Error('La venta debe tener un cliente para generar saldo a favor');
        }

        const seen = new Set<string>();
        const lines = input.items.map((requested) => {
          if (seen.has(requested.saleItemId))
            throw new Error('Hay articulos repetidos en la devolucion');
          seen.add(requested.saleItemId);
          if (!Number.isInteger(requested.quantity) || requested.quantity <= 0) {
            throw new Error('Las cantidades a devolver deben ser enteros positivos');
          }
          const saleItem = draft.saleItems.find(
            (item) => item.id === requested.saleItemId && item.saleId === sale.id,
          );
          if (!saleItem) throw new Error('Uno de los articulos no pertenece a la venta');
          const returnedQuantity = draft.returnItems
            .filter((item) => item.saleItemId === saleItem.id)
            .reduce((sum, item) => sum + item.quantity, 0);
          if (requested.quantity > saleItem.quantity - returnedQuantity) {
            throw new Error('La cantidad excede las unidades disponibles para devolucion');
          }
          const inventory = draft.storeProducts.find(
            (item) =>
              item.productId === saleItem.productId &&
              item.storeId === context.storeId &&
              item.tenantId === context.tenantId,
          );
          if (!inventory) throw new Error('No se encontro el inventario del producto devuelto');
          return { saleItem, inventory, quantity: requested.quantity };
        });

        const total = roundMoney(
          lines.reduce((sum, line) => sum + line.saleItem.price * line.quantity, 0),
        );
        const previousReturnedTotal = roundMoney(
          draft.returns
            .filter((saleReturn) => saleReturn.saleId === sale.id)
            .reduce((sum, saleReturn) => sum + saleReturn.total, 0),
        );
        const pointsToReverse =
          Math.floor((previousReturnedTotal + total) * 0.01) -
          Math.floor(previousReturnedTotal * 0.01);
        if (input.refundMethod === 'CASH' && shift.expectedCash < total) {
          throw new Error('El efectivo esperado del turno no cubre el reembolso');
        }

        const returnId = createId('return');
        const createdAt = now().toISOString();
        const saleReturn: SaleReturn = {
          id: returnId,
          tenantId: context.tenantId,
          storeId: context.storeId,
          saleId: sale.id,
          shiftId: shift.id,
          userId: context.userId,
          refundMethod: input.refundMethod,
          total,
          reason: input.reason.trim(),
          createdAt,
          items: [],
        };

        for (const line of lines) {
          const product = draft.products.find((item) => item.id === line.saleItem.productId);
          const subtotal = roundMoney(line.saleItem.price * line.quantity);
          const returnItem: SaleReturnItem = {
            id: createId('return-item'),
            returnId,
            saleItemId: line.saleItem.id,
            productId: line.saleItem.productId,
            name: product?.name ?? 'Desconocido',
            quantity: line.quantity,
            price: line.saleItem.price,
            subtotal,
          };
          saleReturn.items.push(returnItem);
          draft.returnItems.push(returnItem);
          line.inventory.stock += line.quantity;
          draft.movements.push({
            id: createId('movement'),
            tenantId: context.tenantId,
            storeId: context.storeId,
            productId: line.saleItem.productId,
            userId: context.userId,
            type: 'RETURN',
            quantity: line.quantity,
            date: createdAt,
            reason: `Devolucion ${returnId}: ${saleReturn.reason}`,
          });
        }
        draft.returns.push(saleReturn);

        if (input.refundMethod === 'CASH') {
          shift.expectedCash = roundMoney(shift.expectedCash - total);
          shift.refundsCash = roundMoney(shift.refundsCash + total);
        }

        if (sale.clientId) {
          const client = draft.clients.find((item) => item.id === sale.clientId);
          if (client) {
            client.totalSpent = Math.max(0, roundMoney(client.totalSpent - total));
            client.points = Math.max(0, client.points - pointsToReverse);
            if (input.refundMethod === 'STORE_CREDIT') {
              client.storeCredit = roundMoney(client.storeCredit + total);
            }
          }
        }

        return { sale: saleWithItems(draft, sale), saleReturn };
      });
    },

    async getActiveShift(context: RequestContext): Promise<Shift | null> {
      await wait();
      const shift = database.shifts.find(
        (candidate) =>
          candidate.status === 'OPEN' &&
          candidate.tenantId === context.tenantId &&
          candidate.storeId === context.storeId,
      );
      if (!shift) return null;
      assertCanOperateShift(database, context, shift);
      return clone(shift);
    },

    async openShift(context: RequestContext, initialCash: number): Promise<Shift> {
      await wait();
      if (!Number.isFinite(initialCash) || initialCash < 0)
        throw new Error('El fondo inicial no es valido');
      return transaction((draft) => {
        const existing = draft.shifts.find(
          (shift) =>
            shift.status === 'OPEN' &&
            shift.tenantId === context.tenantId &&
            shift.storeId === context.storeId,
        );
        if (existing) throw new Error('La caja ya tiene un turno abierto');
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
          refundsCash: 0,
          cashIn: 0,
          cashOut: 0,
          differenceThreshold: 50,
        };
        draft.shifts.push(shift);
        return shift;
      });
    },

    async closeShift(context: RequestContext, actualCash: number): Promise<Shift> {
      await wait();
      if (!Number.isFinite(actualCash) || actualCash < 0)
        throw new Error('El efectivo contado no es valido');
      return transaction((draft) => {
        const shift = draft.shifts.find(
          (item) =>
            item.status === 'OPEN' &&
            item.tenantId === context.tenantId &&
            item.storeId === context.storeId,
        );
        if (!shift) throw new Error('No hay un turno activo para cerrar');
        assertCanOperateShift(draft, context, shift);
        shift.status = 'CLOSED';
        shift.endTime = now().toISOString();
        shift.actualCash = actualCash;
        shift.difference = actualCash - shift.expectedCash;
        return shift;
      });
    },

    async addCashMovement(
      context: RequestContext,
      shiftId: string,
      input: CreateCashMovementInput,
    ): Promise<CashMovement> {
      await wait();
      const reason = input.reason.trim();
      if (!input.externalId.trim())
        throw new Error('El identificador del movimiento es obligatorio');
      if (!Number.isFinite(input.amount) || input.amount <= 0)
        throw new Error('El monto debe ser mayor a cero');
      if (roundMoney(input.amount) !== input.amount)
        throw new Error('El monto admite como máximo dos decimales');
      if (reason.length < 3) throw new Error('Describe el motivo del movimiento');
      return transaction((draft) => {
        const duplicate = draft.cashMovements.find(
          (movement) =>
            movement.tenantId === context.tenantId && movement.externalId === input.externalId,
        );
        if (duplicate) {
          const canReplay =
            duplicate.storeId === context.storeId &&
            duplicate.shiftId === shiftId &&
            (duplicate.userId === context.userId ||
              draft.users.find((user) => user.id === context.userId)?.role === 'ADMIN' ||
              draft.users.find((user) => user.id === context.userId)?.role === 'MANAGER');
          if (!canReplay)
            throw new Error('El identificador del movimiento ya fue utilizado en otra operación');
          return duplicate;
        }
        const shift = draft.shifts.find(
          (item) =>
            item.id === shiftId &&
            item.status === 'OPEN' &&
            item.tenantId === context.tenantId &&
            item.storeId === context.storeId,
        );
        if (!shift) throw new Error('No hay un turno activo para registrar el movimiento');
        assertCanOperateShift(draft, context, shift);
        if (input.type === 'CASH_OUT' && input.amount > shift.expectedCash) {
          throw new Error('El retiro no puede ser mayor al efectivo esperado en caja');
        }
        const movement: CashMovement = {
          id: createId('cash-movement'),
          externalId: input.externalId,
          tenantId: context.tenantId,
          storeId: context.storeId,
          shiftId,
          userId: context.userId,
          type: input.type,
          amount: roundMoney(input.amount),
          reason,
          createdAt: now().toISOString(),
        };
        draft.cashMovements.push(movement);
        if (movement.type === 'CASH_IN') {
          shift.cashIn = roundMoney(shift.cashIn + movement.amount);
          shift.expectedCash = roundMoney(shift.expectedCash + movement.amount);
        } else {
          shift.cashOut = roundMoney(shift.cashOut + movement.amount);
          shift.expectedCash = roundMoney(shift.expectedCash - movement.amount);
        }
        return movement;
      });
    },

    async getCashMovements(context: RequestContext, shiftId: string): Promise<CashMovement[]> {
      await wait();
      return clone(
        database.cashMovements
          .filter(
            (movement) =>
              movement.tenantId === context.tenantId &&
              movement.storeId === context.storeId &&
              movement.shiftId === shiftId,
          )
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },

    async getShifts(context: RequestContext): Promise<Shift[]> {
      await wait();
      return clone(
        database.shifts
          .filter(
            (shift) => shift.tenantId === context.tenantId && shift.storeId === context.storeId,
          )
          .sort((a, b) => b.startTime.localeCompare(a.startTime)),
      );
    },

    async getClients(context: Pick<RequestContext, 'tenantId'>): Promise<Client[]> {
      await wait();
      return clone(database.clients.filter((client) => client.tenantId === context.tenantId));
    },

    async saveClient(
      context: Pick<RequestContext, 'tenantId'>,
      input: Partial<Client>,
    ): Promise<Client> {
      await wait();
      const name = input.name?.trim();
      if (!name) throw new Error('El nombre del cliente es obligatorio');
      return transaction((draft) => {
        if (input.id) {
          const client = draft.clients.find(
            (item) => item.id === input.id && item.tenantId === context.tenantId,
          );
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
          storeCredit: 0,
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
        draft.clients = draft.clients.filter(
          (client) => !(client.id === clientId && client.tenantId === context.tenantId),
        );
        if (draft.clients.length === count) throw new Error('Cliente no encontrado');
      });
    },

    async getSales(
      context: Pick<RequestContext, 'tenantId'> & Partial<Pick<RequestContext, 'storeId'>>,
    ): Promise<Sale[]> {
      await wait();
      return clone(
        database.sales
          .filter(
            (sale) =>
              sale.tenantId === context.tenantId &&
              (!context.storeId || sale.storeId === context.storeId),
          )
          .sort((a, b) => b.datetime.localeCompare(a.datetime))
          .map((sale) => saleWithItems(database, sale)),
      );
    },

    async getStockMovements(
      context: Pick<RequestContext, 'tenantId'> & Partial<Pick<RequestContext, 'storeId'>>,
    ): Promise<StockMovementView[]> {
      await wait();
      return clone(
        database.movements
          .filter(
            (movement) =>
              movement.tenantId === context.tenantId &&
              (!context.storeId || movement.storeId === context.storeId),
          )
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((movement) => ({
            ...movement,
            productName:
              database.products.find((product) => product.id === movement.productId)?.name ?? 'N/A',
            userName: database.users.find((user) => user.id === movement.userId)?.name ?? 'N/A',
          })),
      );
    },
  };
}

export const BackendAPI = createLocalBackend();
