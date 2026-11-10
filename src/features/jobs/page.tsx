"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  type JobSource,
  type RankedJobListing,
  resolveJobSearchQuery
} from "@/features/jobs/model/job-search";
import { hasResumeConfirmed, usePipeline } from "@/entities/pipeline/model/pipeline-context";
import { parseResumeJson } from "@/entities/resume/model/resume-utils";
import { AppFrame } from "@/shared/ui/frame/app-frame";
import type { ApiFailure, ApiSuccess } from "@/shared/lib/types";

interface JobSearchProviderSetup {
  source: JobSource;
  configured: boolean;
}

interface JobSearchProviderResult {
  source: JobSource;
  state: "success" | "needs_key" | "failed";
  resultCount: number;
  message?: string;
}

interface JobSearchSourcePayload {
  providers: JobSearchProviderSetup[];
}

interface JobSearchPayload {
  results: RankedJobListing[];
  providers: JobSearchProviderResult[];
}

interface CompanyUrlFetchData {
  url: string;
  title: string;
  companyNameHint: string;
  jobTitleHint: string;
  text: string;
  warning?: string;
}

const SOURCE_LABELS: Record<JobSource, string> = {
  saramin: "사람인"
};

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
  const [query, setQuery] = useState("");
  const [providerSetup, setProviderSetup] = useState<JobSearchProviderSetup[]>([]);
  const [providerResults, setProviderResults] = useState<JobSearchProviderResult[]>([]);
  const [results, setResults] = useState<RankedJobListing[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [importingId, setImportingId] = useState("");
  const saraminConfigured = providerSetup.some((provider) => provider.source === "saramin" && provider.configured);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    let cancelled = false;
    void fetch("/api/jobs/search")
      .then(async (response) => {
        const payload = (await response.json()) as ApiSuccess<JobSearchSourcePayload> | ApiFailure;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.ok ? "검색 사이트 설정을 불러오지 못했어요." : payload.error.message);
        }
        if (!cancelled) {
          setProviderSetup(payload.data.providers);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : "검색 사이트 설정을 불러오지 못했어요.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSources(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, setError]);

  const handleSearch = async () => {
    clearStatus();
    if (!resume) {
      setError("먼저 이력서를 저장해 주세요.");
      return;
    }

    const resolvedQuery = resolveJobSearchQuery(resume, query);
    if (!resolvedQuery) {
      setError("검색어를 입력하거나 이력서에 희망 직무 또는 기술 스택을 저장해 주세요.");
      return;
    }

    setIsSearching(true);
    setResults([]);
    setProviderResults([]);

    try {
      const response = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: resolvedQuery, resume, sources: ["saramin"] })
      });
      const payload = (await response.json()) as ApiSuccess<JobSearchPayload> | ApiFailure;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "공고를 검색하지 못했어요." : payload.error.message);
      }

      setResults(payload.data.results);
      setProviderResults(payload.data.providers);
      const total = payload.data.results.length;
      if (total > 0) {
        setMessage(`${total}개 공고를 이력서와 비교했어요.`);
      } else if (payload.data.providers.every((provider) => provider.state === "needs_key")) {
        setMessage("사람인 API 키가 없어 공고 목록을 불러오지 못했어요. API 키를 등록하거나 직접 고른 공고를 입력해 주세요.");
      } else {
        setMessage("조건에 맞는 공고를 찾지 못했어요. 검색어를 바꿔 다시 찾아보세요.");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "공고를 검색하지 못했어요.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseJob = async (url: string, id: string) => {
    clearStatus();
    if (!hasResume) {
      setError("먼저 이력서를 저장해 주세요.");
      return;
    }

    setImportingId(id);
    try {
      const response = await fetch("/api/company/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const payload = (await response.json()) as ApiSuccess<CompanyUrlFetchData> | ApiFailure;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "공고 원문을 불러오지 못했어요." : payload.error.message);
      }

      patch((previous) => ({
        ...previous,
        companyUrl: payload.data.url,
        companyInputMode: "text",
        companyText: payload.data.text,
        companyJsonText: "",
        companyConfirmedJson: null,
        companySavedAt: null
      }));
      setMessage("공고 원문을 불러왔어요. 내용 정리 후 이력서 맞춤 초안을 만들 수 있어요.");
      router.push("/company" as Route);
    } catch (error) {
      setError(error instanceof Error ? error.message : "공고 원문을 불러오지 못했어요.");
    } finally {
      setImportingId("");
    }
  };

  return (
    <AppFrame
      step="company"
      title="내 이력서에 맞는 공고 찾기"
      description="저장한 희망 직무와 기술을 기준으로 공고를 찾고, 선택한 공고를 회사 맞춤 이력서 흐름으로 가져옵니다."
      layout="wide"
      jobsActive
    >
      {!hasResume ? (
        <section className="card card-alert">
          <p className="card-kicker">먼저 하기</p>
          <h2>이력서를 저장하면 맞는 공고를 찾을 수 있어요.</h2>
          <div className="action-row">
            <Link href={"/resume" as Route} className="nav-btn">이력서로 가기</Link>
          </div>
        </section>
      ) : (
        <>
          <section className="card job-search-panel" aria-label="공고 검색 조건">
            <header className="job-search-panel-heading">
              <div>
                <p className="card-kicker">내 이력서 기반</p>
                <h2>공고 검색</h2>
                <p>검색어는 포털에만 전달하고, 이력서와의 적합도는 이 앱에서 비교합니다.</p>
              </div>
            </header>

            <label className="field job-search-query">
              <span>검색어</span>
              <input
                value={query || resume?.desiredPosition || resume?.techStack[0] || ""}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="예: 백엔드 개발자"
                maxLength={120}
              />
            </label>

            <fieldset className="job-search-providers">
              <legend>검색 사이트</legend>
              <div className="job-search-provider">
                <span>{SOURCE_LABELS.saramin}</span>
                <small>
                  {isLoadingSources
                    ? "확인 중"
                    : saraminConfigured
                      ? "키 설정됨"
                      : "API 키 필요"}
                </small>
              </div>
            </fieldset>

            <div className="job-search-setup-note">
              <p>
                {saraminConfigured
                  ? "API 키는 서버의 .env.local에 보관하고 브라우저에 노출하지 않습니다."
                  : "사람인 공식 API 키를 발급받아 서버의 .env.local에 설정하면 검색할 수 있어요."}
              </p>
              <div className="job-search-api-links">
                <a href="https://oapi.saramin.co.kr/join" target="_blank" rel="noreferrer">사람인 API 신청</a>
              </div>
              {!isLoadingSources && !saraminConfigured && (
                <Link href={"/company" as Route} className="nav-btn">공고 직접 입력하기</Link>
              )}
            </div>

            <div className="action-row">
              <button type="button" className="primary" onClick={() => void handleSearch()} disabled={isSearching}>
                {isSearching ? "공고 찾는 중..." : "공고 검색"}
              </button>
            </div>
          </section>

          {providerResults.length > 0 && (
            <section className="job-search-provider-status" aria-label="검색 결과 상태">
              {providerResults.map((provider) => (
                <p key={provider.source} data-state={provider.state}>
                  <strong>{SOURCE_LABELS[provider.source]}</strong>{" "}
                  {provider.state === "success"
                    ? `${provider.resultCount}개`
                    : provider.state === "needs_key"
                      ? "API 키를 등록하면 검색할 수 있어요."
                      : provider.message}
                </p>
              ))}
            </section>
          )}

          {results.length > 0 && (
            <section className="job-search-results" aria-label="이력서에 맞는 공고 목록">
              <header>
                <div>
                  <p className="card-kicker">이력서 근거로 정렬</p>
                  <h2>공고 {results.length}개</h2>
                </div>
              </header>
              {results.map((job) => (
                <article className="card job-search-result" aria-label={`${job.companyName} ${job.title}`} key={`${job.source}-${job.id}`}>
                  <header className="job-search-result-header">
                    <div>
                      <p className="job-search-result-source">
                        <a href="https://www.saramin.co.kr/" target="_blank" rel="noreferrer">Powered by 취업 사람인</a>
                      </p>
                      <h3>{job.title}</h3>
                      <p className="job-search-result-company">{job.companyName}</p>
                    </div>
                    <span className="job-search-fit" data-fit={job.fit}>{FIT_LABELS[job.fit]}</span>
                  </header>
                  <p className="job-search-result-meta">
                    {[job.location, job.employmentType, job.careerLabel, job.salary && `급여 ${job.salary}`, job.deadline && `마감 ${job.deadline}`]
                      .filter(Boolean)
                      .join(" · ") || "상세 조건은 공고 원문에서 확인해 주세요."}
                  </p>
                  {job.matchedSkills.length > 0 && (
                    <p className="job-search-matched-skills"><strong>겹치는 기술</strong> {job.matchedSkills.join(", ")}</p>
                  )}
                  <ul className="job-search-reasons">
                    {job.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                  <footer className="job-search-result-actions">
                    <a href={job.url} target="_blank" rel="noreferrer">공고 원문</a>
                    <button
                      type="button"
                      className="primary"
                      disabled={Boolean(importingId)}
                      onClick={() => void handleUseJob(job.url, job.id)}
                    >
                      {importingId === job.id ? "공고 가져오는 중..." : "이 공고로 이력서 맞추기"}
                    </button>
                  </footer>
                </article>
              ))}
            </section>
          )}

        </>
      )}
    </AppFrame>
  );
}
