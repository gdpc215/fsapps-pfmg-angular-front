import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-credit-cards',
  standalone: false,
  template: '<p class="p-4">{{ title }} — coming soon</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditCardsComponent {
  title = 'Credit Cards';
}
