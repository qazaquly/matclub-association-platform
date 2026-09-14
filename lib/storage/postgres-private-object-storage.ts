import { getDb } from "@/db";
import type { PrivateObjectStorage } from "./private-object-storage";

export class PostgresPrivateObjectStorage implements PrivateObjectStorage {
  async put(key: string, body: ArrayBuffer) {
    const bytes = new Uint8Array(body);
    await getDb().privateObject.create({ data: { objectKey: key, body: bytes } });
  }

  async get(key: string) {
    const object = await getDb().privateObject.findUnique({ where: { objectKey: key } });
    return object ? { body: new Uint8Array(object.body) } : null;
  }

  async delete(key: string) {
    await getDb().privateObject.deleteMany({ where: { objectKey: key } });
  }
}
