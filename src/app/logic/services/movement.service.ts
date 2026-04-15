import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { Constants } from '../constants';
import { Transaction } from '../types/transaction';
import { DuplicateCheckResult, DuplicateDetectionRule, DuplicateDetectionService } from './duplicate-detection.service';
import { StorageService } from './storage.service';
import { TransactionService } from './transaction.service';
import { TransferDetectionService } from './transfer-detection.service';

export { DuplicateDetectionRule } from './duplicate-detection.service';

export interface MovementsByAccount {
  [accountId: string]: Transaction[];
}

@Injectable({ providedIn: 'root' })
export class MovementService {
  constructor(
    private transactionService: TransactionService,
    private duplicateDetectionService: DuplicateDetectionService,
    private storageService: StorageService,
    private transferDetectionService: TransferDetectionService
  ) {}

  getMovementsByAccountOrCard(accountOrCardId: string): Transaction[] {
    return this.transactionService.getBySource(accountOrCardId).map((tx) => this.toTransaction(tx));
  }

  getMovementsByAccountMap(): Observable<MovementsByAccount> {
    return this.transactionService.getTransactions().pipe(
      map((transactions) => transactions.reduce((acc, tx) => {
        const sourceId = tx.sourceId;
        if (!acc[sourceId]) {
          acc[sourceId] = [];
        }
        acc[sourceId].push(this.toTransaction(tx));
        return acc;
      }, {} as MovementsByAccount))
    );
  }

  addMovement(movement: Transaction): void {
    this.transactionService.addTransaction(movement);
    this.detectAndLinkTransfers(movement.accountOrCardId);
  }

  addMovements(movements: Transaction[]): void {
    this.transactionService.addTransactions(movements);
    const impactedSources = [...new Set(movements.map((m) => m.accountOrCardId))];
    impactedSources.forEach((sourceId) => this.detectAndLinkTransfers(sourceId));
  }

  updateMovement(movement: Transaction): void {
    movement.isManualOverride = true;
    this.transactionService.updateTransaction(movement);
    this.detectAndLinkTransfers(movement.accountOrCardId);
  }

  deleteMovement(id: string): void {
    this.transactionService.deleteTransaction(id);
  }

  categorizeMovement(id: string, categoryId: string | null, subcategoryId: string | null): void {
    const target = this.transactionService.getCurrentTransactions().find((tx) => tx.id === id);
    if (!target) {
      return;
    }

    target.category = categoryId || undefined;
    target.subcategory = subcategoryId || undefined;
    target.isManualOverride = true;
    this.transactionService.updateTransaction(target);
  }

  deleteAll(): void {
    this.transactionService.clearAll();
  }

  isDuplicate(movement: Transaction, _hasOperationNumber: boolean): boolean {
    return this.checkDuplicate(movement, _hasOperationNumber).status === 'CONFIRMED';
  }

  checkDuplicate(movement: Transaction, _hasOperationNumber: boolean): DuplicateCheckResult {
    const existing = this.transactionService.getBySource(movement.accountOrCardId);
    return this.duplicateDetectionService.checkDuplicate(movement, existing);
  }

  saveDuplicateDetectionRules(rules: DuplicateDetectionRule[]): void {
    this.storageService.set(Constants.StorageTags.DUPLICATE_DETECTION_RULES, rules);
  }

  private toTransaction(tx: any): Transaction {
    const transaction = new Transaction();
    Object.assign(transaction, tx);
    return transaction;
  }

  private detectAndLinkTransfers(sourceId: string): void {
    const sourceTransactions = this.transactionService.getBySource(sourceId);
    const allTransactions = this.transactionService.getCurrentTransactions();
    const candidatePairs = this.transferDetectionService.detect([
      ...sourceTransactions,
      ...allTransactions.filter((tx) => tx.sourceId !== sourceId)
    ]);

    candidatePairs.forEach(([a, b]) => {
      if (a.linkedTransactionId || b.linkedTransactionId) {
        return;
      }
      this.transferDetectionService.linkTransfer(a, b);
      this.transactionService.updateTransaction(a);
      this.transactionService.updateTransaction(b);
    });
  }
}
