import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { NgModule, provideExperimentalZonelessChangeDetection } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { CoreModule } from '../core/core.module';
import { LayoutModule } from '../layout/layout.module';
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
    CoreModule,
    LayoutModule,
    SharedModule,
  ],
  providers: [
    provideAnimationsAsync(),
    provideHttpClient(withInterceptorsFromDi()),
    provideExperimentalZonelessChangeDetection(),
  ]
})
export class AppModule { }
