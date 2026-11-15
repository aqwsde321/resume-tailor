import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
const spawn = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawn }));
import { runClaudeJson } from "@/server/claude-client";
function childResult(output: unknown, exitCode = 0) {
  const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), stdin: { end: vi.fn(), on: vi.fn() }, kill: vi.fn() });
  spawn.mockImplementation(() => { queueMicrotask(() => { child.stdout.write(JSON.stringify(output)); child.emit("close", exitCode); }); return child; });
  return child;
}
afterEach(() => { vi.restoreAllMocks(); });
describe("Claude Code JSON 실행", () => {
  it("원문은 stdin으로 전달하고 구조화 JSON 결과를 읽는다", async () => {
    const child = childResult({ type: "result", is_error: false, structured_output: { summary: "정리됨" } });
    const result = await runClaudeJson({ prompt: "비공개 이력서", outputSchema: { type: "object" }, model: "sonnet", modelReasoningEffort: "high" });
    expect(result).toEqual({ summary: "정리됨" });
    expect(child.stdin.end).toHaveBeenCalledWith("비공개 이력서");
    const args = spawn.mock.calls[0][1];
    expect(args).toContain("--json-schema");
    expect(args).toContain("--no-session-persistence");
    expect(args).toContain("sonnet");
    expect(args).not.toContain("비공개 이력서");
  });
  it("인증 오류를 Codex 오류로 잘못 안내하지 않는다", async () => {
    childResult({ is_error: true, result: "Not logged in. Please run /login" }, 1);
    await expect(runClaudeJson({ prompt: "test", outputSchema: {} })).rejects.toMatchObject({ status: 401, message: "Claude Code 인증이 필요합니다." });
  });
  it("실행 중 취소 신호를 받으면 프로세스를 종료한다", async () => {
    const child = childResult({ structured_output: {} });
    const controller = new AbortController(); controller.abort();
    await expect(runClaudeJson({ prompt: "test", outputSchema: {}, signal: controller.signal })).rejects.toThrow(/중단/);
    expect(child.stdin.end).not.toHaveBeenCalled();
  });
});

it("진행 중 취소는 CLI에 종료 신호를 보내고 비공개 오류 원문을 노출하지 않는다", async () => {
  const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), stdin: { end: vi.fn(), on: vi.fn() }, kill: vi.fn() });
  spawn.mockReturnValue(child);
  const controller = new AbortController();
  const run = runClaudeJson({ prompt: "비공개 이력서", outputSchema: {}, signal: controller.signal });
  const rejected = expect(run).rejects.toMatchObject({ status: 499 });
  await vi.waitFor(() => expect(child.stdin.end).toHaveBeenCalled());
  controller.abort(); child.emit("close", null);
  await rejected;
  expect(child.kill).toHaveBeenCalledWith("SIGTERM");
});
