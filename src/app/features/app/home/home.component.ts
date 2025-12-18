import { Component } from '@angular/core';
import { TestService } from '../../../logic/services/test.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  standalone: false
})
export class HomeComponent {

  constructor(
    private testService: TestService
  ) { }

  welcomeMessage = 'Welcome to our application!';
}
