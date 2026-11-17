export interface Brand {
  id: number;
  name: string;
  isActive: boolean;
}

export interface Category {
  id: number;
  name: string;
  isActive: boolean;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  barcode: string | null;
  brandId: number | null;
  categoryId: number | null;
  trackBatch: boolean;
  isActive: boolean;
}

export type ProductInput = Omit<Product, 'id'>;
export type BrandInput = Omit<Brand, 'id'>;
export type CategoryInput = Omit<Category, 'id'>;
