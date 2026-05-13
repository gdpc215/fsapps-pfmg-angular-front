import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CardBalanceSnapshotService } from '../../../../../logic/services/card-balance-snapshot.service';
import { Account } from '../../../../../logic/types/account';
import { CardBalanceSnapshot } from '../../../../../logic/types/card-balance-snapshot';

@Component({
  selector: 'app-snapshots-dialog',
  templateUrl: './snapshots-dialog.component.html',
  standalone: false
})
export class SnapshotsDialogComponent implements OnInit {
  snapshots: CardBalanceSnapshot[] = [];
  form!: FormGroup;
  editingSnapshotId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<SnapshotsDialogComponent>,
    private cardBalanceSnapshotService: CardBalanceSnapshotService,
    @Inject(MAT_DIALOG_DATA) public data: { account: Account }
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      snapshotDate: [this.toDateInputValue(new Date()), Validators.required],
      owedAmount: [0, Validators.required],
      notes: ['']
    });

    this.reloadSnapshots();
  }

  reloadSnapshots(): void {
    this.snapshots = this.cardBalanceSnapshotService.getSnapshotsByAccountId(this.data.account.id);
  }

  startCreate(): void {
    this.editingSnapshotId = null;
    this.form.reset({
      snapshotDate: this.toDateInputValue(new Date()),
      owedAmount: 0,
      notes: ''
    });
  }

  startEdit(snapshot: CardBalanceSnapshot): void {
    this.editingSnapshotId = snapshot.id;
    this.form.patchValue({
      snapshotDate: this.toDateInputValue(new Date(snapshot.snapshotDate)),
      owedAmount: snapshot.owedAmount,
      notes: snapshot.notes || ''
    });
  }

  onSave(): void {
    if (this.form.invalid) {
      return;
    }

    // Parse as local time (not UTC) by appending T00:00:00 — otherwise
    // date-only ISO strings are treated as UTC midnight and shift back one day
    // in negative-offset timezones.
    const parsedDate = new Date(`${this.form.value.snapshotDate}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
      return;
    }

    if (this.editingSnapshotId) {
      const existing = this.cardBalanceSnapshotService.getSnapshotById(this.editingSnapshotId);
      if (!existing) {
        return;
      }

      const updated = new CardBalanceSnapshot();
      updated.id = existing.id;
      updated.accountId = existing.accountId;
      updated.snapshotDate = parsedDate;
      updated.owedAmount = Number(this.form.value.owedAmount);
      updated.delta = existing.delta ?? 0;
      updated.notes = this.form.value.notes || '';
      updated.createdAt = existing.createdAt;
      updated.updatedAt = new Date();

      this.cardBalanceSnapshotService.updateSnapshot(updated);
    } else {
      const snapshot = new CardBalanceSnapshot();
      snapshot.accountId = this.data.account.id;
      snapshot.snapshotDate = parsedDate;
      snapshot.owedAmount = Number(this.form.value.owedAmount);
      snapshot.delta = 0;
      snapshot.notes = this.form.value.notes || '';
      this.cardBalanceSnapshotService.addSnapshot(snapshot);
    }

    this.startCreate();
    this.reloadSnapshots();
  }

  deleteSnapshot(snapshot: CardBalanceSnapshot): void {
    if (!confirm('Are you sure you want to delete this snapshot?')) {
      return;
    }

    this.cardBalanceSnapshotService.deleteSnapshot(snapshot.id);
    this.reloadSnapshots();

    if (this.editingSnapshotId === snapshot.id) {
      this.startCreate();
    }
  }

  onClose(): void {
    this.dialogRef.close(true);
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
