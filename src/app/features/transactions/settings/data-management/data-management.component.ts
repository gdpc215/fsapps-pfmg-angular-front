import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { StorageService } from '../../../../logic/services/storage.service';

@Component({
  selector: 'app-data-management',
  templateUrl: './data-management.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatInputModule, MatSnackBarModule]
})
export class DataManagementComponent {
  importText = '';
  importErrors: string[] = [];

  constructor(private storageService: StorageService, private snackBar: MatSnackBar) {}

  exportState(): void {
    const json = this.storageService.exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pfmg-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.snackBar.open('Backup downloaded successfully.', 'OK', { duration: 4000 });
  }

  importState(): void {
    this.importErrors = [];
    const result = this.storageService.importAll(this.importText);
    if (result.success) {
      this.importText = '';
      this.snackBar.open('Data imported successfully. Reload the app to see changes.', 'OK', { duration: 6000 });
    } else {
      this.importErrors = result.errors;
      this.snackBar.open('Import failed. Check errors below.', 'Close', { duration: 4000 });
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      this.importText = e.target?.result as string;
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    input.value = '';
  }
}
