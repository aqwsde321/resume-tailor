"use client";

import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";

import { PdfPreviewPane } from "@/app/components/pdf-editor/preview-pane";
import {
  ContactsSectionForm,
  createContactAction,
  createExperienceAction,
  createProjectAction,
  ExperienceSectionForm,
  HeaderSectionForm,
  HighlightsSectionForm,
  IntroSectionForm,
  ProjectsSectionForm,
  SkillsSectionForm,
  StrengthsSectionForm
} from "@/app/components/pdf-editor/section-forms";
import { PdfEditorModalSection } from "@/app/components/pdf-editor/section-modal";
import { useTypstPreview } from "@/app/components/pdf-editor/use-typst-preview";
import type { PdfSectionKey } from "@/app/components/pdf-editor/types";
import { parseInlineItems, stringifyInlineList } from "@/lib/list-input";
import type { Company, Intro, Resume } from "@/lib/types";

interface PdfEditorWorkspaceProps {
  company: Company;
  error: string;
  exporting: boolean;
  intro: Intro;
  onCompanyChange: (nextCompany: Company) => void;
  onExport: () => void;
  onIntroChange: (nextIntro: Intro) => void;
  onResumeChange: (nextResume: Resume) => void;
  rootRef?: RefObject<HTMLElement | null>;
  resume: Resume;
}

interface SectionConfig {
  action?: ReactNode;
  body: ReactNode;
  chipTitle?: string;
  description?: string;
  key: PdfSectionKey;
  kicker: string;
  summary: string;
  title: string;
}

function buildInlineListSignature(values: string[]) {
  return values.join("\u0001");
}

export function PdfEditorWorkspace({
  company,
  error,
  exporting,
  intro,
  onCompanyChange,
  onExport,
  onIntroChange,
  onResumeChange,
  rootRef,
  resume
}: PdfEditorWorkspaceProps) {
  const typstPreview = useTypstPreview({ company, intro, resume });
  const [openSection, setOpenSection] = useState<PdfSectionKey | null>(null);
  const [skillsDraft, setSkillsDraft] = useState(() => ({
    signature: buildInlineListSignature(resume.techStack),
    text: stringifyInlineList(resume.techStack)
  }));
  const [projectTechStackDrafts, setProjectTechStackDrafts] = useState(() =>
    resume.projects.map((project) => ({
      signature: buildInlineListSignature(project.techStack),
      text: stringifyInlineList(project.techStack)
    }))
  );
  const resumeTechStackSignature = useMemo(
    () => buildInlineListSignature(resume.techStack),
    [resume.techStack]
  );
  const projectTechStackSignatures = useMemo(
    () => resume.projects.map((project) => buildInlineListSignature(project.techStack)),
    [resume.projects]
  );

  useEffect(() => {
    if (!openSection) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenSection(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openSection]);

  useEffect(() => {
    document.body.classList.toggle("pdf-modal-open", Boolean(openSection));

    return () => {
      document.body.classList.remove("pdf-modal-open");
    };
  }, [openSection]);

  const updateResume = (updater: (current: Resume) => Resume) => {
    onResumeChange(updater(resume));
  };

  const resolvedSkillsText =
    skillsDraft.signature === resumeTechStackSignature
      ? skillsDraft.text
      : stringifyInlineList(resume.techStack);

  const resolvedProjectTechStackTexts = useMemo(
    () =>
      resume.projects.map((project, index) =>
        projectTechStackDrafts[index]?.signature === projectTechStackSignatures[index]
          ? projectTechStackDrafts[index]?.text ?? stringifyInlineList(project.techStack)
          : stringifyInlineList(project.techStack)
      ),
    [projectTechStackDrafts, projectTechStackSignatures, resume.projects]
  );

  const handleSkillsTextChange = (value: string) => {
    const nextTechStack = parseInlineItems(value);
    setSkillsDraft({
      signature: buildInlineListSignature(nextTechStack),
      text: value
    });
    updateResume((current) => ({
      ...current,
      techStack: nextTechStack
    }));
  };

  const handleProjectTechStackTextChange = (index: number, value: string) => {
    const nextTechStack = parseInlineItems(value);

    setProjectTechStackDrafts((current) => {
      const nextValues = [...current];
      nextValues[index] = {
        signature: buildInlineListSignature(nextTechStack),
        text: value
      };
      return nextValues;
    });

    updateResume((current) => ({
      ...current,
      projects: current.projects.map((item, itemIndex) =>
        itemIndex === index ? { ...item, techStack: nextTechStack } : item
      )
    }));
  };

  const sections: SectionConfig[] = [
    {
      key: "header",
      kicker: "Header",
      title: "상단 헤더",
      chipTitle: "상단",
      description: "첫 화면 기준으로 이름, 직무, 회사 정보를 맞춥니다.",
      summary: "기본",
      body: (
        <HeaderSectionForm
          company={company}
          exporting={exporting}
          onCompanyChange={onCompanyChange}
          resume={resume}
          updateResume={updateResume}
        />
      )
    },
    {
      key: "contacts",
      kicker: "Contacts",
      title: "연락처",
      chipTitle: "연락",
      description: "값이 있는 항목만 PDF에 노출됩니다.",
      summary: `${resume.contacts.length}개`,
      action: createContactAction(updateResume, exporting),
      body: (
        <ContactsSectionForm
          exporting={exporting}
          resume={resume}
          updateResume={updateResume}
        />
      )
    },
    {
      key: "intro",
      kicker: "Tailored Intro",
      title: "소개글",
      chipTitle: "소개",
      description: `${company.companyName || "회사"} 기준으로 들어가는 최종 문장입니다.`,
      summary: intro.longIntro.trim() ? "본문" : "빈칸",
      body: (
        <IntroSectionForm
          companyName={company.companyName}
          exporting={exporting}
          intro={intro}
          onIntroChange={onIntroChange}
        />
      )
    },
    {
      key: "experience",
      kicker: "Experience",
      title: "경력",
      chipTitle: "경력",
      description: "핵심 역할과 기간만 명확하면 충분합니다.",
      summary: `${resume.experience.length}개`,
      action: createExperienceAction(updateResume, exporting),
      body: (
        <ExperienceSectionForm
          exporting={exporting}
          resume={resume}
          updateResume={updateResume}
        />
      )
    },
    {
      key: "highlights",
      kicker: "Highlights",
      title: "Highlights",
      chipTitle: "핵심",
      description: "한 줄이 항목 1개입니다.",
      summary: `${resume.pdfHighlights.length}개`,
      body: (
        <HighlightsSectionForm
          exporting={exporting}
          resume={resume}
          updateResume={updateResume}
        />
      )
    },
    {
      key: "projects",
      kicker: "Projects",
      title: "프로젝트",
      chipTitle: "프로젝트",
      description: "step 1에 없던 링크와 부제목도 여기서 바로 반영됩니다.",
      summary: `${resume.projects.length}개`,
      action: createProjectAction(updateResume, exporting),
      body: (
        <ProjectsSectionForm
          exporting={exporting}
          onProjectTechStackTextChange={handleProjectTechStackTextChange}
          projectTechStackTexts={resolvedProjectTechStackTexts}
          resume={resume}
          updateResume={updateResume}
        />
      )
    },
    {
      key: "skills",
      kicker: "Skills",
      title: "기술 스택",
      chipTitle: "스택",
      description: "미리보기에서는 자동 그룹화됩니다.",
      summary: `${resume.techStack.length}개`,
      body: (
        <SkillsSectionForm
          exporting={exporting}
          onSkillsTextChange={handleSkillsTextChange}
          resume={resume}
          skillsText={resolvedSkillsText}
          updateResume={updateResume}
        />
      )
    },
    {
      key: "strengths",
      kicker: "Strengths",
      title: "Strengths",
      chipTitle: "강점",
      description: "한 줄이 항목 1개입니다.",
      summary: `${resume.pdfStrengths.length}개`,
      body: (
        <StrengthsSectionForm
          exporting={exporting}
          resume={resume}
          updateResume={updateResume}
        />
      )
    }
  ];

  return (
    <section className="pdf-workspace" ref={rootRef}>
      {error && <p className="status error">{error}</p>}

      <div className="pdf-workspace-grid">
        <div className="pdf-editor-pane">
          <p className="pdf-editor-toolbar-label">수정 섹션</p>

          {sections.map((section) => (
            <PdfEditorModalSection
              key={section.key}
              action={section.action}
              chipTitle={section.chipTitle}
              description={section.description}
              isActive={openSection === section.key}
              kicker={section.kicker}
              onClose={() => setOpenSection(null)}
              onOpen={() => setOpenSection(section.key)}
              summary={section.summary}
              title={section.title}
            >
              {section.body}
            </PdfEditorModalSection>
          ))}
        </div>

        <PdfPreviewPane
          company={company}
          intro={intro}
          resume={resume}
          typstPreview={typstPreview}
        />
      </div>

      <div className="pdf-workspace-footer">
        <div className="action-copy">
          <strong>{company.companyName || "회사"} PDF</strong>
          <span>미리보기 기준으로 확인한 뒤 최종 PDF를 내보냅니다.</span>
        </div>
        <div className="action-row">
          <button type="button" className="primary" onClick={onExport} disabled={exporting}>
            {exporting ? "PDF 만드는 중..." : "PDF 내보내기"}
          </button>
        </div>
      </div>
    </section>
  );
}
