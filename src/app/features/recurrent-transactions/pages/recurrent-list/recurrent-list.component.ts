import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { RecurrentTransactionService } from '../../services/recurrent-transaction.service';
import { CreditCardService } from '../../../credit-cards/services/credit-card.service';
import { DebitAccountService } from '../../../debit-accounts/services/debit-account.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { RecurrentTransaction } from '../../../../core/models/recurrent-transaction.model';
import { AccountType } from '../../../../core/models/transaction.model';

@Component({
  selector: 'app-recurrent-list',
  standalone: false,
  templateUrl: './recurrent-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurrentListComponent {
  recurrents$ = this.recurrentService.recurrents$;

  constructor(
    private recurrentService: RecurrentTransactionService,
    private creditCardService: CreditCardService,
    private debitAccountService: DebitAccountService,
    private dialog: MatDialog,
    private router: Router,
    private snackbar: SnackbarService,
  ) {}

  getAccountName(accountId: string, accountType: AccountType): string {
    if (accountType === 'CREDIT_CARD') {
      return this.creditCardService.getById(accountId)?.strName ?? '(unknown)';
    }
    return this.debitAccountService.getById(accountId)?.strName ?? '(unknown)';
  }

  onDelete(r: RecurrentTransaction): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          title: 'Delete recurrent?',
          message: `Delete '${r.strName}'? Its match history will also be removed.`,
          danger: true,
        },
      }
    );
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.recurrentService.deleteWithMatches(r.id);
        this.snackbar.success('Deleted.');
      }
    });
  }
}
