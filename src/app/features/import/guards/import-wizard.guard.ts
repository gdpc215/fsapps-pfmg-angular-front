import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { map } from 'rxjs/operators';
import { ImportWizardComponent } from '../pages/import-wizard/import-wizard.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ImportWizardStateService } from '../state/import-wizard-state.service';

@Injectable({ providedIn: 'root' })
export class ImportWizardGuard implements CanDeactivate<ImportWizardComponent> {
  constructor(
    private stateService: ImportWizardStateService,
    private dialog: MatDialog
  ) {}

  canDeactivate() {
    const state = this.stateService.getState();
    if (state.annotatedRows.length === 0) return true;

    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          title: 'Leave import?',
          message: 'You have an import in progress. Leaving will discard your progress.',
          confirmLabel: 'Leave',
          danger: true,
        },
      }
    );
    return ref.afterClosed().pipe(map(result => {
      if (result) this.stateService.reset();
      return !!result;
    }));
  }
}
