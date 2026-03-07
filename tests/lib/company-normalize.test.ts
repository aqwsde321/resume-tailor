import { describe, expect, it } from "vitest";

import { normalizeCompany } from "@/lib/company-normalize";

import { companyNormalizationCases } from "../fixtures/company-cases";

describe("normalizeCompany", () => {
  for (const fixture of companyNormalizationCases) {
    it(fixture.name, () => {
      const normalized = normalizeCompany(fixture.input);

      fixture.expected.requirements?.forEach((item) => {
        expect(normalized.requirements).toContain(item);
      });
      fixture.expected.requirementsExcludes?.forEach((item) => {
        expect(normalized.requirements.join(" ")).not.toContain(item);
      });

      fixture.expected.preferredSkills?.forEach((item) => {
        expect(normalized.preferredSkills).toContain(item);
      });
      fixture.expected.preferredExcludes?.forEach((item) => {
        expect(normalized.preferredSkills.join(" ")).not.toContain(item);
      });

      fixture.expected.techStack?.forEach((item) => {
        expect(normalized.techStack).toContain(item);
      });

      fixture.expected.companyDescriptionIncludes?.forEach((item) => {
        expect(normalized.companyDescription).toContain(item);
      });
      fixture.expected.companyDescriptionExcludes?.forEach((item) => {
        expect(normalized.companyDescription).not.toContain(item);
      });

      fixture.expected.jobDescriptionIncludes?.forEach((item) => {
        expect(normalized.jobDescription).toContain(item);
      });
      fixture.expected.jobDescriptionExcludes?.forEach((item) => {
        expect(normalized.jobDescription).not.toContain(item);
      });
    });
  }
});
