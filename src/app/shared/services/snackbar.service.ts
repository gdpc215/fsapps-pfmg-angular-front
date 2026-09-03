import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  constructor(private snackBar: MatSnackBar) {}

  success(message: string): void {
    this.snackBar.open(message, 'Close', { duration: 3000, panelClass: ['snack-success'] });
  }

  error(message: string): void {
    this.snackBar.open(message, 'Close', { duration: 5000, panelClass: ['snack-error'] });
  }

  info(message: string): void {
    this.snackBar.open(message, 'Close', { duration: 4000 });
  }
}
