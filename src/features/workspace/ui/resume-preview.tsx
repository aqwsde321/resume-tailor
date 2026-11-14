import type { Resume } from "@/shared/lib/types";

export function ResumePreview({ resume }: { resume: Resume }) {
  return <article className="studio-resume-preview" aria-label="정리된 이력서">
    <header><h3>{resume.name || "내 이력서"}</h3>{(resume.headline || resume.desiredPosition) && <p className="studio-preview-role">{resume.headline || resume.desiredPosition}</p>}
      {(resume.careerDurationText || resume.careerYears > 0) && <p className="studio-entry-role">경력 {resume.careerDurationText || `${resume.careerYears}년`}</p>}
      {resume.contacts.length > 0 && <ul className="studio-preview-contacts">{resume.contacts.map((contact, index) => <li key={index}>{contact.label && <span>{contact.label} </span>}{contact.value || contact.url}</li>)}</ul>}
    </header>
    {resume.summary && <section><h4>소개</h4><p className="studio-preview-copy">{resume.summary}</p></section>}
    {resume.techStack.length > 0 && <section><h4>기술</h4><ul className="studio-skill-list">{resume.techStack.map((skill, index) => <li key={index}>{skill}</li>)}</ul></section>}
    {resume.experience.length > 0 && <section><h4>경력</h4>{resume.experience.map((item, index) => <article className="studio-preview-entry" key={index}><div><h5>{item.company || item.role}</h5><span>{item.period}</span></div>{item.company && item.role && <p className="studio-entry-role">{item.role}</p>}<p className="studio-preview-copy">{item.description}</p></article>)}</section>}
    {resume.projects.length > 0 && <section><h4>프로젝트</h4>{resume.projects.map((item, index) => <article className="studio-preview-entry" key={index}><div><h5>{item.name}</h5><span>{item.period}</span></div>{(item.company || item.role || item.subtitle) && <p className="studio-entry-role">{[item.company, item.role].filter(Boolean).join(" · ") || item.subtitle}</p>}<p className="studio-preview-copy">{item.description}</p>{item.techStack.length > 0 && <ul className="studio-skill-list">{item.techStack.map((skill, skillIndex) => <li key={skillIndex}>{skill}</li>)}</ul>}{item.highlights.length > 0 && <ul>{item.highlights.map((highlight, itemIndex) => <li key={itemIndex}>{highlight}</li>)}</ul>}{item.link && <p className="studio-preview-link">{item.linkLabel ? `${item.linkLabel}: ${item.link}` : item.link}</p>}</article>)}</section>}
    {[{ title: "학력", items: resume.education ?? [] }, { title: "자격·교육", items: resume.qualifications ?? [] }, { title: "주요 성과", items: resume.achievements }, { title: "강점", items: resume.strengths }].filter((group) => group.items.length).map((group) => <section key={group.title}><h4>{group.title}</h4><ul>{group.items.map((item, index) => <li key={index}>{item}</li>)}</ul></section>)}
  </article>;
}
