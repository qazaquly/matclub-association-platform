import { getDb } from "@/db";
import type { PublicObjectStorage } from "./public-object-storage";

export class PostgresPublicObjectStorage implements PublicObjectStorage {
  async put(key: string, body: ArrayBuffer) {
    await getDb().publicObject.create({ data: { objectKey: key, body: new Uint8Array(body) } });
  }

  async get(key: string) {
    const object = await getDb().publicObject.findUnique({ where: { objectKey: key } });
    return object ? { body: new Uint8Array(object.body) } : null;
  }

  async delete(key: string) {
    await getDb().publicObject.deleteMany({ where: { objectKey: key } });
  }
}
