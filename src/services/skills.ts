import { invoke } from "@tauri-apps/api/core";

export interface SkillMetadata {
  name: string;
  description: string;
  path: string;
  content: string;
}

const mentionPatternFor = (name: string) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\w:-])\\$${escaped}(?=$|[^\\w:-])`, "i");
};

export async function loadSkills(): Promise<SkillMetadata[]> {
  return invoke<SkillMetadata[]>("list_skills");
}

export function selectMentionedSkills(input: string, skills: SkillMetadata[]) {
  const selected = new Map<string, SkillMetadata>();

  for (const skill of skills) {
    if (mentionPatternFor(skill.name).test(input)) {
      selected.set(skill.path, skill);
    }
  }

  return Array.from(selected.values());
}
