import { describe, expect, it } from "vitest";

import {
  buildPdfAtsAudit,
  parsePdfAtsAuditHeader
} from "@/entities/pdf/model/ats-audit";
import { companyFixture, createPdfResumeFixture } from "../fixtures/pdf-fixture";

describe("PDF ATS text audit", () => {
  it("checks extracted name, contact details, and job keywords", () => {
    const resume = createPdfResumeFixture({
      name: "Jino Lee",
      contacts: [
        { label: "Email", value: "jino@example.com", url: "" },
        { label: "Phone", value: "010-1234-5678", url: "" }
      ]
    });
    const company = {
      ...companyFixture,
      requirements: ["Node.js와 PostgreSQL을 활용한 API 개발 경험"],
      techStack: ["Node.js", "PostgreSQL"],
      preferredSkills: ["AWS", "Kubernetes"]
    };

    const audit = buildPdfAtsAudit(
      "Jino Lee\nEmail: jino@example.com\nPhone: 010-1234-5678\n\nNode.js PostgreSQL API 운영 경험",
      resume,
      company
    );

    expect(audit.status).toBe("checked");
    expect(audit.textCharacterCount).toBeGreaterThan(0);
    expect(audit.nameFound).toBe(true);
    expect(audit.contacts).toEqual([
      { label: "Email", found: true },
      { label: "Phone", found: true }
    ]);
    expect(audit.requiredTerms.matched).toEqual(expect.arrayContaining(["Node.js", "PostgreSQL", "API"]));
    expect(audit.preferredTerms.missing).toEqual(expect.arrayContaining(["AWS", "Kubernetes"]));
    expect(audit.textPreview).toContain("Jino Lee");
  });

  it("does not mark absent resume details as missing fields", () => {
    const resume = createPdfResumeFixture({ name: "", contacts: [] });

    const audit = buildPdfAtsAudit("Some extracted text", resume, companyFixture);

    expect(audit.nameFound).toBeNull();
    expect(audit.contacts).toEqual([]);
  });

  it("requires whole keyword tokens instead of matching substrings", () => {
    const company = { ...companyFixture, requirements: [], techStack: ["Java"], preferredSkills: [] };
    const audit = buildPdfAtsAudit("JavaScript developer", createPdfResumeFixture({ name: "" }), company);

    expect(audit.requiredTerms.matched).toEqual([]);
    expect(audit.requiredTerms.missing).toEqual(["Java"]);
  });

  it("does not count a link target that is not displayed in the PDF", () => {
    const resume = createPdfResumeFixture({
      name: "",
      contacts: [{ label: "Portfolio", value: "", url: "https://portfolio.example.com" }]
    });

    const audit = buildPdfAtsAudit("https://portfolio.example.com", resume, companyFixture);

    expect(audit.contacts).toEqual([]);
  });

  it("decodes a valid audit response header and rejects malformed data", () => {
    const audit = buildPdfAtsAudit("Jino Lee Node.js", createPdfResumeFixture({ name: "Jino Lee" }), companyFixture);
    const header = Buffer.from(JSON.stringify(audit), "utf8").toString("base64url");

    expect(parsePdfAtsAuditHeader(header)).toEqual(audit);
    expect(parsePdfAtsAuditHeader("not-a-valid-header")).toBeNull();
    expect(parsePdfAtsAuditHeader(null)).toBeNull();
  });
});
