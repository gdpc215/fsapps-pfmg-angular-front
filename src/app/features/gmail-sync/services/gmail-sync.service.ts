import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AppSettings } from '../../../core/models/app-settings.model';
import { RawImportRow } from '../../../core/models/import-batch.model';
import { AccountType } from '../../../core/models/transaction.model';
import { GmailMovement, GmailSyncResponse } from '../../../core/models/gmail-sync.model';

export interface ResolvedAccount {
  accountId: string;
  accountType: AccountType;
}

@Injectable({ providedIn: 'root' })
export class GmailSyncService {
  constructor(private http: HttpClient) {}

  /**
   * Calls the Apps Script Web App. Query params only, no custom headers — that keeps it a
   * "simple" CORS request the Apps Script deployment can answer.
   */
  fetchMovements(
    url: string,
    token: string,
    sinceIso: string,
    untilIso: string,
  ): Observable<GmailSyncResponse> {
    return this.http.get<GmailSyncResponse>(url, {
      params: { since: sinceIso, until: untilIso, token },
    });
  }

  /** Maps a parsed BCP movement onto the same RawImportRow shape the Excel importer uses. */
  toRawImportRow(m: GmailMovement, usdExchangeRate: number): RawImportRow {
    const rawPen = m.currency === 'PEN' ? m.amount : m.amount * usdExchangeRate;
    return {
      dateTransaction: (m.transactionDateLocal || m.emailDateLocal || '').slice(0, 10),
      description: m.payee || m.subject,
      currency: m.currency,
      amount: m.amount,
      amountPen: Math.round(rawPen * 100) / 100,
      strOperationNumber: m.operationNumber ?? undefined,
    };
  }

  resolveAccount(m: GmailMovement, settings: AppSettings): ResolvedAccount | null {
    if (!m.cardLast4) return null;
    const entry = (settings.gmailCardMap ?? []).find(e => e.strLast4 === m.cardLast4);
    return entry ? { accountId: entry.accountId, accountType: entry.accountType } : null;
  }
}
