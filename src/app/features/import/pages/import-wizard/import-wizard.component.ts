import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-import-wizard',
  standalone: false,
  templateUrl: './import-wizard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportWizardComponent {}
