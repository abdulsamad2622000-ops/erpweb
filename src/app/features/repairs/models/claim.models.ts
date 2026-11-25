export type ClaimStatus = 'open' | 'sent' | 'approved' | 'rejected' | 'credited';

export interface SupplierClaim {
  id: number;
  number: string;
  serial: string;
  supplier: string;
  reason: string;
  status: ClaimStatus;
  note: string | null;
  createdAt: string;
  by: string;
}

export interface ClaimInput {
  serial: string;
  supplier: string;
  reason: string;
}

export const CLAIM_FLOW: Record<ClaimStatus, ClaimStatus[]> = {
  open: ['sent'],
  sent: ['approved', 'rejected'],
  approved: ['credited'],
  rejected: [],
  credited: [],
};

export interface PublicWarranty {
  serial: string;
  productName: string | null;
  warranty: 'in_warranty' | 'expired' | 'not_ours';
  warrantyUntil: string | null;
}
