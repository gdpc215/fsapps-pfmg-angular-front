import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { CreditCardService } from '../../../credit-cards/services/credit-card.service';
import { TransactionService } from '../../../transactions/services/transaction.service';
import { ConciliationService } from '../../services/conciliation.service';
import { ConciliationCalculatorService, ConciliationResult, CycleWindow } from '../../../../core/services/conciliation-calculator.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-conciliation-form',
  standalone: false,
  templateUrl: './conciliation-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConciliationFormComponent {
  form = new FormGroup({
    cardId:         new FormControl<string|null>(null, Validators.required),
    currentBalance: new FormControl<number|null>(null, [Validators.required]),
  });

  result: ConciliationResult | null = null;
  isFirstCycle = false;

  cards$ = this.creditCardService.cards$;

  constructor(
    private creditCardService: CreditCardService,
    private transactionService: TransactionService,
    private conciliationService: ConciliationService,
    private calculator: ConciliationCalculatorService,
    private dialog: MatDialog,
    private router: Router,
    private snackbar: SnackbarService,
    private cdr: ChangeDetectorRef,
  ) {}

  get cycleWindow(): CycleWindow | null {
    const cardId = this.form.value.cardId;
    const card = cardId ? this.creditCardService.getById(cardId) : null;
    if (!card) return null;
    return this.calculator.buildCycleWindow(
      card.intClosingDay,
      new Date().toISOString().slice(0, 10)
    );
  }

  onCalculate(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const cardId = this.form.value.cardId!;
    const card = this.creditCardService.getById(cardId)!;
    const todayDate = new Date().toISOString().slice(0, 10);
    const latestClose = this.conciliationService.getMostRecentCycleClose(cardId);
    this.isFirstCycle = !latestClose;
    const previousClosingBalance = latestClose?.decClosingBalance ?? 0;

    this.result = this.calculator.calculate({
      cardId,
      intClosingDay: card.intClosingDay,
      todayDate,
      currentBalance: this.form.value.currentBalance!,
      previousClosingBalance,
      nonDeletedTransactions: this.transactionService.getNonDeleted(),
    });
    this.cdr.markForCheck();
  }

  onConfirm(): void {
    if (!this.result) return;
    const window = this.result.window;
    const cardId = this.form.value.cardId!;
    const card = this.creditCardService.getById(cardId)!;

    // Duplicate-cycle guard
    if (this.conciliationService.existsCycleClose(cardId, window.closingDate)) {
      const guardRef = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
        ConfirmDialogComponent,
        {
          data: {
            title: 'Overwrite cycle close?',
            message: `A cycle close already exists for ${window.closingDate}. Overwrite?`,
            danger: true,
          },
        }
      );
      guardRef.afterClosed().subscribe(confirmed => {
        if (confirmed) this.performSave(cardId, card.strName);
      });
    } else {
      this.performSave(cardId, card.strName);
    }
  }

  private performSave(cardId: string, cardName: string): void {
    const result = this.result!;

    let interestTxnId: string | undefined;
    if (result.interestAmount !== 0) {
      const txn = this.transactionService.save({
        accountId: cardId,
        accountType: 'CREDIT_CARD',
        dateTransaction: result.window.closingDate,
        strDescription: 'INTERES',
        strCurrency: 'PEN',
        decAmount: result.interestAmount,
        decAmountPen: result.interestAmount,
        strStatus: 'ACTIVE',
      });
      interestTxnId = txn.id;
    }

    this.conciliationService.saveCycleClose({
      cardId,
      dateClosing: result.window.closingDate,
      decOpeningBalance: result.openingBalance,
      decClosingBalance: result.amountB,
      decInterestAmount: result.interestAmount,
      interestTransactionId: interestTxnId,
    });

    this.conciliationService.saveCycleSnapshot({
      cardId,
      dateSnapshot: result.window.closingDate,
      decBalanceAtSnapshot: result.amountB,
      strType: 'CYCLE_CLOSE',
    });

    const discrepancyMsg = result.interestAmount !== 0
      ? `Discrepancy recorded: ${result.interestAmount.toFixed(2)}`
      : 'No discrepancy.';
    this.snackbar.success(`Cycle closed. ${discrepancyMsg}`);
    this.router.navigate(['/conciliation/history']);
  }
}
