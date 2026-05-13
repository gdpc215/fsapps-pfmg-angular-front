import { Component, OnInit } from '@angular/core';

interface CycleInfo {
  startDate: Date;
  endDate: Date;
  movementsSum: number;
  interestMovement: Transaction | null;
}
import { MatDialog } from '@angular/material/dialog';
import { AccountService } from '../../../logic/services/account.service';
import { CardBalanceSnapshotService } from '../../../logic/services/card-balance-snapshot.service';
import { CategoryService } from '../../../logic/services/category.service';
import { CurrencyService } from '../../../logic/services/currency.service';
import { MovementService } from '../../../logic/services/movement.service';
import { Account, AccountType } from '../../../logic/types/account';
import { CardBalanceSnapshot } from '../../../logic/types/card-balance-snapshot';
import { Category } from '../../../logic/types/category';
import { Currency } from '../../../logic/types/currency';
import { Transaction, TransactionType } from '../../../logic/types/transaction';
import { SharedModule } from '../../../shared/shared.module';
import { ReconciliationConfirmDialogComponent, ReconciliationConfirmDialogData } from './reconciliation-confirm-dialog/reconciliation-confirm-dialog.component';

@Component({
  selector: 'app-reconciliation-page',
  templateUrl: './reconciliation-page.component.html',
  standalone: true,
  imports: [SharedModule]
})
export class ReconciliationPageComponent implements OnInit {
  creditAccounts: Account[] = [];
  selectedAccount: Account | null = null;
  accountSnapshots: CardBalanceSnapshot[] = [];
  movements: Transaction[] = [];
  currencies: Currency[] = [];
  categories: Category[] = [];

  selectedPreviousSnapshotId: string | null = null;
  currentOwedAmount: number | null = null;
  currentSnapshotDate: string = this.toDateInputValue(new Date());
  snapshotNotes: string = '';
  reconciliationTolerance = 0.01;
  considerLowerDateLimit = true;

  editingSnapshotId: string | null = null;

  pastCycles: CycleInfo[] = [];
  editingCycleMovementId: string | null = null;
  editingInterestAmount: number | null = null;

  constructor(
    private accountService: AccountService,
    private cardBalanceSnapshotService: CardBalanceSnapshotService,
    private categoryService: CategoryService,
    private currencyService: CurrencyService,
    private movementService: MovementService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.accountService.getAccounts().subscribe((accounts) => {
      this.creditAccounts = accounts.filter((a) => a.type === AccountType.CREDIT);
      if (this.creditAccounts.length > 0 && !this.selectedAccount) {
        this.selectedAccount = this.creditAccounts[0];
        this.onAccountSelect();
      }
    });

    this.currencyService.getCurrencies().subscribe((c) => { this.currencies = c; });
    this.categoryService.getCategories().subscribe((c) => { this.categories = c; });
  }

  onAccountSelect(): void {
    if (!this.selectedAccount) {
      this.accountSnapshots = [];
      this.movements = [];
      this.selectedPreviousSnapshotId = null;
      return;
    }

    this.reloadSnapshots();
    this.movements = this.movementService.getMovementsByAccountOrCard(this.selectedAccount.id);
    this.recomputePastCycles();
    this.resetForm();
  }

  private reloadSnapshots(): void {
    if (!this.selectedAccount) { return; }
    this.accountSnapshots = this.cardBalanceSnapshotService.getSnapshotsByAccountId(this.selectedAccount.id);
    if (this.accountSnapshots.length > 0 && !this.selectedPreviousSnapshotId) {
      this.selectedPreviousSnapshotId = this.accountSnapshots[0].id;
    }
  }

  private resetForm(): void {
    this.currentOwedAmount = null;
    this.currentSnapshotDate = this.toDateInputValue(new Date());
    this.snapshotNotes = '';
    this.editingSnapshotId = null;
    this.selectedPreviousSnapshotId = this.accountSnapshots.length > 0 ? this.accountSnapshots[0].id : null;
  }

  // ─── Computed getters ────────────────────────────────────────────────────────

  get selectedPreviousSnapshot(): CardBalanceSnapshot | null {
    if (!this.selectedPreviousSnapshotId) { return null; }
    return this.accountSnapshots.find((s) => s.id === this.selectedPreviousSnapshotId) || null;
  }

  get cycleClosingDateInWindow(): Date | null {
    const prev = this.selectedPreviousSnapshot;
    if (!prev) { return null; }

    const prevDate = new Date(prev.snapshotDate);
    const currDate = this.parseLocalDate(this.currentSnapshotDate);
    if (Number.isNaN(prevDate.getTime()) || Number.isNaN(currDate.getTime())) { return null; }

    return this.resolveCycleClosingDateInRange(prevDate, currDate);
  }

  get movementsSumFromSelectedSnapshot(): number {
    const prev = this.selectedPreviousSnapshot;
    if (!prev) { return 0; }

    const prevTime = new Date(prev.snapshotDate).getTime();
    const currTime = this.parseLocalDate(this.currentSnapshotDate).getTime();
    const upperBound = Number.isNaN(currTime) ? Number.POSITIVE_INFINITY : currTime;

    return this.roundTo2(
      this.movements
        .filter((m) => this.isMovementWithinRange(m, upperBound, prevTime))
        .reduce((sum, m) => sum + (m.amountPen ?? m.amount), 0)
    );
  }

  get movementsSumUntilCycleClose(): number {
    const prev = this.selectedPreviousSnapshot;
    const cycleClose = this.cycleClosingDateInWindow;
    if (!prev || !cycleClose) { return 0; }

    const prevTime = new Date(prev.snapshotDate).getTime();
    const cycleCloseTime = cycleClose.getTime();

    return this.roundTo2(
      this.movements
        .filter((m) => this.isMovementWithinRange(m, cycleCloseTime, prevTime))
        .reduce((sum, m) => sum + (m.amountPen ?? m.amount), 0)
    );
  }

  get snapshotBalanceDelta(): number | null {
    const prev = this.selectedPreviousSnapshot;
    if (!prev || this.currentOwedAmount === null || Number.isNaN(Number(this.currentOwedAmount))) {
      return null;
    }

    return this.roundTo2(
      (prev.owedAmount + this.getCarriedDeltaUntilSnapshot(prev)) - Number(this.currentOwedAmount)
    );
  }

  get snapshotMovementsDifference(): number | null {
    if (this.snapshotBalanceDelta === null) { return null; }
    return this.roundTo2(this.snapshotBalanceDelta + this.movementsSumFromSelectedSnapshot);
  }

  get cycleOpeningBalancePen(): number | null {
    const prev = this.selectedPreviousSnapshot;
    const cycleClose = this.cycleClosingDateInWindow;
    if (!prev || !cycleClose || this.snapshotMovementsDifference === null) { return null; }

    return this.roundTo2(prev.owedAmount + this.movementsSumUntilCycleClose + this.snapshotMovementsDifference);
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  onSaveSnapshot(): void {
    const prev = this.selectedPreviousSnapshot;
    if (!prev) {
      alert('Select a previous snapshot as baseline.');
      return;
    }
    if (this.currentOwedAmount === null || Number.isNaN(Number(this.currentOwedAmount))) {
      alert('Enter the current owed amount.');
      return;
    }

    const currentDate = this.parseLocalDate(this.currentSnapshotDate);
    if (Number.isNaN(currentDate.getTime())) {
      alert('Enter a valid current owed date.');
      return;
    }

    const cycleClose = this.resolveCycleClosingDateInRange(new Date(prev.snapshotDate), currentDate);
    const prevTime = new Date(prev.snapshotDate).getTime();
    const currTime = currentDate.getTime();

    const movementsTotal = this.movements
      .filter((m) => this.isMovementWithinRange(m, currTime, prevTime))
      .reduce((sum, m) => sum + (m.amountPen ?? m.amount), 0);

    const prevWithDelta = prev.owedAmount + this.getCarriedDeltaUntilSnapshot(prev);
    const expectedOwed = this.roundTo2(prevWithDelta + movementsTotal);
    const currentDelta = this.roundTo2(Number(this.currentOwedAmount) - expectedOwed);

    const accumulatedRangeDelta = this.accountSnapshots
      .filter((s) => s.id !== prev.id)
      .filter((s) => {
        const t = new Date(s.snapshotDate).getTime();
        return t > prevTime && t <= currTime;
      })
      .reduce((sum, s) => sum + (s.delta ?? 0), 0);

    const delta = this.roundTo2(currentDelta + accumulatedRangeDelta);
    const hasClosedCycle = !!cycleClose && currentDate.getTime() > cycleClose.getTime();

    if (!hasClosedCycle || Math.abs(delta) < this.reconciliationTolerance) {
      this.persistSnapshot(currentDate, Number(this.currentOwedAmount), delta);
      return;
    }

    const dialogData: ReconciliationConfirmDialogData = {
      accountName: this.selectedAccount!.name,
      previousOwedAmount: prev.owedAmount,
      previousSnapshotDate: new Date(prev.snapshotDate),
      movementsTotal: this.roundTo2(movementsTotal),
      expectedCurrentOwed: expectedOwed,
      currentOwedAmount: Number(this.currentOwedAmount),
      delta
    };

    this.dialog.open(ReconciliationConfirmDialogComponent, {
      width: '560px',
      data: dialogData
    }).afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        const adjustmentDate = cycleClose || currentDate;
        const interestMovement = this.buildInterestAdjustmentMovement(delta, adjustmentDate);
        this.movementService.addMovement(interestMovement as any);
        this.movements = this.movementService.getMovementsByAccountOrCard(this.selectedAccount!.id);
        this.recomputePastCycles();
        this.persistSnapshot(currentDate, Number(this.currentOwedAmount), 0);
      } else {
        this.persistSnapshot(currentDate, Number(this.currentOwedAmount), delta);
      }
    });
  }

  onEditSnapshot(snapshot: CardBalanceSnapshot): void {
    this.editingSnapshotId = snapshot.id;
    this.selectedPreviousSnapshotId = this.accountSnapshots.find(
      (s) => new Date(s.snapshotDate).getTime() < new Date(snapshot.snapshotDate).getTime()
    )?.id ?? null;
    this.currentOwedAmount = snapshot.owedAmount;
    this.currentSnapshotDate = this.toDateInputValue(new Date(snapshot.snapshotDate));
    this.snapshotNotes = snapshot.notes || '';
  }

  onDeleteSnapshot(snapshot: CardBalanceSnapshot): void {
    if (!confirm(`Delete snapshot from ${this.toDateInputValue(new Date(snapshot.snapshotDate))}?`)) {
      return;
    }
    this.cardBalanceSnapshotService.deleteSnapshot(snapshot.id);
    this.reloadSnapshots();
    if (this.editingSnapshotId === snapshot.id) {
      this.resetForm();
    }
  }

  onCancelEdit(): void {
    this.resetForm();
  }

  onEditCycleInterest(cycle: CycleInfo): void {
    if (!cycle.interestMovement) { return; }
    this.editingCycleMovementId = cycle.interestMovement.id;
    this.editingInterestAmount = cycle.interestMovement.amountPen ?? cycle.interestMovement.amount;
  }

  onSaveCycleInterest(cycle: CycleInfo): void {
    if (!cycle.interestMovement || this.editingInterestAmount === null) { return; }
    const updated = new Transaction();
    Object.assign(updated, cycle.interestMovement);
    const newAmount = Number(this.editingInterestAmount);
    updated.amount = newAmount;
    updated.amountPen = newAmount;
    updated.notes = `Delta adjustment based on owed snapshots. Amount manually adjusted to: ${newAmount.toFixed(2)}`;
    this.movementService.updateMovement(updated);
    this.movements = this.movementService.getMovementsByAccountOrCard(this.selectedAccount!.id);
    this.recomputePastCycles();
    this.editingCycleMovementId = null;
    this.editingInterestAmount = null;
  }

  onCancelCycleEdit(): void {
    this.editingCycleMovementId = null;
    this.editingInterestAmount = null;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private persistSnapshot(date: Date, owedAmount: number, delta: number): void {
    const notes = this.snapshotNotes || 'Snapshot checkpoint';
    const targetDateKey = this.toDateInputValue(date);
    const existingOnDate = this.cardBalanceSnapshotService
      .getSnapshotsByAccountId(this.selectedAccount!.id)
      .find((s) => this.toDateInputValue(new Date(s.snapshotDate)) === targetDateKey);

    if (this.editingSnapshotId) {
      const toUpdate = this.accountSnapshots.find((s) => s.id === this.editingSnapshotId);
      if (toUpdate) {
        const updated = new CardBalanceSnapshot();
        updated.id = toUpdate.id;
        updated.accountId = toUpdate.accountId;
        updated.snapshotDate = date;
        updated.owedAmount = owedAmount;
        updated.delta = delta;
        updated.notes = notes;
        updated.createdAt = toUpdate.createdAt;
        updated.updatedAt = new Date();
        this.cardBalanceSnapshotService.updateSnapshot(updated);
      }
    } else if (existingOnDate) {
      const updated = new CardBalanceSnapshot();
      updated.id = existingOnDate.id;
      updated.accountId = existingOnDate.accountId;
      updated.snapshotDate = date;
      updated.owedAmount = owedAmount;
      updated.delta = delta;
      updated.notes = notes;
      updated.createdAt = existingOnDate.createdAt;
      updated.updatedAt = new Date();
      this.cardBalanceSnapshotService.updateSnapshot(updated);
    } else {
      this.cardBalanceSnapshotService.addSnapshot({
        accountId: this.selectedAccount!.id,
        snapshotDate: date,
        owedAmount,
        delta,
        notes
      });
    }

    this.reloadSnapshots();
    this.resetForm();
  }

  private buildInterestAdjustmentMovement(delta: number, date: Date): Transaction {
    const movement = new Transaction();
    movement.accountOrCardId = this.selectedAccount!.id;
    movement.date = date;
    movement.payee = this.selectedAccount!.name;
    movement.bankDescription = 'Interest reconciliation adjustment';
    movement.additionalInfo = 'Auto-generated from snapshot reconciliation';
    movement.notes = `Delta adjustment based on owed snapshots. Delta: ${delta.toFixed(2)}`;
    movement.amount = delta;

    const currencyCode = this.getSelectedAccountCurrencyCode();
    movement.currency = currencyCode;
    const currencyEntry = this.currencies.find((c) => c.code === currencyCode);
    if (currencyCode === 'PEN') {
      movement.amountPen = movement.amount;
      movement.exchangeRate = undefined;
    } else {
      movement.exchangeRate = currencyEntry?.conversionRate;
      movement.amountPen = movement.amount * (movement.exchangeRate ?? 1);
    }

    movement.type = TransactionType.INTEREST;
    movement.isStub = true;

    const categoryPair = this.getAdjustmentCategoryIds();
    movement.categoryId = categoryPair.categoryId;
    movement.subcategoryId = categoryPair.subcategoryId;

    return movement;
  }

  private getAdjustmentCategoryIds(): { categoryId: string | null; subcategoryId: string | null } {
    const chargesAndFees = this.categories.find((c) => c.name.toLowerCase() === 'charges & fees');
    if (chargesAndFees?.parentId) {
      return { categoryId: chargesAndFees.parentId, subcategoryId: chargesAndFees.id };
    }

    const financialMovements = this.categories.find(
      (c) => c.name.toLowerCase() === 'financial movements' && c.parentId === null
    );
    if (financialMovements) {
      return { categoryId: financialMovements.id, subcategoryId: null };
    }

    return { categoryId: null, subcategoryId: null };
  }

  private getSelectedAccountCurrencyCode(): string {
    if (!this.selectedAccount) { return 'PEN'; }
    const currency = this.currencies.find((c) => c.id === this.selectedAccount!.currencyId);
    return currency?.code || 'PEN';
  }

  private getCarriedDeltaUntilSnapshot(snapshot: CardBalanceSnapshot): number {
    const snapshotTime = new Date(snapshot.snapshotDate).getTime();
    if (Number.isNaN(snapshotTime)) { return snapshot.delta ?? 0; }

    const latestCycleClose = this.getLatestCycleCloseOnOrBefore(new Date(snapshot.snapshotDate));
    const latestCycleCloseTime = latestCycleClose?.getTime();

    return this.roundTo2(
      this.accountSnapshots
        .filter((s) => {
          const t = new Date(s.snapshotDate).getTime();
          if (Number.isNaN(t) || t > snapshotTime) { return false; }
          if (latestCycleCloseTime === undefined) { return true; }
          return t > latestCycleCloseTime;
        })
        .reduce((sum, s) => sum + (s.delta ?? 0), 0)
    );
  }

  private resolveCycleClosingDateInRange(previousDate: Date, currentDate: Date): Date | null {
    const billingDay = this.selectedAccount?.billingDate;
    if (!billingDay || billingDay < 1 || billingDay > 31) { return null; }

    const candidate = this.safeDate(currentDate.getFullYear(), currentDate.getMonth(), billingDay);
    if (candidate.getTime() > currentDate.getTime()) {
      candidate.setMonth(candidate.getMonth() - 1);
      const adjusted = this.safeDate(candidate.getFullYear(), candidate.getMonth(), billingDay);
      adjusted.setHours(0, 0, 0, 0);
      return adjusted.getTime() > previousDate.getTime() && adjusted.getTime() <= currentDate.getTime()
        ? adjusted : null;
    }

    candidate.setHours(0, 0, 0, 0);
    return candidate.getTime() > previousDate.getTime() && candidate.getTime() <= currentDate.getTime()
      ? candidate : null;
  }

  private getLatestCycleCloseOnOrBefore(date: Date): Date | null {
    const billingDay = this.selectedAccount?.billingDate;
    if (!billingDay || billingDay < 1 || billingDay > 31) { return null; }

    const normalizedDate = new Date(date);
    normalizedDate.setHours(23, 59, 59, 999);

    let candidate = this.safeDate(normalizedDate.getFullYear(), normalizedDate.getMonth(), billingDay);
    candidate.setHours(0, 0, 0, 0);

    if (candidate.getTime() > normalizedDate.getTime()) {
      candidate = this.safeDate(candidate.getFullYear(), candidate.getMonth() - 1, billingDay);
      candidate.setHours(0, 0, 0, 0);
    }

    return candidate;
  }

  private safeDate(year: number, month: number, day: number): Date {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(day, daysInMonth));
  }

  private isMovementWithinRange(
    movement: Pick<Transaction, 'date'>,
    upperBoundTime: number,
    lowerBoundTime?: number
  ): boolean {
    const movementDate = movement.date instanceof Date
      ? movement.date.getTime()
      : new Date(`${movement.date}T00:00:00`).getTime();

    if (Number.isNaN(movementDate) || movementDate > upperBoundTime) { return false; }

    if (!this.considerLowerDateLimit || lowerBoundTime === undefined) { return true; }

    const lowerBoundEndOfDay = new Date(lowerBoundTime);
    lowerBoundEndOfDay.setHours(23, 59, 59, 999);
    return movementDate > lowerBoundEndOfDay.getTime();
  }

  private roundTo2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseLocalDate(dateString: string): Date {
    return new Date(`${dateString}T00:00:00`);
  }

  private recomputePastCycles(): void {
    this.pastCycles = this.buildPastCycles();
  }

  private buildPastCycles(): CycleInfo[] {
    const billingDay = this.selectedAccount?.billingDate;
    if (!billingDay) { return []; }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let cycleEndDay = this.safeDate(today.getFullYear(), today.getMonth(), billingDay);
    cycleEndDay.setHours(0, 0, 0, 0);

    if (cycleEndDay.getTime() > today.getTime()) {
      cycleEndDay = this.safeDate(today.getFullYear(), today.getMonth() - 1, billingDay);
      cycleEndDay.setHours(0, 0, 0, 0);
    }

    const cycles: CycleInfo[] = [];

    for (let i = 0; i < 12; i++) {
      const endDate = new Date(cycleEndDay);
      const endDateUpperBound = new Date(cycleEndDay);
      endDateUpperBound.setHours(23, 59, 59, 999);

      const prevBillingDay = this.safeDate(cycleEndDay.getFullYear(), cycleEndDay.getMonth() - 1, billingDay);
      const startDate = new Date(prevBillingDay);
      startDate.setDate(startDate.getDate() + 1);
      startDate.setHours(0, 0, 0, 0);

      const cycleMovements = this.movements.filter((m) => {
        const t = m.date instanceof Date
          ? m.date.getTime()
          : new Date(`${m.date}T00:00:00`).getTime();
        return !Number.isNaN(t) && t >= startDate.getTime() && t <= endDateUpperBound.getTime();
      });

      const movementsSum = this.roundTo2(
        cycleMovements
          .filter((m) => m.type !== TransactionType.INTEREST)
          .reduce((sum, m) => sum + (m.amountPen ?? m.amount), 0)
      );

      const interestMovement = cycleMovements.find((m) => m.type === TransactionType.INTEREST) ?? null;

      cycles.push({ startDate, endDate, movementsSum, interestMovement });

      cycleEndDay = new Date(prevBillingDay);
      cycleEndDay.setHours(0, 0, 0, 0);
    }

    return cycles;
  }

  trackByCycle = (_index: number, cycle: CycleInfo): string => {
    return this.toDateInputValue(cycle.endDate);
  };

  trackBySnapshot(_index: number, snapshot: CardBalanceSnapshot): string {
    return snapshot.id;
  }
}
