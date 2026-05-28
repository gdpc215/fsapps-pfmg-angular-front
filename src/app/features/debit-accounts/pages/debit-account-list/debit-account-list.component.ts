import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { DebitAccountService } from '../../services/debit-account.service';
import { ImportBatchService } from '../../../import/services/import-batch.service';
import { TransactionService } from '../../../transactions/services/transaction.service';
import { RecurrentTransactionService } from '../../../recurrent-transactions/services/recurrent-transaction.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DebitAccount } from '../../../../core/models/debit-account.model';

@Component({
  selector: 'app-debit-account-list',
  standalone: false,
  templateUrl: './debit-account-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DebitAccountListComponent {
  accounts$ = this.debitAccountService.accounts$;

  constructor(
    public debitAccountService: DebitAccountService,
    public importBatchService: ImportBatchService,
    private transactionService: TransactionService,
    private recurrentService: RecurrentTransactionService,
    private dialog: MatDialog,
    private router: Router,
    private snackbar: SnackbarService,
  ) {}

  getBalanceInfo(accountId: string): { balance: number; dateImport: string | undefined } {
    const batch = this.importBatchService.getLatestForAccount(accountId);
    return { balance: batch?.decBalanceAtImport ?? 0, dateImport: batch?.dateImport };
  }

  onEdit(account: DebitAccount): void {
    this.router.navigate(['/debit-accounts', account.id, 'edit']);
  }

  onDelete(account: DebitAccount): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          title: 'Delete account?',
          message: `Deleting '${account.strName}' will also remove all its transactions and import batches. This cannot be undone.`,
          danger: true,
        },
      }
    );
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.debitAccountService.deleteWithCascade(account.id, {
          transactionService: this.transactionService,
          importBatchService: this.importBatchService,
          recurrentService: this.recurrentService,
        });
        this.snackbar.success(`Account '${account.strName}' deleted.`);
      }
    });
  }
}
