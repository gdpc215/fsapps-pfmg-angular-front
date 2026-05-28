import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { MatStepper } from '@angular/material/stepper';
import { ImportWizardStateService } from '../../state/import-wizard-state.service';
import { TransactionService } from '../../../transactions/services/transaction.service';
import { AnnotatedImportRow } from '../../../../core/services/duplication-logic.service';
import { Transaction } from '../../../../core/models/transaction.model';

@Component({
  selector: 'app-step-review',
  standalone: false,
  templateUrl: './step-review.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepReviewComponent implements OnInit {
  @Input() stepper!: MatStepper;

  rows: AnnotatedImportRow[] = [];
  contextTransactions: Transaction[] = [];
  pendingDeletions = new Set<string>();
  noteInputs: Record<number, string> = {};
  showNoteFor: number | null = null;

  constructor(
    private stateService: ImportWizardStateService,
    private transactionService: TransactionService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const state = this.stateService.getState();
    this.rows = state.annotatedRows.map(r => ({ ...r }));
    const allTxns = this.transactionService.getAll();
    this.contextTransactions = state.contextTransactionIds
      .map(id => allTxns.find(t => t.id === id))
      .filter((t): t is Transaction => !!t);
  }

  get allAutoDuplicate(): boolean {
    return this.rows.length > 0 && this.rows.every(r => r.flag === 'AUTO_DUPLICATE');
  }

  togglePendingDeletion(id: string): void {
    if (this.pendingDeletions.has(id)) {
      this.pendingDeletions.delete(id);
    } else {
      this.pendingDeletions.add(id);
    }
    this.cdr.markForCheck();
  }

  toggleNote(index: number): void {
    this.showNoteFor = this.showNoteFor === index ? null : index;
  }

  saveNote(index: number): void {
    this.rows[index] = { ...this.rows[index], note: this.noteInputs[index] };
    this.showNoteFor = null;
    this.cdr.markForCheck();
  }

  markPending(index: number): void {
    this.rows[index] = { ...this.rows[index], pendingFlag: true };
    this.cdr.markForCheck();
  }

  onBack(): void {
    this.stateService.reset();
    this.stepper.previous();
  }

  onNext(): void {
    for (const id of this.pendingDeletions) {
      this.transactionService.softDelete(id);
    }
    this.stateService.patch({
      annotatedRows: this.rows,
      pendingDeletions: [...this.pendingDeletions],
    });
    this.stepper.next();
  }
}
