import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-amount-display',
  standalone: false,
  template: `
    <span [class.text-red-600]="value < 0" [class.text-green-600]="value > 0">
      {{ value | currencyPen:true }}
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmountDisplayComponent {
  @Input() value: number = 0;
}
