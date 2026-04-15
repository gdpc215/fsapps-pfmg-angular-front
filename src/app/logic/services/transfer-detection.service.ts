import { Injectable } from '@angular/core';
import { Transaction, TransactionType } from '../types/transaction';

@Injectable({ providedIn: 'root' })
export class TransferDetectionService {
  detect(transactions: Transaction[], toleranceDays = 2): Array<[Transaction, Transaction]> {
    const pairs: Array<[Transaction, Transaction]> = [];

    for (let i = 0; i < transactions.length; i += 1) {
      for (let j = i + 1; j < transactions.length; j += 1) {
        const a = transactions[i];
        const b = transactions[j];
        if (a.sourceId === b.sourceId) {
          continue;
        }

        if (Math.abs(Math.abs(a.amount) - Math.abs(b.amount)) > 0.01) {
          continue;
        }

        if (Math.sign(a.amount) === Math.sign(b.amount)) {
          continue;
        }

        const diffDays = Math.abs(Math.floor((new Date(a.date).getTime() - new Date(b.date).getTime()) / (1000 * 60 * 60 * 24)));
        if (diffDays <= toleranceDays) {
          pairs.push([a, b]);
        }
      }
    }

    return pairs;
  }

  linkTransfer(a: Transaction, b: Transaction): void {
    a.type = TransactionType.TRANSFER;
    b.type = TransactionType.TRANSFER;
    a.linkedTransactionId = b.id;
    b.linkedTransactionId = a.id;
  }
}
