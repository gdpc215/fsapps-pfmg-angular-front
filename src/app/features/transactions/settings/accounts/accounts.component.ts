import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { AccountService } from '../../../../logic/services/account.service';
import { CreditCardService } from '../../../../logic/services/credit-card.service';
import { CurrencyService } from '../../../../logic/services/currency.service';
import { MovementService } from '../../../../logic/services/movement.service';
import { SnapshotService } from '../../../../logic/services/snapshot.service';
import { Account, AccountType } from '../../../../logic/types/account';
import { BalanceSnapshot } from '../../../../logic/types/balance-snapshot';
import { Currency } from '../../../../logic/types/currency';
import { AccountDialogComponent } from './account-dialog/account-dialog.component';
import { CheckpointDialogComponent } from './checkpoint-dialog/checkpoint-dialog.component';
import { CycleClosingDateDialogComponent } from './cycle-closing-date-dialog/cycle-closing-date-dialog.component';
import { CycleSummaryDialogComponent } from './cycle-summary-dialog/cycle-summary-dialog.component';
import { SnapshotsDialogComponent } from './snapshots-dialog/snapshots-dialog.component';

@Component({
  selector: 'app-accounts',
  templateUrl: './accounts.component.html',
  standalone: false
})
export class AccountsComponent implements OnInit {
  accounts$!: Observable<Account[]>;
  currencies: Currency[] = [];
  AccountType = AccountType;

  constructor(
    @Inject(AccountService) private accountService: AccountService,
    private snapshotService: SnapshotService,
    private creditCardService: CreditCardService,
    private movementService: MovementService,
    private currencyService: CurrencyService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.accounts$ = this.accountService.getAccounts();
    this.currencyService.getCurrencies().subscribe(currencies => {
      this.currencies = currencies;
    });
  }

  getCurrencyDisplay(currencyId: string): string {
    const currency = this.currencies.find(c => c.id === currencyId);
    return currency ? `${currency.symbol} ${currency.code}` : 'Unknown';
  }

  getAccountTypeLabel(type: AccountType): string {
    return type === AccountType.DEBIT ? 'Debit Account' : 'Credit Card';
  }

  openAddDialog(): void {
    const dialogRef = this.dialog.open(AccountDialogComponent, {
      width: '500px',
      data: { account: null, currencies: this.currencies }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.accountService.addAccount(result);
      }
    });
  }

  openEditDialog(account: Account): void {
    const dialogRef = this.dialog.open(AccountDialogComponent, {
      width: '500px',
      data: { account: { ...account }, currencies: this.currencies }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.accountService.updateAccount(result);
      }
    });
  }

  openCheckpointDialog(account: Account): void {
    const dialogRef = this.dialog.open(CheckpointDialogComponent, {
      width: '400px',
      data: { entity: account, type: 'account' }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result !== undefined && result !== null) {
        const snapshot = new BalanceSnapshot();
        snapshot.sourceId = account.id;
        snapshot.currency = (account.currencyId as 'PEN' | 'USD') || 'PEN';
        snapshot.balance = Number(result);
        snapshot.datetime = new Date().toISOString();
        this.snapshotService.addSnapshot(snapshot);
      }
    });
  }

  deleteAccount(account: Account): void {
    if (confirm(`Are you sure you want to delete ${account.name}?`)) {
      this.accountService.deleteAccount(account.id);
    }
  }

  recalculateBalance(account: Account): void {
    const totalAmount = this.accountService.getComputedBalance(account.id);
    this.snackBar.open(`Derived balance for ${account.name}: ${totalAmount.toFixed(2)}`, 'OK', { duration: 5000 });
  }

  openCycleSummary(account: Account): void {
    this.dialog.open(CycleSummaryDialogComponent, {
      width: '560px',
      data: { account }
    });
  }

  estimateCycleInterest(account: Account): void {
    if (account.type !== AccountType.CREDIT) {
      return;
    }

    const dialogRef = this.dialog.open(CycleClosingDateDialogComponent, {
      width: '420px',
      data: { accountName: account.name }
    });

    dialogRef.afterClosed().subscribe((dateStr: string | null) => {
      if (!dateStr) {
        return;
      }

      try {
        const interestTx = this.creditCardService.estimateCycleInterest({
          id: account.id,
          type: account.sourceType
        }, dateStr);
        this.movementService.addMovement(interestTx as any);
        this.snackBar.open(`Estimated interest inserted: ${interestTx.amount.toFixed(2)} PEN`, 'OK', { duration: 5000 });
      } catch (error: any) {
        this.snackBar.open(error?.message || 'Unable to estimate interest.', 'Close', { duration: 6000, panelClass: ['snack-error'] });
      }
    });
  }

  openSnapshotsDialog(account: Account): void {
    this.dialog.open(SnapshotsDialogComponent, {
      width: '900px',
      data: { account }
    });
  }
}
