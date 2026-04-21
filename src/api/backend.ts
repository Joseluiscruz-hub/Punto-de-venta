import type { User, Product, Sale, ProcessSaleInput, CreateProductInput } from '../models/types';

const API_URL = 'http://localhost:3001';

export const BackendAPI = {
  // --- AUTH ---
  async login(username: string, pin: string): Promise<User | null> {
    // Simulación: solo permite PIN 1234 o 0000
    const res = await fetch(`${API_URL}/users?username=${username}`);
    const users: User[] = await res.json();
    const user = users.find(u => pin === '1234' || pin === '0000');
    if (user) {
      localStorage.setItem('minisuper_user', JSON.stringify(user));
      return user;
    }
    throw new Error('Credenciales inválidas');
  },

  async getCurrentUser(): Promise<User | null> {
    const data = localStorage.getItem('minisuper_user');
    return data ? JSON.parse(data) : null;
  },

  async logout() {
    localStorage.removeItem('minisuper_user');
  },

  // --- PRODUCTS ---
  async getProducts(): Promise<Product[]> {
    const res = await fetch(`${API_URL}/products`);
    if (!res.ok) throw new Error('Error al obtener productos');
    return res.json();
      return res.json();
    },

    async saveProducts(products: Product[]): Promise<void> {
      // No implementado: la API REST maneja persistencia
    },

    async importProducts(newProducts: CreateProductInput[]): Promise<void> {
      for (const input of newProducts) {
        await fetch(`${API_URL}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input)
        });
      }
    },
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

    async getSales(): Promise<Sale[]> {
      const res = await fetch(`${API_URL}/sales`);
      if (!res.ok) throw new Error('Error al obtener ventas');
      return res.json();
    },

    async processSale(input: ProcessSaleInput): Promise<Sale> {
      const user = await this.getCurrentUser();
      if (!user) throw new Error('No hay sesión activa');
      const total = input.items.reduce((sum, item) => sum + item.subtotal, 0);
      const newSale: Omit<Sale, 'id'> = {
        date: input.offlineDate || new Date().toISOString(),
        items: input.items,
        total,
        paymentMethod: input.paymentMethod,
        cashReceived: input.cashReceived,
        change: input.cashReceived ? input.cashReceived - total : 0,
        userId: user.id,
        isOfflineSync: input.isOfflineSync
      };
      const res = await fetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSale)
      });
      if (!res.ok) throw new Error('Error al crear venta');
      return res.json();
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
