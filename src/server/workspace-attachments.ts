import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { WORKSPACE_DIRECTORY } from "@/server/workspace-store";
import { HttpError } from "@/server/http";
const root = path.join(WORKSPACE_DIRECTORY, "attachments");
const MetadataSchema = z.object({ name: z.string(), mime: z.string() }).strict();
export async function saveAttachment(buffer: Buffer, name: string, mime: string) {
  const id = randomUUID();
  await mkdir(root, { recursive: true, mode: 0o700 });
  await writeFile(path.join(root, `${id}.bin`), buffer, { flag: "wx", mode: 0o600 });
  await writeFile(path.join(root, `${id}.json`), JSON.stringify({ name: path.basename(name), mime }), { flag: "wx", mode: 0o600 });
  return id;
}
export async function readAttachment(id: string) {
  if (!z.string().uuid().safeParse(id).success) throw new HttpError(404, "원본 파일을 찾지 못했습니다.");
  try {
    const metadata = MetadataSchema.parse(JSON.parse(await readFile(path.join(root, `${id}.json`), "utf8")));
    return { ...metadata, buffer: await readFile(path.join(root, `${id}.bin`)) };
  } catch { throw new HttpError(404, "원본 파일을 찾지 못했습니다."); }
}
