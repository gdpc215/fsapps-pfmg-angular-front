import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MonthlyDashboardComponent } from './pages/monthly-dashboard/monthly-dashboard.component';
import { CycleDashboardComponent } from './pages/cycle-dashboard/cycle-dashboard.component';

const routes: Routes = [
  { path: '', redirectTo: 'cycle', pathMatch: 'full' },
  { path: 'monthly', component: MonthlyDashboardComponent },
  { path: 'cycle', component: CycleDashboardComponent },
];

@NgModule({
  declarations: [MonthlyDashboardComponent, CycleDashboardComponent],
  imports: [
    SharedModule,
    RouterModule.forChild(routes),
    MatCardModule,
    MatIconModule,
    MatDividerModule,
    MatTableModule,
    MatButtonModule,
    MatSlideToggleModule,
  ],
})
export class DashboardModule {}
