import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DuplicationCollectionService } from '../../services/duplication-collection.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DuplicationCollection } from '../../../../core/models/duplication-collection.model';

@Component({
  selector: 'app-duplication-collection-list',
  standalone: false,
  templateUrl: './duplication-collection-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DuplicationCollectionListComponent {
  collections$ = this.collectionService.collections$;

  newCollectionName = '';
  editingCollectionId: string | null = null;
  editingCollectionName = '';
  newStringInputs: Record<string, string> = {};

  constructor(
    private collectionService: DuplicationCollectionService,
    private dialog: MatDialog,
    private snackbar: SnackbarService,
  ) {}

  addCollection(): void {
    const name = this.newCollectionName.trim();
    if (!name) return;
    this.collectionService.save({ strName: name, strings: [] });
    this.newCollectionName = '';
  }

  startEditName(col: DuplicationCollection): void {
    this.editingCollectionId = col.id;
    this.editingCollectionName = col.strName;
  }

  saveEditName(col: DuplicationCollection): void {
    const name = this.editingCollectionName.trim();
    if (!name) return;
    this.collectionService.save({ ...col, strName: name });
    this.editingCollectionId = null;
  }

  cancelEditName(): void { this.editingCollectionId = null; }

  addString(col: DuplicationCollection): void {
    const str = (this.newStringInputs[col.id] || '').trim();
    if (!str || col.strings.includes(str)) return;
    this.collectionService.save({ ...col, strings: [...col.strings, str] });
    this.newStringInputs[col.id] = '';
  }

  removeString(col: DuplicationCollection, str: string): void {
    this.collectionService.save({ ...col, strings: col.strings.filter(s => s !== str) });
  }

  deleteCollection(col: DuplicationCollection): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          title: 'Delete collection?',
          message: `Remove collection '${col.strName}'? Rows using this collection will no longer be detected by the P3 rule.`,
          danger: true,
        },
      }
    );
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.collectionService.delete(col.id);
        this.snackbar.success('Collection deleted.');
      }
    });
  }
}
