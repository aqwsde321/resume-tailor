import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createEmptyWorkspace, WorkspaceSchema, type Workspace } from "@/entities/workspace/model/workspace";
import { HttpError } from "@/server/http";

export const WORKSPACE_DIRECTORY = path.join(process.cwd(), "private-data", "workspace");
// 스토어를 다시 만들어도 같은 저장 위치의 쓰기는 직렬화한다.
const queues = new Map<string, Promise<unknown>>();

export function createWorkspaceStore(directory = WORKSPACE_DIRECTORY) {
  const root = path.resolve(directory);
  const filename = path.join(root, "workspace.json");
  async function read(): Promise<Workspace> {
    let raw: string;
    try { raw = await readFile(filename, "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return createEmptyWorkspace();
      throw error;
    }
    try { return WorkspaceSchema.parse(JSON.parse(raw)); }
    catch { throw new HttpError(500, "저장된 작업 데이터를 읽지 못했습니다. 백업을 확인해 주세요."); }
  }
  async function save(value: Workspace, expectedRevision: number): Promise<Workspace> {
    const parsed = WorkspaceSchema.parse(value);
    const previous = queues.get(root) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      await mkdir(root, { recursive: true, mode: 0o700 });
      const lock = path.join(root, ".write-lock");
      try { await mkdir(lock); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new HttpError(409, "다른 창에서 저장 중입니다. 다시 저장해 주세요.");
        throw error;
      }
      const temporary = path.join(root, `${randomUUID()}.tmp`);
      try {
        const current = await read();
        if (current.revision !== expectedRevision || parsed.revision !== expectedRevision) {
          throw new HttpError(409, "다른 창에서 작업이 변경됐습니다. 현재 작업을 새로 불러온 후 저장해 주세요.");
        }
        const next = { ...parsed, revision: current.revision + 1 };
        await writeFile(temporary, JSON.stringify(next, null, 2), { mode: 0o600, flag: "wx" });
        await rename(temporary, filename);
        return next;
      } finally {
        await rm(temporary, { force: true });
        await rm(lock, { recursive: true, force: true });
      }
    });
    queues.set(root, operation);
    try { return await operation; }
    finally { if (queues.get(root) === operation) queues.delete(root); }
  }
  return { read, save };
}
