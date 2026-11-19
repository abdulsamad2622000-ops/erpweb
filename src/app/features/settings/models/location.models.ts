export const LOCATION_LEVELS = ['zone', 'rack', 'shelf', 'bin'] as const;
export type LocationLevel = (typeof LOCATION_LEVELS)[number];

export interface WarehouseLocation {
  id: number;
  warehouseId: number;
  parentId: number | null;
  level: LocationLevel;
  code: string;
  name: string;
  /** Sirf bin ka hota hai; create par server banata hai. */
  barcode: string | null;
  isActive: boolean;
}
export type LocationInput = Omit<WarehouseLocation, 'id' | 'barcode'>;