// Simulación de API para el punto de venta
import { User, Product, Sale } from '../models/types';

const users: User[] = [
  { id: '1', username: 'admin', role: 'admin' },
  { id: '2', username: 'cajero', role: 'cashier' },
];

const products: Product[] = [
  { id: 'p1', name: 'Coca-Cola', price: 20, stock: 100 },
  { id: 'p2', name: 'Pepsi', price: 18, stock: 80 },
];

let sales: Sale[] = [];

export const BackendAPI = {
  async login(username: string, pin: string): Promise<User | null> {
    // Simulación simple
    return users.find(u => u.username === username) || null;
  },
  async getProducts(): Promise<Product[]> {
    return products;
  },
  async addSale(sale: Sale): Promise<void> {
    sales.push(sale);
  },
  async getSales(): Promise<Sale[]> {
    return sales;
  },
};
