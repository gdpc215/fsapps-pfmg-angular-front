import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { AccountService } from '../../../../logic/services/account.service';
import { CurrencyService } from '../../../../logic/services/currency.service';
import { MovementService } from '../../../../logic/services/movement.service';
import { Account, AccountType } from '../../../../logic/types/account';
import { Currency } from '../../../../logic/types/currency';
import { AccountDialogComponent } from './account-dialog/account-dialog.component';
import { CheckpointDialogComponent } from './checkpoint-dialog/checkpoint-dialog.component';
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
    private accountService: AccountService,
    private movementService: MovementService,
    private currencyService: CurrencyService,
    private dialog: MatDialog
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
        this.accountService.setCheckpoint(account.id, result);
      }
    });
  }

  deleteAccount(account: Account): void {
    if (confirm(`Are you sure you want to delete ${account.name}?`)) {
      this.accountService.deleteAccount(account.id);
    }
  }

  recalculateBalance(account: Account): void {
    const movements = this.movementService.getMovementsByAccountOrCard(account.id);
    const totalAmount = movements.reduce((sum, m) => sum + m.amount, 0);
    this.accountService.recalculateBalance(account.id, totalAmount);
  }

  openSnapshotsDialog(account: Account): void {
    this.dialog.open(SnapshotsDialogComponent, {
      width: '900px',
      data: { account }
    });
  }
}
