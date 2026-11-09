import { describe, expect, it } from "vitest";

import { rankJobListings, resolveJobSearchQuery } from "@/features/jobs/model/job-search";
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

  it("does not surface expired postings", () => {
    const ranked = rankJobListings(createPdfResumeFixture(), [
      { ...listings[0]!, id: "expired", active: false },
      listings[0]!
    ]);

    expect(ranked.map((listing) => listing.id)).toEqual(["saramin-1"]);
  });
});
