import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MovementService } from '../../../../../logic/services/movement.service';
import { Account } from '../../../../../logic/types/account';
import { Transaction } from '../../../../../logic/types/transaction';

export interface CycleSummaryDialogData {
  account: Account;
}

@Component({
  selector: 'app-cycle-summary-dialog',
  templateUrl: './cycle-summary-dialog.component.html',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatDividerModule]
})
export class CycleSummaryDialogComponent implements OnInit {
  cycleStart!: Date;
  cycleEnd!: Date;
  daysUntilClosing!: number;
  cycleMovements: Transaction[] = [];
  totalSpent = 0;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: CycleSummaryDialogData,
    private dialogRef: MatDialogRef<CycleSummaryDialogComponent>,
    private movementService: MovementService
  ) {}

  ngOnInit(): void {
    this.computeCycleRange();
    this.loadCycleMovements();
  }

  private computeCycleRange(): void {
    const today = new Date();
    const billingDay = this.data.account.billingDate ?? 1;

    // Determine if the billing day has already passed this month
    let cycleStart: Date;
    if (today.getDate() >= billingDay) {
      cycleStart = new Date(today.getFullYear(), today.getMonth(), billingDay);
    } else {
      cycleStart = new Date(today.getFullYear(), today.getMonth() - 1, billingDay);
    }

    const cycleEnd = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, billingDay);

    this.cycleStart = cycleStart;
    this.cycleEnd = cycleEnd;

    const msPerDay = 1000 * 60 * 60 * 24;
    this.daysUntilClosing = Math.ceil((cycleEnd.getTime() - today.getTime()) / msPerDay);
  }

  private loadCycleMovements(): void {
    const all = this.movementService.getMovementsByAccountOrCard(this.data.account.id);
    const from = this.cycleStart.getTime();
    const to = this.cycleEnd.getTime();

    this.cycleMovements = all
      .filter(m => {
        const d = new Date(m.date).getTime();
        return d >= from && d < to;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    this.totalSpent = this.cycleMovements.reduce((sum, m) => sum + m.amount, 0);
  }

  close(): void {
    this.dialogRef.close();
  }
}
