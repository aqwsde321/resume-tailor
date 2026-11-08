"use client";

import type { FormEvent } from "react";

import type { ExperienceDiscoverySession, DiscoveredExperienceDraft } from "@/shared/lib/types";

interface ExperienceDiscoveryCardProps {
  answer: string;
  gaps: string[];
  isBusy: boolean;
  session: ExperienceDiscoverySession | null;
  onAnswerChange: (value: string) => void;
  onApproveDraft: () => void;
  onDiscard: () => void;
  onDraftChange: (draft: DiscoveredExperienceDraft) => void;
  onStart: (requirement: string) => void;
  onSubmitAnswer: () => void;
}

function parseTechStack(value: string) {
  return Array.from(new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean)));
}

export function ExperienceDiscoveryCard({
  answer,
  gaps,
  isBusy,
  session,
  onAnswerChange,
  onApproveDraft,
  onDiscard,
  onDraftChange,
  onStart,
  onSubmitAnswer
}: ExperienceDiscoveryCardProps) {
  if (!session && gaps.length === 0) {
    return null;
  }

  const draft = session?.draft ?? null;
  const canApprove = Boolean(
    draft &&
      (draft.title.trim() || draft.organization.trim()) &&
      draft.description.trim()
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!answer.trim() || isBusy) {
      return;
    }

    onSubmitAnswer();
  };

  return (
    <section className="card workflow-support-card experience-discovery-card">
      <div className="card-head">
        <div>
          <p className="card-kicker">경험 발굴</p>
          <h2>아직 이력서에 적지 않은 경험 찾기</h2>
        </div>
      </div>

      {session ? (
        <div className="discovery-session">
          <div className="discovery-session-head">
            <div>
              <p className="discovery-requirement-label">확인할 요건</p>
              <h3>{session.requirement}</h3>
            </div>
            <button type="button" className="secondary" onClick={onDiscard} disabled={isBusy}>
              닫기
            </button>
          </div>

          {session.messages.length > 0 && (
            <ol className="discovery-transcript" aria-label="경험 발굴 대화">
              {session.messages.map((message, index) => (
                <li
                  key={`${message.role}-${index}`}
                  className={`discovery-message ${message.role}`}
                >
                  <span>{message.role === "assistant" ? "질문" : "내 답변"}</span>
                  <p>{message.content}</p>
                </li>
              ))}
            </ol>
          )}

          {isBusy && <p className="discovery-status">답변을 살펴보고 있어요.</p>}

          {session.status === "question" && (
            <form className="discovery-answer-form" onSubmit={handleSubmit}>
              <label htmlFor="discovery-answer">답변</label>
              <textarea
                id="discovery-answer"
                value={answer}
                onChange={(event) => onAnswerChange(event.target.value)}
                placeholder="기억나는 상황, 맡은 역할, 한 일과 결과를 편하게 적어 주세요."
                rows={4}
                maxLength={2000}
                disabled={isBusy}
              />
              <div className="discovery-form-actions">
                <button type="submit" className="primary" disabled={isBusy || !answer.trim()}>
                  {isBusy ? "확인 중..." : "답변 보내기"}
                </button>
                <button type="button" className="secondary" onClick={onDiscard} disabled={isBusy}>
                  이 요건 건너뛰기
                </button>
              </div>
            </form>
          )}

          {session.status === "done" && (
            <div className="discovery-done">
              <button type="button" className="secondary" onClick={onDiscard}>
                다른 요건 살펴보기
              </button>
            </div>
          )}

          {session.status === "draft" && draft && (
            <div className="discovery-draft">
              <p className="discovery-draft-note">초안을 확인하고 사실과 다른 부분을 직접 고쳐 주세요.</p>

              <div className="discovery-draft-grid">
                <label>
                  구분
                  <select
                    value={draft.category}
                    onChange={(event) =>
                      onDraftChange({
                        ...draft,
                        category: event.target.value as DiscoveredExperienceDraft["category"]
                      })
                    }
                  >
                    <option value="experience">경력 경험</option>
                    <option value="project">프로젝트</option>
                  </select>
                </label>
                <label>
                  제목
                  <input
                    value={draft.title}
                    maxLength={160}
                    onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
                  />
                </label>
                <label>
                  회사 또는 조직
                  <input
                    value={draft.organization}
                    maxLength={160}
                    onChange={(event) => onDraftChange({ ...draft, organization: event.target.value })}
                  />
                </label>
                <label>
                  역할
                  <input
                    value={draft.role}
                    maxLength={160}
                    onChange={(event) => onDraftChange({ ...draft, role: event.target.value })}
                  />
                </label>
                <label>
                  기간
                  <input
                    value={draft.period}
                    maxLength={100}
                    onChange={(event) => onDraftChange({ ...draft, period: event.target.value })}
                  />
                </label>
                <label className="discovery-tech-stack">
                  기술 또는 방법
                  <input
                    value={draft.techStack.join(", ")}
                    onChange={(event) => onDraftChange({ ...draft, techStack: parseTechStack(event.target.value) })}
                  />
                </label>
                <label className="discovery-description">
                  경험 설명
                  <textarea
                    value={draft.description}
                    rows={4}
                    maxLength={1600}
                    onChange={(event) => onDraftChange({ ...draft, description: event.target.value })}
                  />
                </label>
              </div>

              <p className="discovery-draft-note">
                추가를 누르면 이 경험을 확정 이력서에 저장합니다. 기존 소개글은 다시 만들어야 합니다.
              </p>
              <div className="discovery-form-actions">
                <button type="button" className="primary" onClick={onApproveDraft} disabled={!canApprove || isBusy}>
                  이력서에 추가
                </button>
                <button type="button" className="secondary" onClick={onDiscard} disabled={isBusy}>
                  초안 버리기
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="discovery-intro">
            부족한 요건을 골라 질문에 답해 보세요. 경험을 초안으로 정리한 뒤, 직접 검토하고 추가할 수 있습니다.
          </p>
          <ul className="discovery-gap-list">
            {gaps.map((gap) => (
              <li key={gap} className="discovery-gap-row">
                <span>{gap}</span>
                <button type="button" className="secondary" onClick={() => onStart(gap)} disabled={isBusy}>
                  경험 찾아보기
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
