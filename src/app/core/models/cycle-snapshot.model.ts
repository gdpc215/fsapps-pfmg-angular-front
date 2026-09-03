import { BaseEntity } from './base.model';

export type SnapshotType = 'SNAPSHOT' | 'CYCLE_CLOSE';

export interface CycleSnapshot extends BaseEntity {
  cardId: string;
  dateSnapshot: string;
  decBalanceAtSnapshot: number;
  strType: SnapshotType;
}
