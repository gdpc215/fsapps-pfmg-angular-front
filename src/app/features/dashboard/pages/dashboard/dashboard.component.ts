import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: false,
  template: '<p class="p-4">{{ title }} — coming soon</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  title = 'Dashboard';
}
