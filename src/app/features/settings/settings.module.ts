import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { AppSettingsComponent } from './pages/app-settings/app-settings.component';

const routes: Routes = [
  { path: '', component: AppSettingsComponent },
];

@NgModule({
  declarations: [AppSettingsComponent],
  imports: [
    SharedModule,
    FormsModule,
    RouterModule.forChild(routes),
    MatSlideToggleModule,
    MatCardModule,
    MatDividerModule,
  ],
})
export class SettingsModule {}
