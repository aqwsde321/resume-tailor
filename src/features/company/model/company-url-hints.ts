import type { Company } from "@/shared/lib/types";

type CompanyIdentityHints = Partial<Pick<Company, "companyName" | "jobTitle">>;

export function applyUrlCompanyHints(company: Company, hints: CompanyIdentityHints): Company {
  return {
    ...company,
    companyName: company.companyName.trim() || hints.companyName?.trim() || "",
    jobTitle: company.jobTitle.trim() || hints.jobTitle?.trim() || ""
  };
}
