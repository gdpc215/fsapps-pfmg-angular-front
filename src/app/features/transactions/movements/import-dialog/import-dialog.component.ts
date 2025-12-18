import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import * as XLSX from 'xlsx';
import { CategoryService } from '../../../../logic/services/category.service';
import { MovementService } from '../../../../logic/services/movement.service';
import { Account } from '../../../../logic/types/account';
import { Card } from '../../../../logic/types/card';
import { Movement } from '../../../../logic/types/movement';

@Component({
  selector: 'app-import-dialog',
  templateUrl: './import-dialog.component.html',
  standalone: false
})
export class ImportDialogComponent {
  selectedEntity: { type: 'account' | 'card', entity: Account | Card } | null = null;
  selectedFile: File | null = null;
  parsedMovements: Movement[] = [];
  newMovements: Movement[] = [];
  previewColumns = ['date', 'description', 'currency', 'amount'];

  constructor(
    private dialogRef: MatDialogRef<ImportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { accounts: Account[], cards: Card[] },
    private movementService: MovementService,
    private categoryService: CategoryService
  ) {}

  onEntitySelect(): void {
    this.selectedFile = null;
    this.parsedMovements = [];
    this.newMovements = [];
  }

  onFileSelect(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    this.selectedFile = file;
    this.parseExcelFile(file);
  }

  parseExcelFile(file: File): void {
    const reader = new FileReader();
    
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Assume first sheet
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false });
      
      this.parsedMovements = this.convertToMovements(jsonData);
      this.detectNewMovements();
    };
    
    reader.readAsArrayBuffer(file);
  }

  convertToMovements(data: any[]): Movement[] {
    if (!this.selectedEntity) return [];

    return data.map(row => {
      const movement = new Movement();
      movement.accountOrCardId = this.selectedEntity!.entity.id;
      
      // Try to parse different date formats
      movement.date = this.parseDate(row['Fecha'] || row['Date'] || row['fecha']);
      movement.description = row['Descripcion'] || row['Description'] || row['descripcion'] || '';
      movement.currency = row['Moneda'] || row['Currency'] || row['moneda'] || '';
      movement.amount = parseFloat(row['Monto'] || row['Amount'] || row['monto'] || '0');
      
      // For accounts, try to get operation number
      if (this.selectedEntity!.type === 'account') {
        movement.operationNumber = row['Operation'] || row['Operacion'] || row['operation'] || null;
      }

      // Apply auto-categorization
      const categoryId = this.categoryService.applyCategoryRules(movement.description);
      if (categoryId) {
        movement.categoryId = categoryId;
      }

      return movement;
    }).filter(m => m.description); // Filter out empty rows
  }

  parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    
    // Try different date formats
    // Format: yyyy-MM-dd or dd/MM/yyyy or MM/dd/yyyy
    const parts = dateStr.split(/[-\/]/);
    
    if (parts.length === 3) {
      // Assume yyyy-MM-dd if first part is 4 digits
      if (parts[0].length === 4) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else {
        // Assume dd/MM/yyyy
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    }
    
    return new Date(dateStr);
  }

  detectNewMovements(): void {
    if (!this.selectedEntity) return;

    const hasOperationNumber = this.selectedEntity.type === 'account';
    this.newMovements = this.movementService.detectNewMovements(
      this.parsedMovements,
      hasOperationNumber
    );
  }

  onImport(): void {
    if (this.newMovements.length > 0) {
      this.movementService.addMovements(this.newMovements);
      this.dialogRef.close(true);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
