export interface PrivateObject {
  body: Uint8Array<ArrayBuffer>;
}

export interface PrivateObjectStorage {
  put(key: string, body: ArrayBuffer): Promise<void>;
  get(key: string): Promise<PrivateObject | null>;
  delete(key: string): Promise<void>;
}
