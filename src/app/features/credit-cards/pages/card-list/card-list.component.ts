import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { CreditCardService } from '../../services/credit-card.service';
import { ImportBatchService } from '../../../import/services/import-batch.service';
import { TransactionService } from '../../../transactions/services/transaction.service';
import { ConciliationService } from '../../../conciliation/services/conciliation.service';
import { RecurrentTransactionService } from '../../../recurrent-transactions/services/recurrent-transaction.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { CreditCard } from '../../../../core/models/credit-card.model';

@Component({
  selector: 'app-card-list',
  standalone: false,
  templateUrl: './card-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardListComponent {
  cards$ = this.creditCardService.cards$;

  constructor(
    public creditCardService: CreditCardService,
    public importBatchService: ImportBatchService,
    private transactionService: TransactionService,
    private conciliationService: ConciliationService,
    private recurrentService: RecurrentTransactionService,
    private dialog: MatDialog,
    private router: Router,
    private snackbar: SnackbarService,
  ) {}

  getBalanceInfo(cardId: string): { balance: number; dateImport: string | undefined } {
    const batch = this.importBatchService.getLatestForAccount(cardId);
    return { balance: batch?.decBalanceAtImport ?? 0, dateImport: batch?.dateImport };
  }

  onEdit(card: CreditCard): void {
    this.router.navigate(['/credit-cards', card.id, 'edit']);
  }

  onDelete(card: CreditCard): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          title: 'Delete card?',
          message: `Deleting '${card.strName}' will also remove all its transactions, import batches, and cycle records. This cannot be undone.`,
          danger: true,
        },
      }
    );
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.creditCardService.deleteWithCascade(card.id, {
          transactionService: this.transactionService,
          importBatchService: this.importBatchService,
          conciliationService: this.conciliationService,
          recurrentService: this.recurrentService,
        });
        this.snackbar.success(`Card '${card.strName}' deleted.`);
      }
    });
  }
}
