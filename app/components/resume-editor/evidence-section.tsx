"use client";

import { AutoGrowTextarea } from "@/app/components/auto-grow-textarea";
import { ListPreview } from "@/app/components/list-preview";
import { parseListText } from "@/lib/list-input";
import type { Resume } from "@/lib/types";

interface ResumeEvidenceSectionProps {
  achievementsText: string;
  draft: Resume;
  setAchievementsText: (value: string) => void;
  setStrengthsText: (value: string) => void;
  strengthsText: string;
  syncDraft: (next: Resume) => void;
  uiBusy: boolean;
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
