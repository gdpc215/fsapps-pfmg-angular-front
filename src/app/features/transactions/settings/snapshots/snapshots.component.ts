import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AccountService } from '../../../../logic/services/account.service';
import { SnapshotService } from '../../../../logic/services/snapshot.service';
import { Account } from '../../../../logic/types/account';
import { BalanceSnapshot } from '../../../../logic/types/balance-snapshot';

@Component({
  selector: 'app-snapshots',
  templateUrl: './snapshots.component.html',
  standalone: false
})
export class SnapshotsComponent implements OnInit {
  form!: FormGroup;
  editForm!: FormGroup;
  accounts: Account[] = [];
  snapshots: BalanceSnapshot[] = [];
  editingSnapshotId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private accountService: AccountService,
    private snapshotService: SnapshotService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      sourceId: ['', Validators.required],
      datetime: [new Date().toISOString().slice(0, 10), Validators.required],
      balance: [0, Validators.required],
      currency: ['PEN', Validators.required]
    });

    this.accountService.getAccounts().subscribe((accounts) => {
      this.accounts = accounts;
    });

    this.snapshotService.getSnapshots().subscribe((snapshots) => {
      this.snapshots = [...snapshots].sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
    });
  }

  submit(): void {
    if (this.form.invalid) {
      return;
    }

    const snapshot = new BalanceSnapshot();
    snapshot.sourceId = this.form.value.sourceId;
    snapshot.datetime = new Date(this.form.value.datetime).toISOString();
    snapshot.balance = Number(this.form.value.balance);
    snapshot.currency = this.form.value.currency;

    this.snapshotService.addSnapshot(snapshot);
    this.form.patchValue({ balance: 0 });
  }

  deleteSnapshot(id: string): void {
    this.snapshotService.deleteSnapshot(id);
  }

  editSnapshot(snapshot: BalanceSnapshot): void {
    this.editingSnapshotId = snapshot.id;
    this.editForm = this.fb.group({
      datetime: [snapshot.datetime.slice(0, 16), Validators.required],
      balance: [snapshot.balance, Validators.required],
      currency: [snapshot.currency, Validators.required]
    });
  }

  saveEdit(snapshot: BalanceSnapshot): void {
    if (this.editForm.invalid) return;
    this.snapshotService.updateSnapshot({
      ...snapshot,
      datetime: new Date(this.editForm.value.datetime).toISOString(),
      balance: Number(this.editForm.value.balance),
      currency: this.editForm.value.currency
    });
    this.editingSnapshotId = null;
  }

  cancelEdit(): void {
    this.editingSnapshotId = null;
  }

  getSourceName(sourceId: string): string {
    const source = this.accounts.find((account) => account.id === sourceId);
    return source ? source.name : 'Unknown source';
  }
}
