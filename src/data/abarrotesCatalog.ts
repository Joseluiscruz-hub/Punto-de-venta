import catalogJson from '../../public/productos/catalogo-generico.json';
import type { Product, StoreProduct } from '../models/types';

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

export const ABARROTES_CATALOG = catalogJson as AbarrotesCatalogItem[];

export function buildAbarrotesSeed(
  tenantId: string,
  storeIds: string[],
): {
  products: Product[];
  storeProducts: StoreProduct[];
} {
  const products: Product[] = ABARROTES_CATALOG.map((item) => ({
    id: item.id,
    tenantId,
    barcode: item.barcode,
    name: item.name,
    category: item.category,
    imageUrl: item.imageUrl,
    cost: item.cost,
    price: item.price,
    active: true,
  }));

  const storeProducts: StoreProduct[] = storeIds.flatMap((storeId) =>
    ABARROTES_CATALOG.map((item) => ({
      id: `sp-${storeId}-${item.id}`,
      tenantId,
      storeId,
      productId: item.id,
      stock: item.stock,
      minStock: item.minStock,
    })),
  );

  return { products, storeProducts };
}
