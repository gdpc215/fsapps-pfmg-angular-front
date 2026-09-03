import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SettingsService } from '../../../../core/services/settings.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

@Component({
  selector: 'app-app-settings',
  standalone: false,
  templateUrl: './app-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppSettingsComponent {
  settings$ = this.settingsService.settings$;

  constructor(
    private settingsService: SettingsService,
    private snackbar: SnackbarService,
  ) {}

  onP2Toggle(enabled: boolean): void {
    this.settingsService.saveSettings({ boolP2RuleEnabled: enabled });
    this.snackbar.success(enabled ? 'P2 rule enabled.' : 'P2 rule disabled.');
  }
}
