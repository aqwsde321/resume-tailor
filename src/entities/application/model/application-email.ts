import { z } from "zod";
import type { Company } from "@/shared/lib/types";

export const ApplicationEmailDraftSchema = z.object({
  recipient: z.string().max(254),
  subject: z.string().max(200),
  body: z.string().max(4000),
  artifactId: z.string().uuid().nullable(),
}).strict();
export type ApplicationEmailDraft = z.infer<typeof ApplicationEmailDraftSchema>;

const Email = z.email().max(254);
const applicationInstruction = /(?:지원|접수|제출)\s*(?:용\s*)?(?:이메일|e-?mail|메일)|(?:지원서|이력서)\s*(?:제출|접수)|(?:send|submit|email)\s+(?:your\s+)?(?:résumé|resume|cv|application)\b|\bapplication\s+e-?mail\b/i;
const addresses = /[\w.!#$%&'*+/=?^`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export function findApplicationRecipient(text: string): string {
  const candidates = new Map<string, string>();
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!applicationInstruction.test(line)) return;
    const found = line.match(addresses) ?? (
      /[:：]\s*$/.test(line) ? (lines[index + 1] ?? "").match(addresses) : null
    );
    found?.filter((address) => Email.safeParse(address).success)
      .forEach((address) => candidates.set(address.toLowerCase(), address));
  });
  return candidates.size === 1 ? candidates.values().next().value ?? "" : "";
}

export function createApplicationEmailDraft(
  company: Company,
  applicant: string,
  postingText: string,
  artifactId: string | null,
): ApplicationEmailDraft {
  const recipient = findApplicationRecipient(postingText);
  const organization = company.companyName.trim();
  const role = company.jobTitle.trim();
  const name = applicant.trim();
  return {
    recipient,
    subject: [role ? `${role} 지원` : "입사 지원", name].filter(Boolean).join(" · ").replace(/\s+/g, " ").slice(0, 200),
    body: [
      "안녕하세요.",
      `${[organization, role].filter(Boolean).join(" ")}${organization || role ? "에 " : ""}지원${name ? `하는 ${name}입니다.` : "합니다."}`,
      "이력서를 첨부드립니다. 검토해 주셔서 감사합니다.",
      name && `${name} 드림`,
    ].filter(Boolean).join("\n\n").slice(0, 4000),
    artifactId,
  };
}

export function buildApplicationMailto({ recipient, subject, body }: Pick<ApplicationEmailDraft, "recipient" | "subject" | "body">): string | null {
  const address = recipient.trim();
  if (!Email.safeParse(address).success || /[\r\n]/.test(subject) || !subject.trim() || !body.trim()) return null;
  const encodedAddress = encodeURIComponent(address).replace("%40", "@");
  return `mailto:${encodedAddress}?subject=${encodeURIComponent(subject.trim().toWellFormed())}&body=${encodeURIComponent(body.replace(/\r?\n/g, "\r\n").toWellFormed())}`;
}
