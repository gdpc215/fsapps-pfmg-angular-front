import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  standalone: false
})
export class AboutComponent {
  appVersion = '1.0.0';
}
