export interface Supplier {
  id: number;
  name: string;
  phone: string;
  email: string;
  city: string;
  taxNumber: string;
  paymentTermsDays: number;
  isActive: boolean;
}
export type SupplierInput = Omit<Supplier, 'id'>;

export type PoStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'partially_received' | 'received' | 'cancelled';
export type PoAction = 'edit' | 'submit' | 'approve' | 'reject' | 'receive' | 'cancel';

export interface PoLine {
  productId: number;
  sku: string;
  name: string;
  /** true = har unit ka serial capture hoga. */
  serialized: boolean;
  qty: number;
  unitCost: number;
  receivedQty: number;
}

export interface PurchaseOrder {
  id: number;
  number: string;
  supplierId: number;
  supplierName: string;
  warehouseId: number;
  orderDate: string;
  expectedDate: string | null;
  terms: string;
  status: PoStatus;
  lines: PoLine[];
  approvalNote: string | null;
  approvedBy: string | null;
}

export interface PoInput {
  supplierId: number;
  warehouseId: number;
  orderDate: string;
  expectedDate: string | null;
  terms: string;
  lines: Pick<PoLine, 'productId' | 'qty' | 'unitCost'>[];
}

export type InspectionStatus = 'accepted' | 'rejected' | 'quarantine';

export interface GrnSerial {
  serial: string;
  productId: number;
  status: InspectionStatus;
  note: string | null;
}

export interface GrnLine {
  productId: number;
  sku: string;
  name: string;
  serialized: boolean;
  orderedQty: number;
  /** Pichli GRNs mein aa chuka. */
  previouslyReceived: number;
  /** Non-serialized lines ki is GRN ki qty. Serialized lines ki qty accepted serials se banti hai. */
  qty: number;
  serials: GrnSerial[];
}

export interface Grn {
  id: number;
  number: string;
  poId: number;
  poNumber: string;
  supplierName: string;
  warehouseId: number;
  createdAt: string;
  postedAt: string | null;
  status: 'draft' | 'posted';
  lines: GrnLine[];
}

export type SerialCheckReason = 'duplicate_in_stock' | 'wrong_model' | 'invalid_format';

export interface SerialCheck {
  ok: boolean;
  reason: SerialCheckReason | null;
  /** wrong_model par: serial asal mein kis model ka hai. */
  actualModel: string | null;
}
