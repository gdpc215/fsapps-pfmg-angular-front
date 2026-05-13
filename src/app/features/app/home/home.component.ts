import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  standalone: false
})
export class HomeComponent {

  constructor(
  ) { }

  welcomeMessage = 'Welcome to our application!';
}
