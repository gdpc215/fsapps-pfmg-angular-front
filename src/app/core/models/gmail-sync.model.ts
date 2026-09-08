import { TransactionCurrency } from './transaction.model';

export type GmailMovementType = 'EXPENSE' | 'INCOME' | 'TRANSFER';

/** One parsed BCP notification, as returned by the Apps Script connector. */
export interface GmailMovement {
  messageId: string;
  subject: string;
  rawType: string | null;
  type: GmailMovementType;
  payee: string;
  amount: number;                 // already signed (bank convention)
  currency: TransactionCurrency;
  operationNumber: string | null;
  cardLast4: string | null;
  transactionDateLocal: string;   // 'YYYY-MM-DDTHH:mm:ss' (America/Lima, no offset)
  emailDateLocal: string;
  date?: string;                  // legacy ISO UTC
}

export interface GmailUnparsed {
  messageId: string;
  subject: string;
  reason: string;
}

export interface GmailSyncResponse {
  ok: boolean;
  error?: string;
  generatedAt?: string;
  since?: string;
  until?: string;
  count?: number;
  movements?: GmailMovement[];
  unparsed?: GmailUnparsed[];
}
