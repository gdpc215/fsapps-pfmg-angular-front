import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Constants } from '../constants';
import { SavingsContribution, SavingsGoal } from '../types/savings-goal';
import { Utilities } from '../utilities';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class SavingsGoalService {
  private goals$ = new BehaviorSubject<SavingsGoal[]>([]);

  constructor(private storageService: StorageService) {
    this.load();
  }

  getGoals(): Observable<SavingsGoal[]> {
    return this.goals$.asObservable();
  }

  getCurrentGoals(): SavingsGoal[] {
    return this.goals$.value;
  }

  addGoal(goal: SavingsGoal): void {
    goal.id = Utilities.generateUUID();
    this.save([...this.goals$.value, goal]);
  }

  updateGoal(goal: SavingsGoal): void {
    this.save(this.goals$.value.map(g => g.id === goal.id ? goal : g));
  }

  deleteGoal(id: string): void {
    this.save(this.goals$.value.filter(g => g.id !== id));
  }

  addContribution(goalId: string, contribution: SavingsContribution): void {
    const goals = this.goals$.value.map(g => {
      if (g.id !== goalId) return g;
      return { ...g, contributions: [...g.contributions, contribution] };
    });
    this.save(goals);
  }

  deleteContribution(goalId: string, index: number): void {
    const goals = this.goals$.value.map(g => {
      if (g.id !== goalId) return g;
      return { ...g, contributions: g.contributions.filter((_, i) => i !== index) };
    });
    this.save(goals);
  }

  getTotalContributions(goal: SavingsGoal): number {
    return goal.contributions.reduce((sum, c) => sum + c.amount, 0);
  }

  getProgressPercent(goal: SavingsGoal): number {
    if (goal.targetAmount <= 0) return 0;
    return Math.min((this.getTotalContributions(goal) / goal.targetAmount) * 100, 100);
  }

  private load(): void {
    const cached = this.storageService.get<SavingsGoal[]>(Constants.StorageTags.SAVINGS_GOALS) || [];
    this.goals$.next(cached);
  }

  private save(goals: SavingsGoal[]): void {
    this.storageService.set(Constants.StorageTags.SAVINGS_GOALS, goals);
    this.goals$.next(goals);
  }
}
