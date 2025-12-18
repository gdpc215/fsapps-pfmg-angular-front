import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-error',
  templateUrl: './error.component.html',
  standalone: true,
  imports: [CommonModule, RouterModule]

})
export class ErrorComponent {
  errorMessage = 'Oops! Something went wrong.';
}
