import { describe, expect, it } from "vitest";

import { createUrlJobListing, rankJobListings, sortRankedJobListings } from "@/features/jobs/model/job-analysis";
import { createPdfResumeFixture } from "../fixtures/pdf-fixture";

const company = {
  companyName: "Acme",
  companyDescription: "결제 플랫폼",
  jobTitle: "Backend Engineer",
  jobDescription: "주문 API 개발",
  requirements: ["Java 서버 개발 경험"],
  preferredSkills: ["PostgreSQL 경험"],
  techStack: ["Java", "Spring Boot", "PostgreSQL"]
};

const listings = [
  {
    id: "url-1",
    source: "url" as const,
    title: "Backend Engineer",
    companyName: "Acme",
    url: "https://jobs.example.com/backend-1",
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
    id: "url-2",
    source: "url" as const,
    title: "Product Designer",
    companyName: "Other",
    url: "https://jobs.example.com/designer-2",
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

describe("job posting URL analysis", () => {
  it("turns parsed content from a user-provided URL into a rankable listing", () => {
    const listing = createUrlJobListing(company, {
      id: "url-1",
      url: "https://jobs.example.com/backend-1",
      postedAt: "2026-11-10"
    });

    expect(listing).toMatchObject({
      id: "url-1",
      source: "url",
      title: "Backend Engineer",
      companyName: "Acme",
      url: "https://jobs.example.com/backend-1",
      keywords: ["Java", "Spring Boot", "PostgreSQL", "Java 서버 개발 경험", "PostgreSQL 경험"],
      postedAt: "2026-11-10"
    });
    expect(rankJobListings(createPdfResumeFixture(), [listing])[0]).toMatchObject({ fit: "high" });
  });

  it("ranks analyzed postings using resume skills, role text, and career requirements", () => {
    const ranked = rankJobListings(createPdfResumeFixture(), listings);

    expect(ranked[0]).toMatchObject({
      id: "url-1",
      fit: "high",
      matchedSkills: ["Java", "Spring Boot", "PostgreSQL"]
    });
    expect(ranked[0]?.reasons.join(" ")).toContain("Backend Engineer");
    expect(ranked[1]).toMatchObject({ id: "url-2", fit: "low", matchedSkills: [] });
  });

  it("orders URL analyses by relevance score", () => {
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

    expect(ranked.map((listing) => listing.id)).toEqual(["url-1"]);
  });

  it("does not grant career-fit points when a posting has no career information", () => {
    const ranked = rankJobListings(createPdfResumeFixture(), [
      {
        ...listings[0]!,
        id: "career-unspecified",
        keywords: ["Java"],
        careerLabel: "",
        careerMinYears: null,
        careerMaxYears: null
      }
    ]);

    expect(ranked[0]).toMatchObject({ relevanceScore: 60, fit: "medium" });
  });
});
