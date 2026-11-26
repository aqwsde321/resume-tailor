"use client";

import { useState } from "react";
import { compareCompanyVersions, versionCauseLabels } from "@/entities/workspace/model/company-version-history";
import { resumeToMarkdown } from "@/entities/workspace/model/operations";
import type { CompanyVersion } from "@/entities/workspace/model/workspace";
import { ResumeReadonlyDocument } from "./resume-readonly-document";

const dateLabel = (value: string) => new Date(value).toLocaleString("ko-KR");
const causeLabel = (version: CompanyVersion) => version.cause ? versionCauseLabels[version.cause] : "보관 사유 미기록";

export function CompanyVersionHistory({ versions, resume, intro, busy, onRestore }: {
  versions: CompanyVersion[];
  resume: CompanyVersion["resume"];
  intro: CompanyVersion["intro"];
  busy: boolean;
  onRestore: (id: string) => void;
}) {
  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const newest = versions.toReversed();
  const versionLabel = (version: CompanyVersion, index: number) => `버전 ${newest.length - index} · ${dateLabel(version.createdAt)} · ${causeLabel(version)}`;
  const selectedBefore = newest.find(({ id }) => id === beforeId) ?? newest[0];
  const selectedAfter = newest.find(({ id }) => id === afterId);
  const changes = comparisonOpen && selectedBefore
    ? compareCompanyVersions(selectedBefore, selectedAfter ?? { resume, intro })
    : [];

  return <details className="company-detail-disclosure">
    <summary>보관 버전 {versions.length}개</summary>
    <div className="company-detail-disclosure-content">
      {newest.length === 0 ? <p>편집본 위의 ‘현재 버전 보관’으로 저장할 수 있습니다.</p> : <>
        <details className="company-version-compare" onToggle={(event) => setComparisonOpen(event.currentTarget.open)}>
          <summary>버전 비교</summary>
          <div className="company-version-columns">
            <label>이전 버전<select value={selectedBefore.id} onChange={(event) => setBeforeId(event.target.value)}>
              {newest.map((version, index) => <option key={version.id} value={version.id}>{versionLabel(version, index)}</option>)}
            </select></label>
            <label>비교 대상<select value={selectedAfter?.id ?? ""} onChange={(event) => setAfterId(event.target.value)}>
              <option value="">현재 회사별 편집본</option>
              {newest.map((version, index) => <option key={version.id} value={version.id}>{versionLabel(version, index)}</option>)}
            </select></label>
          </div>
          {comparisonOpen && <>
            {!changes.length && <p role="status">두 버전의 이력서와 PDF 상단 요약이 같습니다.</p>}
            {changes.map(({ label, before, after }) => <section key={label} aria-label={label}>
              <h3>{label}</h3>
              <div className="company-version-columns">
                <div><h4>반영 전</h4><p>{before || "작성된 내용 없음"}</p></div>
                <div><h4>반영 후</h4><p>{after || "작성된 내용 없음"}</p></div>
              </div>
            </section>)}
          </>}
        </details>
        {newest.map((version, index) => <article className="company-detail-version" key={version.id}>
          <p>버전 {newest.length - index} · <time dateTime={version.createdAt}>{dateLabel(version.createdAt)}</time> · {causeLabel(version)}</p>
          {version.note && <p>{version.note}</p>}
          <details><summary>내용 확인</summary>
            <ResumeReadonlyDocument text={resumeToMarkdown(version.resume)} toolbar={<span className="studio-paper-filename">보관된 회사별 이력서</span>} />
            {version.intro?.longIntro && <p className="company-version-intro">{version.intro.longIntro}</p>}
          </details>
          <button type="button" disabled={busy} onClick={() => onRestore(version.id)}>현재 편집본 보관 후 이 버전 복원</button>
        </article>)}
      </>}
    </div>
  </details>;
}
