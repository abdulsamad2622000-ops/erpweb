import { isSerialFormatOk, normalizeSerial } from '../../purchase/utils/purchase-utils';

export type ScanCheckKind = 'ok' | 'extra' | 'invalid' | 'duplicate' | 'unknown';

export interface ScanCheck {
  kind: ScanCheckKind;
  serial: string;
}

/**
 * Ek scan ko expected list ke saath milata hai.
 * ok = expected aur nayi, extra = expected nahi (sirf allowExtra par), unknown = expected nahi.
 */
export function checkScan(
  expected: readonly string[],
  scanned: readonly string[],
  raw: string,
  allowExtra = false,
): ScanCheck {
  const serial = normalizeSerial(raw);
  if (!isSerialFormatOk(serial)) return { kind: 'invalid', serial };
  if (scanned.includes(serial)) return { kind: 'duplicate', serial };
  if (expected.includes(serial)) return { kind: 'ok', serial };
  return { kind: allowExtra ? 'extra' : 'unknown', serial };
}

/** Translation key jo scan ke masle ko samjhaye. */
export function scanProblemKey(kind: ScanCheckKind, unknownKey: string): string {
  switch (kind) {
    case 'invalid':
      return 'purchase.grn.why.invalid_format';
    case 'duplicate':
      return 'purchase.grn.why.duplicate_here';
    default:
      return unknownKey;
  }
}