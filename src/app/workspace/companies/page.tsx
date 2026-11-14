"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/features/workspace/context";
import { SourceInput } from "@/features/workspace/ui/source-input";
import { createCompanyWork } from "@/entities/workspace/model/operations";
export default function CompaniesPage() {
  const { workspace, update } = useWorkspace(); const router = useRouter();
  if (!workspace) return null;
  return <><h1>회사별 이력서</h1><p>같은 회사라도 공고별로 별도 작업을 만들고 편집본을 보관합니다.</p>
    {!workspace.master?.resume ? <section className="card"><p>먼저 내 이력서를 등록하고 확정해 주세요.</p><Link href="/workspace/resume">내 이력서로 이동</Link></section> : <details open={workspace.works.length === 0}><summary>새 공고로 이력서 만들기</summary><SourceInput kind="job" onImport={(document) => {
      const work = createCompanyWork(workspace.master!, document); update((previous) => ({ ...previous, works: [work, ...previous.works] })); router.push(`/workspace/companies/${work.id}`);
    }} /></details>}
    <div className="work-list">{[...workspace.works].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((work) => <Link key={work.id} href={`/workspace/companies/${work.id}`}><strong>{work.title}</strong><span>{work.company ? `${work.company.companyName} · ${work.company.jobTitle}` : "공고 검토 중"}</span><small>최근 수정 {new Date(work.updatedAt).toLocaleString("ko-KR")} · 보관 버전 {work.versions.length}개</small></Link>)}</div>
  </>;
}
