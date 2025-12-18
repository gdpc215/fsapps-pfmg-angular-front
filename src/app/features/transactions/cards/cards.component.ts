import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { CardService } from '../../../logic/services/card.service';
import { CurrencyService } from '../../../logic/services/currency.service';
import { Card } from '../../../logic/types/card';
import { Currency } from '../../../logic/types/currency';
import { CheckpointDialogComponent } from '../accounts/checkpoint-dialog/checkpoint-dialog.component';
import { CardDialogComponent } from './card-dialog/card-dialog.component';

@Component({
  selector: 'app-cards',
  templateUrl: './cards.component.html',
  standalone: false
})
export class CardsComponent implements OnInit {
  cards$!: Observable<Card[]>;
  currencies: Currency[] = [];

  constructor(
    private cardService: CardService,
    private currencyService: CurrencyService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.cards$ = this.cardService.getCards();
    this.currencyService.getCurrencies().subscribe(currencies => {
      this.currencies = currencies;
    });
  }

  getCurrencyDisplay(currencyId: string): string {
    const currency = this.currencies.find(c => c.id === currencyId);
    return currency ? `${currency.symbol} ${currency.code}` : 'Unknown';
  }

  openAddDialog(): void {
    const dialogRef = this.dialog.open(CardDialogComponent, {
      width: '500px',
      data: { card: null, currencies: this.currencies }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.cardService.addCard(result);
      }
    });
  }

  openEditDialog(card: Card): void {
    const dialogRef = this.dialog.open(CardDialogComponent, {
      width: '500px',
      data: { card: { ...card }, currencies: this.currencies }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.cardService.updateCard(result);
      }
    });
  }

  openCheckpointDialog(card: Card): void {
    const dialogRef = this.dialog.open(CheckpointDialogComponent, {
      width: '400px',
      data: { entity: card, type: 'card' }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result !== undefined && result !== null) {
        this.cardService.setCheckpoint(card.id, result);
      }
    });
  }

  deleteCard(card: Card): void {
    if (confirm(`Are you sure you want to delete ${card.name}?`)) {
      this.cardService.deleteCard(card.id);
    }
  }
}
