import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { NgModule, provideExperimentalZonelessChangeDetection } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { FeaturesModule } from '../features/app/features.module';
import { SharedModule } from '../shared/shared.module';
import { AppComponent } from './app.component';
import { AppRoutesModule } from './app.routes.module';


@NgModule({
  declarations: [
    AppComponent,
  ],
  bootstrap: [AppComponent],
  imports: [
    AppRoutesModule,
    BrowserModule,
    BrowserAnimationsModule,
    SharedModule,
    FeaturesModule,
  ],
  providers: [
    provideAnimationsAsync(),
    provideHttpClient(withInterceptorsFromDi()),
    provideExperimentalZonelessChangeDetection(),
  ]
})
export class AppModule { }