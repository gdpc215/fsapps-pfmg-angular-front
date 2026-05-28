import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageWarningBannerComponent } from './components/storage-warning-banner/storage-warning-banner.component';

@NgModule({
  declarations: [StorageWarningBannerComponent],
  imports: [CommonModule],
  exports: [StorageWarningBannerComponent],
})
export class CoreModule {}
