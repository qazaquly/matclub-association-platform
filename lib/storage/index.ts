import type { PrivateObjectStorage } from "./private-object-storage";
import { PostgresPrivateObjectStorage } from "./postgres-private-object-storage";
import type { PublicObjectStorage } from "./public-object-storage";
import { PostgresPublicObjectStorage } from "./postgres-public-object-storage";

let storage: PrivateObjectStorage | null = null;
let publicStorage: PublicObjectStorage | null = null;

export function getPrivateObjectStorage(): PrivateObjectStorage {
  storage ??= new PostgresPrivateObjectStorage();
  return storage;
}

export function getPublicObjectStorage(): PublicObjectStorage {
  publicStorage ??= new PostgresPublicObjectStorage();
  return publicStorage;
}

export type { PrivateObject, PrivateObjectStorage } from "./private-object-storage";
export type { PublicObject, PublicObjectStorage } from "./public-object-storage";
