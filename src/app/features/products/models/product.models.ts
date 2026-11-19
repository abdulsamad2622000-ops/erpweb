export interface Brand {
  id: number;
  name: string;
  isActive: boolean;
}

export interface Category {
  id: number;
  name: string;
  /** null ya na ho to top-level category. */
  parentId?: number | null;
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
  specs?: ProductSpecs;
  isActive: boolean;
}

export interface ProductSpecs {
  cpu: string;
  ram: string;
  storage: string;
  gpu: string;
  screen: string;
}

export type ProductInput = Omit<Product, 'id'>;
export type BrandInput = Omit<Brand, 'id'>;
export type CategoryInput = Omit<Category, 'id'>;
