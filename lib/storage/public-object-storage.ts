export interface PublicObject {
  body: Uint8Array<ArrayBuffer>;
}

export interface PublicObjectStorage {
  put(key: string, body: ArrayBuffer): Promise<void>;
  get(key: string): Promise<PublicObject | null>;
  delete(key: string): Promise<void>;
}
