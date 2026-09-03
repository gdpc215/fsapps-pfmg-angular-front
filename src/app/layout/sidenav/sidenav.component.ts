import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ROUTES } from '../../application/app.routes.catalog';

@Component({
  selector: 'app-sidenav',
  standalone: false,
  templateUrl: './sidenav.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidenavComponent {
  readonly ROUTES = ROUTES;
}
