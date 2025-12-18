import { animate, state, style, transition, trigger } from '@angular/animations';

export const rotateChevronAnimation = trigger('rotateChevron', [
  state('closed', style({ transform: 'rotate(0deg)' })),
  state('open', style({ transform: 'rotate(180deg)' })),
  transition('closed <=> open', [animate('150ms ease-in-out')])
]);
