import { load } from "cheerio";
import { getCompanyPlatform } from "./company-platforms";

/** The scoped article excludes related jobs, application buttons and legal notices. */
export function readWantedJobDescription(html: string, hostname: string): { text: string; collapsed: boolean } | null {
  const platform = getCompanyPlatform(hostname);
  if (platform?.id !== "wanted" || !platform.descriptionSelector) return null;
  const $ = load(html);
  const article = $(platform.descriptionSelector).first();
  if (!article.length) return null;
  const collapsed = article.find("button").toArray().some((button) => platform.expandButtonName!.test($(button).text()));
  article.find("button,script,style,noscript,svg").remove();
  article.find("br").replaceWith("\n");
  article.find("p,div,section,article,li,ul,ol,h1,h2,h3,h4,h5,h6").prepend("\n").append("\n");
  const text = article.text().replace(/\r\n?/g, "\n").split("\n").map((line) => line.replace(/[\t\u00a0 ]+/g, " ").trim()).filter(Boolean).join("\n");
  return { text, collapsed };
}
