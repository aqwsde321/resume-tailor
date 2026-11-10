"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { hasResumeConfirmed, usePipeline } from "@/entities/pipeline/model/pipeline-context";
import { createUrlJobListing, rankJobListings, type RankedJobListing } from "@/features/jobs/model/job-analysis";
import { parseResumeJson } from "@/entities/resume/model/resume-utils";
import { toAgentRunOptions } from "@/shared/lib/agent-settings";
import { AppFrame } from "@/shared/ui/frame/app-frame";
import type { ApiFailure, ApiSuccess, Company } from "@/shared/lib/types";

interface CompanyUrlFetchData {
  url: string;
  title: string;
  companyNameHint: string;
  jobTitleHint: string;
  text: string;
  warning?: string;
}

interface AnalyzedJob {
  listing: RankedJobListing;
  company: Company;
  sourceText: string;
  pageTitle: string;
  warning?: string;
}

const FIT_LABELS: Record<RankedJobListing["fit"], string> = {
  high: "높은 관련성",
  medium: "확인 필요",
  low: "낮은 관련성"
};

export default function JobsPage() {
  const router = useRouter();
  const { hydrated, state, patch, clearStatus, setError, setMessage } = usePipeline();
  const resume = parseResumeJson(state.resumeConfirmedJson);
  const hasResume = hasResumeConfirmed(state) && Boolean(resume);
  const [jobUrl, setJobUrl] = useState("");
  const [analyzedJob, setAnalyzedJob] = useState<AnalyzedJob | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzeUrl = async () => {
    clearStatus();
    setAnalyzedJob(null);

    if (!resume) {
      setError("먼저 이력서를 저장해 주세요.");
      return;
    }

    let url: URL;
    try {
      url = new URL(jobUrl.trim());
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("invalid-url");
      }
    } catch {
      setError("공고 URL은 http 또는 https 주소로 입력해 주세요.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const fetchResponse = await fetch("/api/company/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.toString() })
      });
      const fetchPayload = (await fetchResponse.json()) as ApiSuccess<CompanyUrlFetchData> | ApiFailure;
      if (!fetchResponse.ok || !fetchPayload.ok) {
        throw new Error(fetchPayload.ok ? "공고 링크 내용을 불러오지 못했어요." : fetchPayload.error.message);
      }

      if (!fetchPayload.data.text.trim()) {
        throw new Error("공고 페이지에서 읽을 수 있는 내용을 찾지 못했어요.");
      }

      const parseResponse = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: fetchPayload.data.text,
          agent: toAgentRunOptions(state.agentSettings)
        })
      });
      const parsePayload = (await parseResponse.json()) as ApiSuccess<Company> | ApiFailure;
      if (!parseResponse.ok || !parsePayload.ok) {
        throw new Error(parsePayload.ok ? "공고 내용을 구조화하지 못했어요." : parsePayload.error.message);
      }

      const company: Company = {
        ...parsePayload.data,
        companyName: parsePayload.data.companyName.trim() || fetchPayload.data.companyNameHint.trim(),
        jobTitle: parsePayload.data.jobTitle.trim() || fetchPayload.data.jobTitleHint.trim()
      };
      const listing = createUrlJobListing(company, {
        id: `url-${crypto.randomUUID()}`,
        url: fetchPayload.data.url,
        postedAt: new Date().toISOString().slice(0, 10)
      });
      const ranked = rankJobListings(resume, [listing])[0];
      if (!ranked) {
        throw new Error("공고 내용을 이력서와 비교하지 못했어요.");
      }

      setAnalyzedJob({
        listing: ranked,
        company,
        sourceText: fetchPayload.data.text,
        pageTitle: fetchPayload.data.title,
        warning: fetchPayload.data.warning
      });
      setMessage("공고 내용을 읽어 이력서와 비교했어요.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "공고 링크를 분석하지 못했어요.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUseJob = () => {
    clearStatus();
    if (!hasResume || !analyzedJob) {
      setError("먼저 이력서를 저장하고 공고를 분석해 주세요.");
      return;
    }

    patch((previous) => ({
      ...previous,
      companyUrl: analyzedJob.listing.url,
      companyInputMode: "text",
      companyText: analyzedJob.sourceText,
      companyJsonText: JSON.stringify(analyzedJob.company, null, 2),
      companyConfirmedJson: null,
      companySavedAt: null
    }));
    setMessage("분석한 공고를 회사 맞춤 이력서 단계로 넘겼어요.");
    router.push("/company" as Route);
  };

  return (
    <AppFrame
      step="company"
      title="URL로 공고 분석"
      description="공고 링크를 넣으면 내용을 정리해 이력서와 비교하고, 해당 회사에 맞춘 이력서 작업으로 이어집니다."
      layout="wide"
      jobsActive
    >
      {!hydrated || !hasResume ? (
        <section className="card card-alert">
          <p className="card-kicker">먼저 하기</p>
          <h2>이력서를 저장하면 공고와 비교할 수 있어요.</h2>
          <div className="action-row">
            <Link href={"/resume" as Route} className="nav-btn">이력서로 가기</Link>
          </div>
        </section>
      ) : (
        <>
          <section className="card job-search-panel" aria-label="공고 URL 분석">
            <header className="job-search-panel-heading">
              <div>
                <p className="card-kicker">사용자가 제공한 공고</p>
                <h2>공고 링크 붙여넣기</h2>
                <p>링크의 내용을 읽어 회사, 직무, 요건과 기술을 정리하고 저장된 이력서와 비교합니다.</p>
              </div>
            </header>

            <label className="field job-search-query">
              <span>공고 링크</span>
              <input
                type="url"
                value={jobUrl}
                onChange={(event) => setJobUrl(event.target.value)}
                placeholder="https://..."
                maxLength={2000}
              />
            </label>

            <div className="action-row">
              <button type="button" className="primary" onClick={() => void handleAnalyzeUrl()} disabled={isAnalyzing}>
                {isAnalyzing ? "공고 읽고 분석 중..." : "공고 분석"}
              </button>
            </div>
          </section>

          {analyzedJob && (
            <section className="job-search-results" aria-label="공고 분석 결과">
              <header>
                <div>
                  <p className="card-kicker">공고 분석 결과</p>
                  <h2>이력서와 비교했어요</h2>
                </div>
              </header>
              <article
                className="card job-search-result"
                aria-label={`${analyzedJob.listing.companyName} ${analyzedJob.listing.title}`}
              >
                <header className="job-search-result-header">
                  <div>
                    <p className="job-search-result-source">{analyzedJob.pageTitle || "입력한 공고 링크"}</p>
                    <h3>{analyzedJob.listing.title}</h3>
                    <p className="job-search-result-company">{analyzedJob.listing.companyName}</p>
                  </div>
                  <span className="job-search-fit" data-fit={analyzedJob.listing.fit}>
                    {FIT_LABELS[analyzedJob.listing.fit]}
                  </span>
                </header>

                {analyzedJob.company.companyDescription && (
                  <section className="job-search-summary">
                    <h4>회사 소개</h4>
                    <p>{analyzedJob.company.companyDescription}</p>
                  </section>
                )}
                {analyzedJob.company.jobDescription && (
                  <section className="job-search-summary">
                    <h4>주요 업무</h4>
                    <p>{analyzedJob.company.jobDescription}</p>
                  </section>
                )}
                {analyzedJob.company.techStack.length > 0 && (
                  <section className="job-search-summary">
                    <h4>기술 스택</h4>
                    <p>{analyzedJob.company.techStack.join(", ")}</p>
                  </section>
                )}
                {analyzedJob.company.requirements.length > 0 && (
                  <section className="job-search-summary">
                    <h4>필수 요건</h4>
                    <ul>{analyzedJob.company.requirements.map((item) => <li key={item}>{item}</li>)}</ul>
                  </section>
                )}
                {analyzedJob.company.preferredSkills.length > 0 && (
                  <section className="job-search-summary">
                    <h4>우대 요건</h4>
                    <ul>{analyzedJob.company.preferredSkills.map((item) => <li key={item}>{item}</li>)}</ul>
                  </section>
                )}
                {analyzedJob.listing.matchedSkills.length > 0 && (
                  <p className="job-search-matched-skills">
                    <strong>이력서와 겹치는 기술</strong> {analyzedJob.listing.matchedSkills.join(", ")}
                  </p>
                )}
                <ul className="job-search-reasons">
                  {analyzedJob.listing.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
                {analyzedJob.warning && <p className="job-search-warning">{analyzedJob.warning}</p>}
                <footer className="job-search-result-actions">
                  <a href={analyzedJob.listing.url} target="_blank" rel="noreferrer">입력한 공고 원문</a>
                  <button type="button" className="primary" onClick={handleUseJob}>
                    이 공고로 이력서 맞추기
                  </button>
                </footer>
              </article>
            </section>
          )}
        </>
      )}
    </AppFrame>
  );
}
