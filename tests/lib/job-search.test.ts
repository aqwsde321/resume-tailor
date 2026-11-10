import { describe, expect, it } from "vitest";

import {
  createManualJobListing,
  rankJobListings,
  resolveJobSearchQuery,
  sortRankedJobListings
} from "@/features/jobs/model/job-search";
import { createPdfResumeFixture } from "../fixtures/pdf-fixture";

const listings = [
  {
    id: "saramin-1",
    source: "saramin" as const,
    title: "Backend Engineer",
    companyName: "Acme",
    url: "https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=1",
    keywords: ["Java", "Spring Boot", "PostgreSQL"],
    location: "서울",
    employmentType: "정규직",
    careerLabel: "경력 3년 이상",
    careerMinYears: 3,
    careerMaxYears: null,
    salary: "",
    deadline: "2026-12-31",
    postedAt: "2026-11-09",
    active: true
  },
  {
    id: "saramin-2",
    source: "saramin" as const,
    title: "Product Designer",
    companyName: "Other",
    url: "https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=2",
    keywords: ["Figma", "디자인"],
    location: "부산",
    employmentType: "계약직",
    careerLabel: "경력무관",
    careerMinYears: null,
    careerMaxYears: null,
    salary: "",
    deadline: "",
    postedAt: "2026-11-08",
    active: true
  }
];

describe("job search matching", () => {
  it("turns a user-pasted posting into a rankable manual listing without fetching its source URL", () => {
    const manualListing = createManualJobListing(
      {
        companyName: "Acme",
        companyDescription: "결제 플랫폼",
        jobTitle: "Backend Engineer",
        jobDescription: "주문 API 개발",
        requirements: ["Java 서버 개발 경험"],
        preferredSkills: ["PostgreSQL 경험"],
        techStack: ["Java", "Spring Boot", "PostgreSQL"]
      },
      { id: "manual-1", url: "", postedAt: "2026-11-10" }
    );

    expect(manualListing).toMatchObject({
      id: "manual-1",
      source: "manual",
      title: "Backend Engineer",
      companyName: "Acme",
      url: "",
      keywords: ["Java", "Spring Boot", "PostgreSQL", "Java 서버 개발 경험", "PostgreSQL 경험"],
      postedAt: "2026-11-10"
    });
    expect(rankJobListings(createPdfResumeFixture(), [manualListing])[0]).toMatchObject({ fit: "high" });
  });

  it("uses the requested search term and falls back to resume position or skills", () => {
    const resume = createPdfResumeFixture();

    expect(resolveJobSearchQuery(resume, "  Java 백엔드  ")).toBe("Java 백엔드");
    expect(resolveJobSearchQuery(resume, "")).toBe("Backend Engineer");
    expect(resolveJobSearchQuery({ ...resume, desiredPosition: "" }, "")).toBe("Java");
  });

  it("ranks postings using explicit resume skills, role text, and career requirements", () => {
    const ranked = rankJobListings(createPdfResumeFixture(), listings);

    expect(ranked[0]).toMatchObject({
      id: "saramin-1",
      fit: "high",
      matchedSkills: ["Java", "Spring Boot", "PostgreSQL"]
    });
    expect(ranked[0]?.reasons.join(" ")).toContain("Backend Engineer");
    expect(ranked[1]).toMatchObject({ id: "saramin-2", fit: "low", matchedSkills: [] });
  });

  it("keeps the resume match score order when API and manual results are combined", () => {
    const resume = createPdfResumeFixture();
    const ranked = rankJobListings(resume, [
      { ...listings[0]!, id: "less-matched", keywords: ["Java"], postedAt: "2026-11-09" },
      { ...listings[0]!, id: "more-matched", postedAt: "2026-11-01" }
    ]);

    const combined = sortRankedJobListings([ranked[1]!, ranked[0]!]);

    expect(combined.map((listing) => listing.id)).toEqual(["more-matched", "less-matched"]);
    expect(combined[0]?.relevanceScore).toBeGreaterThan(combined[1]?.relevanceScore ?? 0);
  });

  it("does not surface expired postings", () => {
    const ranked = rankJobListings(createPdfResumeFixture(), [
      { ...listings[0]!, id: "expired", active: false },
      listings[0]!
    ]);

    expect(ranked.map((listing) => listing.id)).toEqual(["saramin-1"]);
  });
});
