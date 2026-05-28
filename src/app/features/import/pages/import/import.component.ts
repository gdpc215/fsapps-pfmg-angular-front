import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-import',
  standalone: false,
  template: '<p class="p-4">{{ title }} — coming soon</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportComponent {
  title = 'Import';
}
