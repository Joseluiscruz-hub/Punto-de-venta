import type { User, Product, Sale, ProcessSaleInput, CreateProductInput, Customer, Purchase, StoreConfig } from '../models/types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const STORAGE_KEYS = {
  PRODUCTS: 'eltriunfo_products',
  SALES: 'eltriunfo_sales',
  USER: 'eltriunfo_current_user',
  OFFLINE_QUEUE: 'eltriunfo_offline_queue',
  CUSTOMERS: 'eltriunfo_customers',
  PURCHASES: 'eltriunfo_purchases',
  CONFIG: 'eltriunfo_config'
};

export const BackendAPI = {
  // --- AUTH ---
  async login(username: string, pin: string): Promise<User | null> {
    await delay(500);
    const users: User[] = [
      { id: '1', username: 'admin', name: 'Dueño El Triunfo', role: 'ADMIN' },
      { id: '2', username: 'caja1', name: 'Cajero Principal', role: 'CASHIER' }
    ];
    
    const user = users.find(u => u.username === username && (pin === '1234' || pin === '0000'));
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      return user;
    }
    throw new Error('Credenciales inválidas');
  },

  async getCurrentUser(): Promise<User | null> {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : null;
  },

  async logout() {
    localStorage.removeItem(STORAGE_KEYS.USER);
  },

  // --- CONFIG ---
  async getConfig(): Promise<StoreConfig> {
    const data = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!data) {
      const defaultConfig: StoreConfig = {
        name: 'EL TRIUNFO',
        address: 'Av. De la Victoria #123, Ciudad de México',
        phone: '555-123-4567',
        taxId: 'TRI-001122-XYZ',
        currency: 'MXN',
        taxRate: 16
      };
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(defaultConfig));
      return defaultConfig;
    }
    return JSON.parse(data);
  },

  async saveConfig(config: StoreConfig): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  },

  // --- PRODUCTS ---
  async getProducts(): Promise<Product[]> {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!data) {
      const initialProducts: Product[] = [
        { id: '1', barcode: '7501055300074', name: 'Coca-Cola 600ml', price: 18.50, cost: 14.00, stock: 45, minStock: 10, category: 'Bebidas' },
        { id: '2', barcode: '7501000111205', name: 'Sabritas Sal 45g', price: 17.00, cost: 12.50, stock: 20, minStock: 5, category: 'Botanas' },
        { id: '3', barcode: '7501030497217', name: 'Leche Entera 1L', price: 26.00, cost: 21.00, stock: 12, minStock: 6, category: 'Lácteos' },
        { id: '4', barcode: '0000000000004', name: 'Pan Blanco Grande', price: 45.00, cost: 38.00, stock: 8, minStock: 4, category: 'Panadería' }
      ];
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(initialProducts));
      return initialProducts;
    }
    return JSON.parse(data);
  },

  async saveProducts(products: Product[]): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  },

  async importProducts(newProducts: CreateProductInput[]): Promise<void> {
    const currentProducts = await this.getProducts();
    const updatedProducts = [...currentProducts];

    newProducts.forEach(input => {
      const existingIndex = updatedProducts.findIndex(p => p.barcode === input.barcode);
      if (existingIndex >= 0) {
        updatedProducts[existingIndex] = {
          ...updatedProducts[existingIndex],
          stock: updatedProducts[existingIndex].stock + input.stock,
          price: input.price || updatedProducts[existingIndex].price,
          name: input.name || updatedProducts[existingIndex].name
        };
      } else {
        updatedProducts.push({
          ...input,
          id: Math.random().toString(36).substr(2, 9)
        });
      }
    });

    await this.saveProducts(updatedProducts);
  },

  // --- CUSTOMERS ---
  async getCustomers(): Promise<Customer[]> {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (!data) {
      const initial: Customer[] = [
        { id: '1', name: 'Juan Pérez', email: 'juan@mail.com', phone: '555-0011', totalSpent: 1200, lastVisit: new Date().toISOString(), address: 'Calle 1 #123' },
        { id: '2', name: 'Maria Lopez', email: 'maria@mail.com', phone: '555-2233', totalSpent: 850, lastVisit: new Date().toISOString(), address: 'Av. Juarez #45' }
      ];
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(data);
  },

  async saveCustomer(customer: Customer): Promise<void> {
    const customers = await this.getCustomers();
    const index = customers.findIndex(c => c.id === customer.id);
    if (index >= 0) customers[index] = customer;
    else customers.push(customer);
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  },

  // --- PURCHASES (Entrada de Mercancía) ---
  async getPurchases(): Promise<Purchase[]> {
    const data = localStorage.getItem(STORAGE_KEYS.PURCHASES);
    return data ? JSON.parse(data) : [];
  },

  async createPurchase(purchase: Omit<Purchase, 'id'>): Promise<Purchase> {
    const newPurchase = {
      ...purchase,
      id: 'PUR-' + Math.random().toString(36).substr(2, 6).toUpperCase()
    };
    
    // Actualizar Stock de productos
    const products = await this.getProducts();
    const updatedProducts = products.map(p => {
      const item = purchase.items.find(i => i.productId === p.id);
      if (item) {
        return { ...p, stock: p.stock + item.quantity, cost: item.cost };
      }
      return p;
    });
    await this.saveProducts(updatedProducts);

    const purchases = await this.getPurchases();
    localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify([newPurchase, ...purchases]));
    return newPurchase;
  },

  // --- SALES ---
  async getSales(): Promise<Sale[]> {
    const data = localStorage.getItem(STORAGE_KEYS.SALES);
    return data ? JSON.parse(data) : [];
  },

  async processSale(input: ProcessSaleInput): Promise<Sale> {
    await delay(300);
    const products = await this.getProducts();
    const user = await this.getCurrentUser();
    if (!user) throw new Error('No hay sesión activa');

    if (!input.isOfflineSync) {
      for (const item of input.items) {
        const product = products.find(p => p.id === item.productId);
        if (!product || product.stock < item.quantity) {
          throw new Error(`Stock insuficiente para: ${item.name}`);
        }
      }
    }

    const updatedProducts = products.map(p => {
      const saleItem = input.items.find(item => item.productId === p.id);
      if (saleItem) return { ...p, stock: p.stock - saleItem.quantity };
      return p;
    });
    await this.saveProducts(updatedProducts);

    const total = input.items.reduce((sum, item) => sum + item.subtotal, 0);
    const newSale: Sale = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      date: input.offlineDate || new Date().toISOString(),
      items: input.items,
      total,
      paymentMethod: input.paymentMethod,
      cashReceived: input.cashReceived,
      change: input.cashReceived ? input.cashReceived - total : 0,
      userId: user.id,
      customerId: input.customerId,
      isOfflineSync: input.isOfflineSync
    };

    const sales = await this.getSales();
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify([newSale, ...sales]));

    // Actualizar total gastado del cliente
    if (input.customerId) {
      const customers = await this.getCustomers();
      const cIndex = customers.findIndex(c => c.id === input.customerId);
      if (cIndex >= 0) {
        customers[cIndex].totalSpent += total;
        customers[cIndex].lastVisit = newSale.date;
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
      }
    }

    return newSale;
  },

  // --- OFFLINE QUEUE ---
  async getOfflineQueue(): Promise<ProcessSaleInput[]> {
    const data = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    return data ? JSON.parse(data) : [];
  },

  async addToOfflineQueue(sale: ProcessSaleInput): Promise<void> {
    const queue = await this.getOfflineQueue();
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify([...queue, sale]));
  },

  async clearOfflineQueue(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
  }
};
