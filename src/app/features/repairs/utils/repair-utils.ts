import { round2 } from '../../pos/utils/pos-utils';
import { BadgeTone } from '../../../shared/ui/status-badge/status-badge.component';
import { JobStatus, RepairPart, WarrantyState } from '../models/repair.models';

/** Backend RepairController::FLOW jaisa. */
export const JOB_FLOW: Record<JobStatus, JobStatus[]> = {
  received: ['diagnosing', 'cancelled'],
  diagnosing: ['waiting_parts', 'repairing', 'ready', 'cancelled'],
  waiting_parts: ['repairing', 'cancelled'],
  repairing: ['waiting_parts', 'ready'],
  ready: ['repairing'],
  delivered: [],
  cancelled: [],
};

export const JOB_TONE: Record<JobStatus, BadgeTone> = {
  received: 'neutral', diagnosing: 'info', waiting_parts: 'warning', repairing: 'info', ready: 'success', delivered: 'success', cancelled: 'danger',
};
export const WARRANTY_TONE: Record<WarrantyState, BadgeTone> = { in_warranty: 'success', expired: 'warning', not_ours: 'neutral' };

export const isOpen = (s: JobStatus): boolean => s !== 'delivered' && s !== 'cancelled';

export const partsTotal = (parts: RepairPart[]): number => round2(parts.reduce((a, p) => a + (p.qty || 0) * (p.unitPrice || 0), 0));

export const jobTotal = (parts: RepairPart[], labour: number): number => round2(partsTotal(parts) + (labour || 0));

/** Customer slip (A4 ka upar hissa / thermal dono par chal jaye). Sab text escape. */
export function jobSlipHtml(j: {
  number: string; createdAt: string; customerName: string; customerPhone: string; device: string; serial: string | null;
  problem: string; accessories: string; warrantyLabel: string; promisedOn: string | null; estimate: number | null;
}, l: { title: string; customer: string; device: string; serial: string; problem: string; accessories: string; warranty: string;
  promised: string; estimate: string; terms: string }): string {
  const esc = (s: string): string =>
    s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
  const row = (k: string, v: string): string => (v ? `<tr><th scope="col">${esc(k)}</th><td>${esc(v)}</td></tr>` : '');
  return `<style>.js{font:12px/1.4 system-ui,sans-serif;color:#000}.js h1{margin:0;color:#1E3A8A}.js h1 span{color:#00BCD4}
.js table{width:100%;border-collapse:collapse;margin-top:8px}.js th{text-align:start;width:30%;padding:3px;vertical-align:top}.js td{padding:3px}</style>
<div class="js"><h1>Novastack<span>hub</span></h1><p style="margin:0">Empowering Digital Vision</p>
<h2 style="margin:10px 0 0">${esc(l.title)} ${esc(j.number)}</h2><p style="margin:0">${esc(j.createdAt.slice(0, 10))}</p><table>
${row(l.customer, `${j.customerName} ${j.customerPhone}`)}${row(l.device, j.device)}${row(l.serial, j.serial ?? '')}
${row(l.problem, j.problem)}${row(l.accessories, j.accessories)}${row(l.warranty, j.warrantyLabel)}
${row(l.promised, j.promisedOn ?? '')}${row(l.estimate, j.estimate !== null ? j.estimate.toLocaleString('en-PK') : '')}
</table><p style="margin-top:12px;font-size:11px">${esc(l.terms)}</p></div>`;
}
