import type { User, Product, Sale, ProcessSaleInput, CreateProductInput } from '../models/types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const STORAGE_KEYS = {
  PRODUCTS: 'eltriunfo_products',
  SALES: 'eltriunfo_sales',
  USER: 'eltriunfo_current_user',
  OFFLINE_QUEUE: 'eltriunfo_offline_queue'
};

export const BackendAPI = {
  // --- AUTH ---
  async login(username: string, pin: string): Promise<User | null> {
    await delay(800);
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

  // --- PRODUCTS ---
  async getProducts(): Promise<Product[]> {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!data) {
      const initialProducts: Product[] = [
        { id: '1', barcode: '7501055300074', name: 'Coca-Cola 600ml', price: 18.50, cost: 14.00, stock: 45, minStock: 10, category: 'Bebidas' },
        { id: '2', barcode: '7501000111205', name: 'Sabritas Sal 45g', price: 17.00, cost: 12.50, stock: 20, minStock: 5, category: 'Botanas' },
        { id: '3', barcode: '7501030497217', name: 'Leche Entera 1L', price: 26.00, cost: 21.00, stock: 12, minStock: 6, category: 'Lácteos' },
        { id: '4', barcode: '0000000000004', name: 'Pan Blanco Grande', price: 45.00, cost: 38.00, stock: 8, minStock: 4, category: 'Panadería' },
        { id: '5', barcode: '0000000000005', name: 'Huevo (Kg)', price: 42.00, cost: 35.00, stock: 15, minStock: 5, category: 'Básicos' }
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
        // Actualizar stock si ya existe
        updatedProducts[existingIndex] = {
          ...updatedProducts[existingIndex],
          stock: updatedProducts[existingIndex].stock + input.stock,
          price: input.price || updatedProducts[existingIndex].price,
          name: input.name || updatedProducts[existingIndex].name
        };
      } else {
        // Crear nuevo
        updatedProducts.push({
          ...input,
          id: Math.random().toString(36).substr(2, 9)
        });
      }
    });

    await this.saveProducts(updatedProducts);
  },

  // --- SALES ---
  async getSales(): Promise<Sale[]> {
    const data = localStorage.getItem(STORAGE_KEYS.SALES);
    return data ? JSON.parse(data) : [];
  },

  async processSale(input: ProcessSaleInput): Promise<Sale> {
    await delay(500);
    const products = await this.getProducts();
    const user = await this.getCurrentUser();

    if (!user) throw new Error('No hay sesión activa');

    // Validar stock (Bypass si es sincronización offline)
    if (!input.isOfflineSync) {
      for (const item of input.items) {
        const product = products.find(p => p.id === item.productId);
        if (!product || product.stock < item.quantity) {
          throw new Error(`Stock insuficiente para: ${item.name}`);
        }
      }
    }

    // Actualizar stock
    const updatedProducts = products.map(p => {
      const saleItem = input.items.find(item => item.productId === p.id);
      if (saleItem) {
        return { ...p, stock: p.stock - saleItem.quantity };
      }
      return p;
    });
    await this.saveProducts(updatedProducts);

    // Crear venta
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
      isOfflineSync: input.isOfflineSync
    };

    const sales = await this.getSales();
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify([newSale, ...sales]));

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
