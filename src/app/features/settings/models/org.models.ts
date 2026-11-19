export interface Branch {
  id: number;
  code: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  isActive: boolean;
}
export type BranchInput = Omit<Branch, 'id'>;

export const WAREHOUSE_TYPES = [
  'sellable',
  'showroom',
  'damaged',
  'quarantine',
  'repair',
  'returns',
  'in_transit',
] as const;
export type WarehouseType = (typeof WAREHOUSE_TYPES)[number];

export interface Warehouse {
  id: number;
  branchId: number;
  code: string;
  name: string;
  type: WarehouseType;
  isActive: boolean;
}
export type WarehouseInput = Omit<Warehouse, 'id'>;