import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-frame',
  templateUrl: './frame.component.html',
  host: { "class": "flex flex-grow flex-col justify-between" },
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FrameComponent {
  title: string = 'Angular App';
  bottomBarName: string = 'FireSarge Apps © 2024';
}
