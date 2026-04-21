import type { User, Product, Sale, ProcessSaleInput, CreateProductInput } from '../models/types';

const API_URL = 'http://localhost:3001';
const STORAGE_KEYS = {
  USER: 'eltriunfo_current_user',
  OFFLINE_QUEUE: 'eltriunfo_offline_queue'
};

export const BackendAPI = {
  // --- AUTH ---
  async login(username: string, pin: string): Promise<User | null> {
    const res = await fetch(`${API_URL}/users?username=${username}`);
    const users: User[] = await res.json();
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
    const res = await fetch(`${API_URL}/products`);
    if (!res.ok) throw new Error('Error al obtener productos');
    return res.json();
  },

  async importProducts(newProducts: CreateProductInput[]): Promise<void> {
    for (const input of newProducts) {
      await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, id: Math.random().toString(36).substr(2, 9) })
      });
    }
  },

  // --- SALES ---
  async getSales(): Promise<Sale[]> {
    const res = await fetch(`${API_URL}/sales`);
    if (!res.ok) throw new Error('Error al obtener ventas');
    return res.json();
  },

  async processSale(input: ProcessSaleInput): Promise<Sale> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('No hay sesión activa');

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
