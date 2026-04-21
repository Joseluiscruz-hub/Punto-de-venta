import { User, Product, Sale, StockMovement, Role, PaymentMethod } from '../models/types';

// Simulador de latencia de red
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const STORAGE_KEY = 'minisuper_db';

const DEFAULT_DB = {
  users: [
    { id: 'u1', username: 'admin', name: 'Administrador', role: 'ADMIN' as Role },
    { id: 'u2', username: 'caja1', name: 'Juan Pérez (Caja 1)', role: 'CASHIER' as Role }
  ],
  products: [
    { id: 'p1', barcode: '75010001', name: 'Leche Entera Alpura 1L', category: 'Lácteos', cost: 18.5, price: 25.0, stock: 45, minStock: 10 },
    { id: 'p2', barcode: '75010002', name: 'Pan Bimbo Blanco', category: 'Panadería', cost: 30.0, price: 42.0, stock: 12, minStock: 15 },
    { id: 'p3', barcode: '75010003', name: 'Coca-Cola 600ml', category: 'Bebidas', cost: 11.0, price: 18.0, stock: 120, minStock: 24 },
  ],
  sales: [] as Sale[],
  movements: [] as StockMovement[]
};

const getDB = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return JSON.parse(stored);
  return DEFAULT_DB;
};

const saveDB = (db: any) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
};

export const BackendAPI = {
  async login(username: string, pin: string): Promise<User> {
    await delay(500);
    const db = getDB();
    const user = db.users.find((u: any) => u.username === username);
    if (user && ((username === 'admin' && pin === '1234') || (username === 'caja1' && pin === '0000'))) {
      return user;
    }
    throw new Error('Credenciales inválidas');
  },

  async getProducts(): Promise<Product[]> {
    await delay(300);
    return getDB().products;
  },

  async getSales(): Promise<Sale[]> {
    await delay(300);
    return [...getDB().sales].sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
  },

  async saveProduct(product: Omit<Product, 'id'> | Product, userId: string): Promise<Product> {
    await delay(400);
    const db = getDB();
    const isNew = !('id' in product) || !product.id;
    let savedProduct: Product;

    if (isNew) {
      savedProduct = { ...product, id: `p${Date.now()}` } as Product;
      db.products.push(savedProduct);
      
      if (savedProduct.stock > 0) {
        db.movements.push({
          id: `m${Date.now()}`, productId: savedProduct.id, userId, type: 'PURCHASE',
          quantity: savedProduct.stock, date: new Date().toISOString(), reason: 'Inventario Inicial'
        });
      }
    } else {
      const index = db.products.findIndex((p: any) => p.id === product.id);
      if (index === -1) throw new Error('Producto no encontrado');
      
      const oldProduct = db.products[index];
      savedProduct = product as Product;
      db.products[index] = savedProduct;

      if (oldProduct.stock !== savedProduct.stock) {
        const diff = savedProduct.stock - oldProduct.stock;
        db.movements.push({
          id: `m${Date.now()}`, productId: savedProduct.id, userId, type: 'ADJUSTMENT',
          quantity: diff, date: new Date().toISOString(), reason: 'Ajuste manual'
        });
      }
    }
    saveDB(db);
    return savedProduct;
  },

  async deleteProduct(productId: string): Promise<void> {
    await delay(300);
    const db = getDB();
    db.products = db.products.filter((p: any) => p.id !== productId);
    saveDB(db);
  },

  async processSale(saleData: Omit<Sale, 'id' | 'datetime'>): Promise<Sale> {
    await delay(600);
    const db = getDB();
    
    for (const item of saleData.items) {
      const dbProduct = db.products.find((p: any) => p.id === item.id);
      if (!dbProduct) throw new Error(`Producto ${item.name} no existe`);
      if (dbProduct.stock < item.quantity) throw new Error(`Stock insuficiente para ${item.name}`);
    }

    const newSale: Sale = {
      ...saleData,
      id: `TRX-${Date.now().toString().slice(-6)}`,
      datetime: new Date().toISOString(),
    };
    db.sales.push(newSale);

    saleData.items.forEach(item => {
      const prodIndex = db.products.findIndex((p: any) => p.id === item.id);
      db.products[prodIndex].stock -= item.quantity;

      db.movements.push({
        id: `m${Date.now()}-${item.id}`,
        productId: item.id,
        userId: saleData.cashierId,
        type: 'SALE',
        quantity: -item.quantity,
        date: newSale.datetime,
        reason: `Venta ${newSale.id}`
      });
    });

    saveDB(db);
    return newSale;
  },

  async getStats() {
    await delay(300);
    const db = getDB();
    const totalSales = db.sales.reduce((acc: number, s: Sale) => acc + s.total, 0);
    const totalProducts = db.products.length;
    const lowStockCount = db.products.filter((p: Product) => p.stock <= p.minStock).length;
    const salesCount = db.sales.length;

    // Sales by day (last 7 days)
    const last7Days = Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const salesByDay = last7Days.map(date => ({
      date,
      total: db.sales
        .filter((s: Sale) => s.datetime.split('T')[0] === date)
        .reduce((acc: number, s: Sale) => acc + s.total, 0)
    }));

    return {
      totalSales,
      totalProducts,
      lowStockCount,
      salesCount,
      salesByDay
    };
  }
};
