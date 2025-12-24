import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Constants } from '../../../../logic/constants';
import { DuplicateDetectionRule } from '../../../../logic/services/movement.service';
import { DuplicateDetectionRulesDialogComponent } from './duplicate-detection-rules-dialog/duplicate-detection-rules-dialog.component';

@Component({
  selector: 'app-duplicate-detection-rules',
  templateUrl: './duplicate-detection-rules.component.html',
  standalone: false
})
export class DuplicateDetectionRulesComponent implements OnInit {
  rules: DuplicateDetectionRule[] = [];

  constructor(private dialog: MatDialog) {}

  ngOnInit(): void {
    this.loadRules();
  }

  loadRules() {
    const rules = localStorage.getItem(Constants.StorageTags.DUPLICATE_DETECTION_RULES);
    this.rules = rules ? JSON.parse(rules) : [];
  }

  openDialog(): void {
    const dialogRef = this.dialog.open(DuplicateDetectionRulesDialogComponent, {
      width: '600px',
      data: { rules: [...this.rules] }
    });
    dialogRef.afterClosed().subscribe(result => {
      // Always reload from local storage to ensure latest rules are shown
      this.loadRules();
    });
  }
}
