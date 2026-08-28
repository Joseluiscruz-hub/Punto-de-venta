import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface AbarrotesCatalogItem {
  id: string;
  barcode: string;
  name: string;
  category: string;
  imageUrl: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
}

export function loadAbarrotesCatalog(): AbarrotesCatalogItem[] {
  const catalogPath = resolve(process.cwd(), 'public/productos/catalogo-generico.json');
  const parsed: unknown = JSON.parse(readFileSync(catalogPath, 'utf8'));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('El catalogo generico de abarrotes esta vacio o es invalido');
  }
  return parsed as AbarrotesCatalogItem[];
}

export function catalogProductUuid(itemId: string): string {
  const match = /^p-(\d+)$/.exec(itemId);
  if (!match) {
    throw new Error(`Id de catalogo invalido: ${itemId}`);
  }
  return `60000000-0000-4000-8000-${match[1].padStart(12, '0')}`;
}
