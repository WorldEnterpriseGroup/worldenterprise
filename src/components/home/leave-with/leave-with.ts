/**
 * What a founder leaves each stage holding, as data for the home page (wave 7, WP-44).
 *
 * Everything here is read from src/components/program/stages.ts and nothing is typed again: the exit evidence sentences and the
 * artifact links are the stage data's own objects, so the home page and the stage pages cannot disagree. Exit evidence lists
 * inspectable things, never outcomes (claims C-04, C-05, C-16). There is no count, no duration and no figure in this module.
 *
 * Pure data, free of Astro globals, so `node --test` imports it.
 */
import { STAGES } from '../../program/stages.ts';
import type { Altitude, ArtifactLink, Stage, StageId } from '../../program/stages.ts';

/** How many exit-evidence sentences a column shows. The stage page lists all of them. */
export const HOLDING_LIMIT = 3;

/** How many working-material links a column shows. The three columns stay the same height. */
export const MATERIAL_LIMIT = 3;

/** The artifact kinds that count as working material. An Insight is reading, and the latest insights have their own band. */
export const MATERIAL_KINDS: readonly ArtifactLink['kind'][] = ['Playbook', 'Template', 'Guide'];

export interface LeaveWithColumn {
  readonly id: StageId;
  readonly name: string;
  readonly altitude: Altitude;
  readonly promise: string;
  /** Ledger path of the stage page. */
  readonly path: string;
  /** Exit evidence, verbatim from the stage data. */
  readonly holding: readonly string[];
  /** Playbooks, templates and guides of the stage, as the stage data lists them. */
  readonly material: readonly ArtifactLink[];
}

export function leaveWithColumn(stage: Stage): LeaveWithColumn {
  return {
    id: stage.id,
    name: stage.name,
    altitude: stage.altitude,
    promise: stage.promise,
    path: stage.path,
    holding: stage.exitEvidence.slice(0, HOLDING_LIMIT),
    material: stage.artifacts.filter((artifact) => MATERIAL_KINDS.includes(artifact.kind)).slice(0, MATERIAL_LIMIT),
  };
}

/** One column per stage, in the stage order: Dream, Build, Grow. */
export function leaveWithColumns(stages: readonly Stage[] = STAGES): readonly LeaveWithColumn[] {
  return stages.map(leaveWithColumn);
}
