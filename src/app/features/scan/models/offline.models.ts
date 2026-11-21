import { PutAwayBody } from './putaway.models';

/** Queue mein jo kaam rukte hain. Har variant ka apna chhota payload. */
export type QueuePayload =
  | { kind: 'putaway'; body: PutAwayBody }
  | { kind: 'transfer_dispatch'; transferId: number }
  | { kind: 'transfer_receive'; transferId: number; serials: string[] }
  | { kind: 'count_submit'; countId: number; serials: string[] };

export type QueueKind = QueuePayload['kind'];

/** pending = bhejna baaki. conflict = server ne mana kar diya, insaan ko dekhna hai. */
export type QueueStatus = 'pending' | 'conflict';

export interface QueueItem {
  /** Yehi Idempotency-Key bhi hai. */
  id: string;
  payload: QueuePayload;
  /** Insaan ko dikhne wala hawala (transfer no., serial, count no.). */
  label: string;
  status: QueueStatus;
  attempts: number;
  error: string | null;
  createdAt: string;
}