"use client";

import { AutoGrowTextarea } from "@/shared/ui/auto-grow-textarea";
import { ListPreview } from "@/shared/ui/list-preview";
import { parseInlineItems, parseListText } from "@/shared/lib/list-input";
import type { Company } from "@/shared/lib/types";

interface CompanyDetailsSectionProps {
  bindRequiredFieldRef: (
    key: "companyName" | "jobTitle" | "requirements"
  ) => (node: HTMLElement | null) => void;
  canEdit: boolean;
  companyNeedsConfirm: boolean;
  draft: Company;
  isWorking: boolean;
  isSaved: boolean;
  requirementsText: string;
  preferredSkillsText: string;
  setRequirementsText: (value: string) => void;
  setPreferredSkillsText: (value: string) => void;
  setTechStackText: (value: string) => void;
  syncDraft: (next: Company) => void;
  techStackText: string;
  uiBusy: boolean;
}

export function CompanyDetailsSection({
  bindRequiredFieldRef,
  canEdit,
  companyNeedsConfirm,
  draft,
  isSaved,
  isWorking,
  preferredSkillsText,
  requirementsText,
  setPreferredSkillsText,
  setRequirementsText,
  setTechStackText,
  syncDraft,
  techStackText,
  uiBusy
}: CompanyDetailsSectionProps) {
  return (
    <section className={`card workflow-summary-card ${isWorking ? "card-processing" : ""}`}>
      <div className="card-head">
        <div>
          <p className="card-kicker">확인</p>
          <h2>공고 다듬기</h2>
        </div>
        {companyNeedsConfirm ? (
          <span className="inline-badge warn">수정됨</span>
        ) : isSaved ? (
          <span className="inline-badge ok">저장됨</span>
        ) : (
          <span className="inline-badge">아직 없음</span>
        )}
      </div>

      <div className="form-grid two">
        <label
          ref={bindRequiredFieldRef("companyName")}
          className={`field ${!draft.companyName.trim() ? "field-error" : ""}`}
        >
          <span>회사명</span>
          <input
            className="form-input"
            value={draft.companyName}
            onChange={(event) => syncDraft({ ...draft, companyName: event.target.value })}
            disabled={uiBusy || !canEdit}
          />
        </label>

        <label
          ref={bindRequiredFieldRef("jobTitle")}
          className={`field ${!draft.jobTitle.trim() ? "field-error" : ""}`}
        >
          <span>포지션</span>
          <input
            className="form-input"
            value={draft.jobTitle}
            onChange={(event) => syncDraft({ ...draft, jobTitle: event.target.value })}
            disabled={uiBusy || !canEdit}
          />
        </label>

        <label className="field field-full">
          <span>회사 소개</span>
          <AutoGrowTextarea
            value={draft.companyDescription}
            onChange={(event) => syncDraft({ ...draft, companyDescription: event.target.value })}
            disabled={uiBusy || !canEdit}
          />
        </label>

        <label className="field field-full">
          <span>주요 업무</span>
          <AutoGrowTextarea
            value={draft.jobDescription}
            onChange={(event) => syncDraft({ ...draft, jobDescription: event.target.value })}
            disabled={uiBusy || !canEdit}
          />
        </label>

        <label
          ref={bindRequiredFieldRef("requirements")}
          className={`field field-full ${draft.requirements.length === 0 ? "field-error" : ""}`}
        >
          <span>필수 조건</span>
          <AutoGrowTextarea
            className="list-textarea"
            value={requirementsText}
            onChange={(event) => {
              const value = event.target.value;
              setRequirementsText(value);
              syncDraft({ ...draft, requirements: parseListText(value) });
            }}
            placeholder={"한 줄에 하나씩 입력해 주세요.\n예) Java 기반 서버 개발 경험"}
            disabled={uiBusy || !canEdit}
          />
          <ListPreview items={draft.requirements} label="지금 들어간 필수 조건" />
        </label>

        <label className="field field-full">
          <span>우대 조건</span>
          <AutoGrowTextarea
            className="list-textarea"
            value={preferredSkillsText}
            onChange={(event) => {
              const value = event.target.value;
              setPreferredSkillsText(value);
              syncDraft({ ...draft, preferredSkills: parseListText(value) });
            }}
            placeholder={"한 줄에 하나씩 입력해 주세요.\n예) 대용량 트래픽 서비스 경험"}
            disabled={uiBusy || !canEdit}
          />
          <ListPreview items={draft.preferredSkills} label="지금 들어간 우대 조건" />
        </label>

        <div className="field field-full">
          <span>기술 스택</span>
          <input
            className="form-input inline-stack-input"
            aria-label="공고 기술 스택"
            type="text"
            value={techStackText}
            onChange={(event) => {
              const value = event.target.value;
              setTechStackText(value);
              syncDraft({ ...draft, techStack: parseInlineItems(value) });
            }}
            placeholder="예) Java, Spring, C#, .NET, MySQL"
            disabled={uiBusy || !canEdit}
          />
          <span className="field-help">쉼표로 구분해서 한 줄로 적으면 됩니다.</span>
        </div>
      </div>
    </section>
  );
}
