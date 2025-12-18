import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false
})
export class AppComponent implements OnInit {
  title = 'fsapps-pfmg-front';
  projectId = 'PFMG';

  constructor(
    protected router: Router,
  ) {
    
  }

  ngOnInit() {
    
  }
}
