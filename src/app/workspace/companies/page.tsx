"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { useRouter } from "next/navigation";
import { findDuplicateCompanyPostings } from "@/entities/workspace/model/company-posting-duplicates";
import { createCompanyWork } from "@/entities/workspace/model/operations";
import type { ReviewDocument } from "@/entities/workspace/model/workspace";
import { useWorkspace } from "@/features/workspace/context";
import { SourceInput } from "@/features/workspace/ui/source-input";
import { StudioIcon } from "@/features/workspace/ui/studio-icon";

const matchLabels = { url: "같은 공고 URL", text: "같은 공고 본문", similar: "유사한 공고 본문" };

export default function CompaniesPage() {
  const { workspace, update } = useWorkspace();
  const router = useRouter();
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);
  const [pendingDocument, setPendingDocument] = useState<ReviewDocument>();
  if (!workspace) return null;

  const showRegistration = registrationOpen ?? workspace.works.length === 0;
  const duplicates = pendingDocument ? findDuplicateCompanyPostings(pendingDocument, workspace.works) : [];
  function createWork(document: ReviewDocument) {
    if (!workspace?.master?.resume) return;
    const work = createCompanyWork(workspace.master, document);
    update((previous) => ({ ...previous, works: [work, ...previous.works] }));
    setPendingDocument(undefined);
    router.push(`/workspace/companies/${work.id}`);
  }

  return <div className="studio-companies">
    <header className="studio-page-heading">
      <div><h1>회사별 이력서</h1><p>공고에 맞게 경험을 다듬고, 회사마다 다른 이력서를 보관하세요.</p></div>
      <Button className="primary" label="새 공고로 이력서 만들기" icon={<StudioIcon name="document" size={16} />}
        isDisabled={!workspace.master?.resume} aria-expanded={showRegistration} aria-controls="company-registration"
        onClick={() => setRegistrationOpen(!showRegistration)} />
    </header>
    {!workspace.master?.resume ? <section className="card">
      <h2>공통 이력서가 필요합니다</h2><p>먼저 내 이력서를 등록하고 확정해 주세요.</p><Link href="/workspace/resume">내 이력서로 이동</Link>
    </section> : <section id="company-registration" className="company-registration" hidden={!showRegistration}>
      <div hidden={Boolean(pendingDocument)}><SourceInput kind="job" variant="studio" onImport={(document) => {
        if (findDuplicateCompanyPostings(document, workspace.works).length) setPendingDocument(document);
        else createWork(document);
      }} /></div>
      {pendingDocument && <section className="card company-duplicate-posting" aria-label="중복 공고 확인">
        <h2 tabIndex={-1} ref={(heading) => heading?.focus()}>이미 등록한 공고가 있을 수 있어요</h2>
        <ul>{duplicates.map(({ work, reason }) => <li key={work.id}>
          <Link href={`/workspace/companies/${work.id}`}>기존 작업 열기 · {work.title}</Link><span>{matchLabels[reason]}</span>
        </li>)}</ul>
        <div>
          <button type="button" onClick={() => setPendingDocument(undefined)}>다른 공고 입력</button>
          <button type="button" className="primary" onClick={() => createWork(pendingDocument)}>새 작업으로 등록</button>
        </div>
      </section>}
    </section>}
    {workspace.works.length > 0 && <h2 className="company-list-title">저장된 작업 <span>{workspace.works.length}개</span></h2>}
    <div className="work-list">{[...workspace.works].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((work) => <Link key={work.id} href={`/workspace/companies/${work.id}`}><strong>{work.title}</strong><span>{!work.company ? "공고 확인 중" : work.companySourceText !== work.document.text ? "공고 재확정 필요" : work.tailoring ? "맞춤 제안 검토 중" : "회사별 편집본"}</span><small>최근 수정 {new Date(work.updatedAt).toLocaleString("ko-KR")} · 보관 버전 {work.versions.length}개</small></Link>)}</div>
  </div>;
}
