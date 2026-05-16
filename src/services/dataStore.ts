export interface DataStore<T> {
  load(): T;
  save(data: T): void;
  exportJson(data: T): void;
  exportFullBackup?(data: T): void;
  exportAiAnalysis?(data: T): void;
  saveRollbackSnapshot?(data: T, reason: string): any;
  getLatestRollback?(): any;
  getRollbacks?(): any[];
  clearRollbacks?(): void;
}
