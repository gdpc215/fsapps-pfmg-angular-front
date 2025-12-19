import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { CurrencyService } from '../../../../logic/services/currency.service';
import { Currency } from '../../../../logic/types/currency';
import { CurrencyDialogComponent } from './currency-dialog/currency-dialog.component';

@Component({
  selector: 'app-currencies',
  templateUrl: './currencies.component.html',
  standalone: false
})
export class CurrenciesComponent implements OnInit {
  currencies$!: Observable<Currency[]>;
  displayedColumns = ['code', 'symbol', 'name', 'conversionRate', 'actions'];

  constructor(
    private currencyService: CurrencyService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.currencies$ = this.currencyService.getCurrencies();
  }

  openAddDialog(): void {
    const dialogRef = this.dialog.open(CurrencyDialogComponent, {
      width: '500px',
      data: { currency: null }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.currencyService.addCurrency(result);
      }
    });
  }

  openEditDialog(currency: Currency): void {
    const dialogRef = this.dialog.open(CurrencyDialogComponent, {
      width: '500px',
      data: { currency: { ...currency } }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.currencyService.updateCurrency(result);
      }
    });
  }

  deleteCurrency(currency: Currency): void {
    if (confirm(`Are you sure you want to delete ${currency.name}?`)) {
      this.currencyService.deleteCurrency(currency.id);
    }
  }
}
