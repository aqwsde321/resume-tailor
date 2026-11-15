"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { StudioIcon } from "@/features/workspace/ui/studio-icon";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/features/workspace/context";
import { SourceInput } from "@/features/workspace/ui/source-input";
import { createCompanyWork } from "@/entities/workspace/model/operations";
export default function CompaniesPage() {
  const { workspace, update } = useWorkspace(); const router = useRouter();
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);
  if (!workspace) return null;
  const showRegistration = registrationOpen ?? workspace.works.length === 0;
  return <div className="studio-companies"><header className="studio-page-heading"><div><h1>회사별 이력서</h1><p>공고에 맞게 경험을 다듬고, 회사마다 다른 이력서를 보관하세요.</p></div><Button className="primary" label="새 공고로 이력서 만들기" icon={<StudioIcon name="document" size={16} />} isDisabled={!workspace.master?.resume} aria-expanded={showRegistration} aria-controls="company-registration" onClick={() => setRegistrationOpen(!showRegistration)} /></header>
    {!workspace.master?.resume ? <section className="card"><h2>공통 이력서가 필요합니다</h2><p>먼저 내 이력서를 등록하고 확정해 주세요.</p><Link href="/workspace/resume">내 이력서로 이동</Link></section> : <section id="company-registration" className="company-registration" hidden={!showRegistration}><SourceInput kind="job" variant="studio" onImport={(document) => {
      const work = createCompanyWork(workspace.master!, document); update((previous) => ({ ...previous, works: [work, ...previous.works] })); router.push(`/workspace/companies/${work.id}`);
    }} /></section>}
    {workspace.works.length > 0 && <h2 className="company-list-title">저장된 작업 <span>{workspace.works.length}개</span></h2>}
    <div className="work-list">{[...workspace.works].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((work) => <Link key={work.id} href={`/workspace/companies/${work.id}`}><strong>{work.title}</strong><span>{!work.company ? "공고 확인 중" : work.companySourceText !== work.document.text ? "공고 재확정 필요" : work.tailoring ? "맞춤 제안 검토 중" : "회사별 편집본"}</span><small>최근 수정 {new Date(work.updatedAt).toLocaleString("ko-KR")} · 보관 버전 {work.versions.length}개</small></Link>)}</div>
  </div>;
}
