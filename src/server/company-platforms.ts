/** Platform DOM contracts. Keep endpoint/status notes in docs/JOB_SOURCE_PLATFORMS.md. */
export interface CompanyPlatform {
  id: string;
  domains: string[];
  selectors: string[];
  descriptionSelector?: string;
  expandButtonName?: RegExp;
}
export const COMPANY_PLATFORMS: CompanyPlatform[] = [
  { id: "wanted", domains: ["wanted.co.kr"], selectors: ["article[class*='JobDescription_JobDescription__']", "main", "[class*='JobContent']", ".content"], descriptionSelector: "article[class*='JobDescription_JobDescription__']", expandButtonName: /상세\s*정보\s*더\s*보기/ },
  // Jumpit must precede Saramin because jumpit.saramin.co.kr is a subdomain.
  { id: "jumpit", domains: ["jumpit.saramin.co.kr", "jumpit.co.kr"], selectors: ["main", "[class*='JobDescription']", "[class*='Position']", ".content"] },
  { id: "saramin", domains: ["saramin.co.kr"], selectors: ["#content", ".tplJobView", ".viewArea", "main"] },
  { id: "jobkorea", domains: ["jobkorea.co.kr"], selectors: ["#content", ".tplJobView", ".viewArea", "main"] },
  { id: "groupby", domains: ["groupby.kr"], selectors: [] },
  { id: "greenhouse", domains: ["greenhouse.io"], selectors: ["#content", "#app_body", ".content", ".opening"] },
  { id: "lever", domains: ["lever.co"], selectors: [".posting-page", ".posting", ".main-content", ".section-wrapper"] },
  { id: "workable", domains: ["workable.com"], selectors: ["[data-ui='job-description']", ".job-description", ".content"] },
];
export function getCompanyPlatform(hostname: string): CompanyPlatform | undefined {
  const host = hostname.toLowerCase();
  return COMPANY_PLATFORMS.find((platform) => platform.domains.some((domain) => host === domain || host.endsWith(`.${domain}`)));
}

// These are web-page detail endpoints, not officially contracted search APIs.
export const COMPANY_PLATFORM_WEB_ENDPOINTS = {
  saramin: { relayAjax: "/zf_user/jobs/relay/view-ajax" },
  jobkorea: { detailIframe: "/Recruit/GI_Read_Comt_Ifrm" },
} as const;
