import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { SharedModule } from '../../shared/shared.module';
import { GmailSyncComponent } from './pages/gmail-sync/gmail-sync.component';

const routes: Routes = [
  { path: '', component: GmailSyncComponent },
];

@NgModule({
  declarations: [GmailSyncComponent],
  imports: [
    SharedModule,
    FormsModule,
    RouterModule.forChild(routes),
    MatCardModule,
  ],
})
export class GmailSyncModule {}
