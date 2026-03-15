"use client";

import {
  makeEmptyContact,
  makeEmptyExperience,
  makeEmptyProject
} from "@/lib/resume-utils";

import type { ResumeUpdater } from "./types";

export function createContactAction(updateResume: ResumeUpdater, exporting: boolean) {
  return (
    <button
      type="button"
      className="secondary"
      onClick={() =>
        updateResume((current) => ({
          ...current,
          contacts: [...current.contacts, makeEmptyContact()]
        }))
      }
      disabled={exporting}
    >
      연락처 추가
    </button>
  );
}

export function createExperienceAction(updateResume: ResumeUpdater, exporting: boolean) {
  return (
    <button
      type="button"
      className="secondary"
      onClick={() =>
        updateResume((current) => ({
          ...current,
          experience: [...current.experience, makeEmptyExperience()]
        }))
      }
      disabled={exporting}
    >
      경력 추가
    </button>
  );
}

export function createProjectAction(updateResume: ResumeUpdater, exporting: boolean) {
  return (
    <button
      type="button"
      className="secondary"
      onClick={() =>
        updateResume((current) => ({
          ...current,
          projects: [...current.projects, makeEmptyProject()]
        }))
      }
      disabled={exporting}
    >
      프로젝트 추가
    </button>
  );
}
