import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { SavingsGoalService } from '../../../../logic/services/savings-goal.service';
import { SavingsGoal } from '../../../../logic/types/savings-goal';
import { ContributionDialogComponent } from './contribution-dialog/contribution-dialog.component';
import { GoalDialogComponent } from './goal-dialog/goal-dialog.component';

@Component({
  selector: 'app-savings-goals',
  templateUrl: './savings-goals.component.html',
  standalone: false
})
export class SavingsGoalsComponent implements OnInit {
  goals: SavingsGoal[] = [];

  constructor(
    private savingsGoalService: SavingsGoalService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.savingsGoalService.getGoals().subscribe(goals => {
      this.goals = goals;
    });
  }

  getTotalContributions(goal: SavingsGoal): number {
    return this.savingsGoalService.getTotalContributions(goal);
  }

  getProgressPercent(goal: SavingsGoal): number {
    return this.savingsGoalService.getProgressPercent(goal);
  }

  openGoalDialog(goal: SavingsGoal | null = null): void {
    const dialogRef = this.dialog.open(GoalDialogComponent, {
      width: '440px',
      data: { goal }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;
      if (goal) {
        this.savingsGoalService.updateGoal({ ...goal, ...result });
      } else {
        const newGoal = new SavingsGoal();
        Object.assign(newGoal, result);
        newGoal.contributions = [];
        this.savingsGoalService.addGoal(newGoal);
      }
    });
  }

  openContributionDialog(goal: SavingsGoal): void {
    const dialogRef = this.dialog.open(ContributionDialogComponent, {
      width: '380px',
      data: { goalName: goal.name }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;
      this.savingsGoalService.addContribution(goal.id, result);
    });
  }

  deleteGoal(goal: SavingsGoal): void {
    if (confirm(`Delete goal "${goal.name}"? This cannot be undone.`)) {
      this.savingsGoalService.deleteGoal(goal.id);
    }
  }

  deleteContribution(goal: SavingsGoal, index: number): void {
    this.savingsGoalService.deleteContribution(goal.id, index);
  }
}
