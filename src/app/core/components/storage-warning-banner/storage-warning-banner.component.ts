import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-storage-warning-banner',
  standalone: false,
  templateUrl: './storage-warning-banner.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorageWarningBannerComponent {
  @Input() visible = false;
  dismissed = false;
}
