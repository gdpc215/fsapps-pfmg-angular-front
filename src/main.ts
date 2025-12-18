// import { bootstrapApplication } from '@angular/platform-browser';
// import { AppComponent } from './app/application/app.component';

// bootstrapApplication(AppComponent)
//   .catch((err) => console.error(err));

import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/application/app.module';

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch(err => console.error(err));