"use client";

import { AutoGrowTextarea } from "@/app/components/auto-grow-textarea";
import { ListPreview } from "@/app/components/list-preview";
import { parseInlineItems, parseListText, stringifyInlineList } from "@/lib/list-input";
import { makeEmptyExperience, makeEmptyProject } from "@/lib/resume-utils";
import type { Resume, ResumeExperienceItem, ResumeProjectItem } from "@/lib/types";

interface ResumeSummaryCardProps {
  completedExperienceCount: number;
  completedProjectCount: number;
  draft: Resume;
  isWorking: boolean;
  isSaved: boolean;
  needsConfirm: boolean;
  techStackSummary: string;
}

interface ResumeCoreSectionProps {
  bindRequiredFieldRef: (key: "desiredPosition" | "techStack") => (node: HTMLElement | null) => void;
  draft: Resume;
  syncDraft: (next: Resume) => void;
  techStackText: string;
  setTechStackText: (value: string) => void;
  uiBusy: boolean;
}

interface ResumeEvidenceSectionProps {
  achievementsText: string;
  draft: Resume;
  setAchievementsText: (value: string) => void;
  setStrengthsText: (value: string) => void;
  strengthsText: string;
  syncDraft: (next: Resume) => void;
  uiBusy: boolean;
}

interface ResumeExperienceSectionProps {
  draft: Resume;
  syncDraft: (next: Resume) => void;
  uiBusy: boolean;
  updateExperience: (index: number, key: keyof ResumeExperienceItem, value: string) => void;
}

interface ResumeProjectsSectionProps {
  draft: Resume;
  projectTechStackTexts: string[];
  setProjectTechStackTexts: (updater: (current: string[]) => string[]) => void;
  syncDraft: (next: Resume) => void;
  uiBusy: boolean;
  updateProject: (
    index: number,
    key: keyof Pick<ResumeProjectItem, "name" | "description">,
    value: string
  ) => void;
  updateProjectTechStack: (index: number, techStack: string[]) => void;
}

export function ResumeSummaryCard({
  completedExperienceCount,
  completedProjectCount,
  draft,
  isWorking,
  isSaved,
  needsConfirm,
  techStackSummary
}: ResumeSummaryCardProps) {
  return (
    <section className={`card workflow-summary-card ${isWorking ? "card-processing" : ""}`}>
      <div className="card-head">
        <div>
          <p className="card-kicker">확인</p>
          <h2>이력서 다듬기</h2>
        </div>
        {needsConfirm ? (
          <span className="inline-badge warn">수정됨</span>
        ) : isSaved ? (
          <span className="inline-badge ok">저장됨</span>
        ) : (
          <span className="inline-badge">아직 없음</span>
        )}
      </div>

      <div className="summary-list" aria-label="이력서 현재 요약">
        <div className={`summary-row ${draft.desiredPosition.trim() ? "ok" : "warn"}`}>
          <span>희망 직무</span>
          <strong>{draft.desiredPosition.trim() || "입력 필요"}</strong>
        </div>
        <div className={`summary-row ${draft.techStack.length > 0 ? "ok" : "warn"}`}>
          <span>기술 스택</span>
          <strong>{techStackSummary}</strong>
        </div>
        <div
          className={`summary-row ${
            draft.achievements.length > 0 || draft.strengths.length > 0 ? "ok" : "warn"
          }`}
        >
          <span>소개글 근거</span>
          <strong>{`성과 ${draft.achievements.length} · 강점 ${draft.strengths.length}`}</strong>
        </div>
        <div className="summary-row">
          <span>경력 / 프로젝트</span>
          <strong>{`경력 ${completedExperienceCount} · 프로젝트 ${completedProjectCount}`}</strong>
        </div>
      </div>
    </section>
  );
}

export function ResumeCoreSection({
  bindRequiredFieldRef,
  draft,
  syncDraft,
  techStackText,
  setTechStackText,
  uiBusy
}: ResumeCoreSectionProps) {
  return (
    <section className="card workflow-section-card">
      <div className="card-head">
        <div>
          <p className="card-kicker">1. 핵심 정보</p>
          <h2>소개글의 뼈대</h2>
        </div>
      </div>

      <div className="form-grid resume-core-grid">
        <label className="field">
          <span>이름</span>
          <input
            className="form-input"
            value={draft.name}
            onChange={(event) => syncDraft({ ...draft, name: event.target.value })}
            disabled={uiBusy}
          />
        </label>

        <label
          ref={bindRequiredFieldRef("desiredPosition")}
          className={`field ${!draft.desiredPosition.trim() ? "field-error" : ""}`}
        >
          <span>희망 직무</span>
          <input
            className="form-input"
            value={draft.desiredPosition}
            onChange={(event) => syncDraft({ ...draft, desiredPosition: event.target.value })}
            disabled={uiBusy}
          />
        </label>

        <label className="field">
          <span>경력 연차</span>
          <input
            className="form-input"
            type="number"
            min={0}
            value={draft.careerYears}
            onChange={(event) =>
              syncDraft({
                ...draft,
                careerYears: Number.isNaN(Number(event.target.value))
                  ? 0
                  : Math.max(0, Number(event.target.value))
              })
            }
            disabled={uiBusy}
          />
        </label>

        <div
          ref={bindRequiredFieldRef("techStack")}
          className={`field field-full ${draft.techStack.length === 0 ? "field-error" : ""}`}
        >
          <span>기술 스택</span>
          <input
            className="form-input inline-stack-input"
            type="text"
            value={techStackText}
            onChange={(event) => {
              const value = event.target.value;
              setTechStackText(value);
              syncDraft({ ...draft, techStack: parseInlineItems(value) });
            }}
            placeholder="예) Java, Spring Boot, MySQL, Redis, Docker"
            disabled={uiBusy}
          />
          <span className="field-help">쉼표로 구분해서 한 줄로 적으면 됩니다.</span>
        </div>

        <label className="field field-full">
          <span>요약</span>
          <AutoGrowTextarea
            value={draft.summary}
            onChange={(event) => syncDraft({ ...draft, summary: event.target.value })}
            disabled={uiBusy}
          />
        </label>
      </div>
    </section>
  );
}

export function ResumeEvidenceSection({
  achievementsText,
  draft,
  setAchievementsText,
  setStrengthsText,
  strengthsText,
  syncDraft,
  uiBusy
}: ResumeEvidenceSectionProps) {
  return (
    <section className="card workflow-section-card">
      <div className="card-head">
        <div>
          <p className="card-kicker">2. 소개글 근거</p>
          <h2>성과와 강점</h2>
          <p className="card-copy">한 줄씩 정리할수록 소개글이 더 선명해집니다.</p>
        </div>
      </div>

      <div className="form-grid two">
        <label className="field field-full">
          <span>성과</span>
          <AutoGrowTextarea
            className="list-textarea"
            value={achievementsText}
            onChange={(event) => {
              const value = event.target.value;
              setAchievementsText(value);
              syncDraft({ ...draft, achievements: parseListText(value) });
            }}
            placeholder={"한 줄에 하나씩 입력해 주세요.\n예) 결제 전환율 18% 개선"}
            disabled={uiBusy}
          />
          <ListPreview items={draft.achievements} label="지금 들어간 성과" />
        </label>

        <label className="field field-full">
          <span>강점</span>
          <AutoGrowTextarea
            className="list-textarea"
            value={strengthsText}
            onChange={(event) => {
              const value = event.target.value;
              setStrengthsText(value);
              syncDraft({ ...draft, strengths: parseListText(value) });
            }}
            placeholder={"한 줄에 하나씩 입력해 주세요.\n예) 복잡한 요구사항을 구조화해 정리하는 편"}
            disabled={uiBusy}
          />
          <ListPreview items={draft.strengths} label="지금 들어간 강점" />
        </label>
      </div>
    </section>
  );
}

export function ResumeExperienceSection({
  draft,
  syncDraft,
  uiBusy,
  updateExperience
}: ResumeExperienceSectionProps) {
  return (
    <section className="card workflow-section-card">
      <div className="card-head">
        <div>
          <p className="card-kicker">3. 경력</p>
          <h2>필요한 카드만 펼쳐서 수정</h2>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => syncDraft({ ...draft, experience: [...draft.experience, makeEmptyExperience()] })}
          disabled={uiBusy}
        >
          경력 추가
        </button>
      </div>

      {draft.experience.length === 0 && <p className="muted-help">아직 경력이 없어요.</p>}

      <div className="array-section">
        {draft.experience.map((item, index) => (
          <details
            key={`experience-${index}`}
            className="collapsible-section"
            open={draft.experience.length === 1}
          >
            <summary>
              <div className="resume-item-summary">
                <p className="card-kicker">경력 {index + 1}</p>
                <strong>{item.company.trim() || item.role.trim() || `경력 ${index + 1}`}</strong>
                <p>{item.period.trim() || "기간을 입력해 주세요."}</p>
              </div>
              <span className="inline-badge">{item.role.trim() || "역할 입력"}</span>
            </summary>

            <div className="collapsible-content">
              <div className="array-item-head">
                <span className="muted-help">
                  소개글에 반영할 핵심 역할과 문제 해결 경험만 남기면 충분합니다.
                </span>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    syncDraft({
                      ...draft,
                      experience: draft.experience.filter((_, itemIndex) => itemIndex !== index)
                    })
                  }
                  disabled={uiBusy}
                >
                  삭제
                </button>
              </div>

              <div className="form-grid two">
                <label className="field">
                  <span>회사</span>
                  <input
                    className="form-input"
                    value={item.company}
                    onChange={(event) => updateExperience(index, "company", event.target.value)}
                    disabled={uiBusy}
                  />
                </label>
                <label className="field">
                  <span>담당 역할</span>
                  <input
                    className="form-input"
                    value={item.role}
                    onChange={(event) => updateExperience(index, "role", event.target.value)}
                    disabled={uiBusy}
                  />
                </label>
                <label className="field field-full">
                  <span>기간</span>
                  <input
                    className="form-input"
                    value={item.period}
                    onChange={(event) => updateExperience(index, "period", event.target.value)}
                    disabled={uiBusy}
                  />
                </label>
                <label className="field field-full">
                  <span>내용</span>
                  <AutoGrowTextarea
                    value={item.description}
                    onChange={(event) => updateExperience(index, "description", event.target.value)}
                    disabled={uiBusy}
                  />
                </label>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

export function ResumeProjectsSection({
  draft,
  projectTechStackTexts,
  setProjectTechStackTexts,
  syncDraft,
  uiBusy,
  updateProject,
  updateProjectTechStack
}: ResumeProjectsSectionProps) {
  return (
    <section className="card workflow-section-card">
      <div className="card-head">
        <div>
          <p className="card-kicker">4. 프로젝트</p>
          <h2>핵심 설명과 사용 기술만 정리</h2>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => syncDraft({ ...draft, projects: [...draft.projects, makeEmptyProject()] })}
          disabled={uiBusy}
        >
          프로젝트 추가
        </button>
      </div>

      <p className="card-copy">
        링크와 출력 전용 정보는 step 4에서 다룹니다. 여기서는 핵심 설명만 남기면 됩니다.
      </p>

      {draft.projects.length === 0 && <p className="muted-help">아직 프로젝트가 없어요.</p>}

      <div className="array-section">
        {draft.projects.map((item, index) => (
          <details
            key={`project-${index}`}
            className="collapsible-section"
            open={draft.projects.length === 1}
          >
            <summary>
              <div className="resume-item-summary">
                <p className="card-kicker">프로젝트 {index + 1}</p>
                <strong>{item.name.trim() || `프로젝트 ${index + 1}`}</strong>
                <p>{item.techStack.length > 0 ? item.techStack.join(", ") : "기술 스택을 입력해 주세요."}</p>
              </div>
              <span className="inline-badge">{item.techStack.length}개 스택</span>
            </summary>

            <div className="collapsible-content">
              <div className="array-item-head">
                <span className="muted-help">
                  프로젝트 설명은 문제, 기여, 결과가 한 번에 보이도록 짧게 적는 편이 좋습니다.
                </span>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    syncDraft({
                      ...draft,
                      projects: draft.projects.filter((_, itemIndex) => itemIndex !== index)
                    })
                  }
                  disabled={uiBusy}
                >
                  삭제
                </button>
              </div>

              <div className="project-grid">
                <label className="field field-full">
                  <span>프로젝트 이름</span>
                  <input
                    className="form-input"
                    value={item.name}
                    onChange={(event) => updateProject(index, "name", event.target.value)}
                    disabled={uiBusy}
                  />
                </label>
                <label className="field field-full project-description-field">
                  <span>내용</span>
                  <AutoGrowTextarea
                    className="project-description-textarea"
                    value={item.description}
                    onChange={(event) => updateProject(index, "description", event.target.value)}
                    disabled={uiBusy}
                  />
                </label>
                <label className="field field-full">
                  <span>기술 스택</span>
                  <input
                    className="form-input inline-stack-input"
                    type="text"
                    value={projectTechStackTexts[index] ?? stringifyInlineList(item.techStack)}
                    onChange={(event) => {
                      const value = event.target.value;
                      setProjectTechStackTexts((current) => {
                        const nextValues = [...current];
                        nextValues[index] = value;
                        return nextValues;
                      });
                      updateProjectTechStack(index, parseInlineItems(value));
                    }}
                    placeholder="예) React, TypeScript, Docker"
                    disabled={uiBusy}
                  />
                  <span className="field-help">쉼표로 구분해서 입력하면 됩니다.</span>
                </label>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
