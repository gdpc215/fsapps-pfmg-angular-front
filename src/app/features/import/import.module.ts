import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { ReactiveFormsModule } from '@angular/forms';
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { ImportWizardComponent } from './pages/import-wizard/import-wizard.component';
import { StepUploadComponent } from './pages/step-upload/step-upload.component';
import { StepReviewComponent } from './pages/step-review/step-review.component';
import { StepFinalizeComponent } from './pages/step-finalize/step-finalize.component';
import { ImportWizardGuard } from './guards/import-wizard.guard';

const routes: Routes = [
  { path: '', component: ImportWizardComponent, canDeactivate: [ImportWizardGuard] },
];

@NgModule({
  declarations: [ImportWizardComponent, StepUploadComponent, StepReviewComponent, StepFinalizeComponent],
  imports: [
    SharedModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    MatStepperModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
})
export class ImportModule {}
