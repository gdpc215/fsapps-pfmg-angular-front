import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CreditCardService } from '../../../credit-cards/services/credit-card.service';
import { ConciliationService } from '../../services/conciliation.service';

@Component({
  selector: 'app-conciliation-history',
  standalone: false,
  templateUrl: './conciliation-history.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConciliationHistoryComponent {
  cards$ = this.creditCardService.cards$;
  cycleCloses$ = this.conciliationService.cycleCloses$;
  selectedCardId: string | null = null;
  displayedColumns = ['dateClosing', 'card', 'openingBalance', 'closingBalance', 'interest'];

  constructor(
    private creditCardService: CreditCardService,
    private conciliationService: ConciliationService,
  ) {}

  getCardName(cardId: string): string {
    return this.creditCardService.getById(cardId)?.strName ?? cardId;
  }

  filteredCloses(closes: any[]): any[] {
    const sorted = [...closes].sort((a, b) => b.dateClosing.localeCompare(a.dateClosing));
    return this.selectedCardId ? sorted.filter(c => c.cardId === this.selectedCardId) : sorted;
  }
}
