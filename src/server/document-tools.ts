import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { HttpError } from "@/server/http";
const execute = promisify(execFile);
export async function runDocumentTool(command: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execute(command, args, { timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new HttpError(503, "PDF 추출 도구가 없습니다. Poppler를 설치한 뒤 다시 시도해 주세요.");
    }
    throw new HttpError(422, "파일을 읽지 못했습니다. 손상되거나 암호화된 파일인지 확인해 주세요.");
  }
}
