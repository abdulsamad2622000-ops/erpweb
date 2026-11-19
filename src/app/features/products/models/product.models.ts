import { PriceTierCode } from '../../settings/models/settings.models';

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

export interface ProductSpecs {
  cpu: string;
  ram: string;
  storage: string;
  gpu: string;
  screen: string;
}

export interface ProductPrice {
  tier: PriceTierCode;
  price: number;
}

export interface ReorderLevel {
  branchId: number;
  level: number;
}

/** Ek hi model ki alag configuration, apni SKU ke sath. */
export interface ProductVariant {
  id?: number;
  sku: string;
  name: string;
  barcode: string | null;
  isActive: boolean;
}

export interface ProductImage {
  id?: number;
  /** Mock mode mein data URL; real API mein server ka URL. */
  url: string;
  name: string;
  isPrimary: boolean;
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
  warrantyMonths?: number;
  /** Backend sirf products.cost.view wale ko bhejta hai. */
  costPrice?: number | null;
  /** Minimum price floor: koi tier is se kam nahi ho sakti. */
  minPrice?: number | null;
  prices?: ProductPrice[];
  reorderLevels?: ReorderLevel[];
  variants?: ProductVariant[];
  images?: ProductImage[];
  isActive: boolean;
}

export type ProductInput = Omit<Product, 'id'>;
export type BrandInput = Omit<Brand, 'id'>;
export type CategoryInput = Omit<Category, 'id'>;