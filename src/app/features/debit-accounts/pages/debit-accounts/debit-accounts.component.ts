import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-debit-accounts',
  standalone: false,
  template: '<p class="p-4">{{ title }} — coming soon</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DebitAccountsComponent {
  title = 'Debit Accounts';
}
