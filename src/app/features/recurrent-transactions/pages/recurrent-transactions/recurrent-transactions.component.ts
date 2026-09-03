import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-recurrent-transactions',
  standalone: false,
  template: '<p class="p-4">{{ title }} — coming soon</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurrentTransactionsComponent {
  title = 'Recurrent Transactions';
}
