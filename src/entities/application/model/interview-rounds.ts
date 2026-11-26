import { z } from "zod";
import { ApplicationInterviewPrepSchema } from "./interview-prep";

export const InterviewChecklistItemSchema = z.object({
  id: z.string().uuid(),
  text: z.string().trim().min(1).max(160),
  done: z.boolean(),
}).strict();

export const InterviewRoundSchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  title: z.string().max(100),
  date: z.iso.date().nullable(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  completed: z.boolean(),
  preparation: z.string().max(3000),
  reflection: z.string().max(3000),
  checklist: z.array(InterviewChecklistItemSchema),
  interviewPrep: ApplicationInterviewPrepSchema.nullable(),
}).strict();
export type InterviewRound = z.infer<typeof InterviewRoundSchema>;

export function getInterviewRoundTitle(round: InterviewRound) {
  return round.title.trim() || `${round.number}차 면접`;
}

export function createInterviewRound(rounds: readonly InterviewRound[]): InterviewRound {
  const number = Math.max(0, ...rounds.map((round) => round.number)) + 1;
  return {
    id: crypto.randomUUID(), number, title: `${number}차 면접`, date: null, time: null,
    preparation: "", reflection: "", completed: false, interviewPrep: null,
    checklist: ["장소 또는 접속 링크 확인", "이력서 기반 답변 준비", "회사에 물어볼 질문 정리"].map((text) => ({
      id: crypto.randomUUID(), text, done: false,
    })),
  };
}

export function updateInterviewRound(
  rounds: InterviewRound[],
  id: string,
  update: (round: InterviewRound) => InterviewRound,
): InterviewRound[] {
  const index = rounds.findIndex((round) => round.id === id);
  if (index < 0) return rounds;
  const current = rounds[index];
  const next = update(current);
  return next === current ? rounds : rounds.with(index, next);
}
