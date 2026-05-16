export interface DataStore<T> {
  load(): T;
  save(data: T): void;
  exportJson(data: T): void;
}
