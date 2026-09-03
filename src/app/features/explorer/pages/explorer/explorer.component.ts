import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-explorer',
  standalone: false,
  template: '<p class="p-4">{{ title }} — coming soon</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExplorerComponent {
  title = 'Explorer';
}
