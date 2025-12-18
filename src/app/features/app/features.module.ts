import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CatalogRoutes as routectlg } from '../../application/app.routes.catalog';
import { SharedModule } from '../../shared/shared.module';
import { AboutComponent } from './about/about.component';
import { HomeComponent } from './home/home.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: routectlg.HOME },
  { path: routectlg.HOME, component: HomeComponent },
  { path: routectlg.ABOUT, component: AboutComponent }
];

@NgModule({
  declarations: [
    HomeComponent,
    AboutComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class FeaturesModule { }
