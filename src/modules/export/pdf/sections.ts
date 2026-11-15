import type { Project } from '@/types/project';

export type SectionId = 'cover' | 'callsheet' | 'shots' | 'storyboard' | 'frames' | 'lighting' | 'colour' | 'sunplan' | 'checklist';

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'cover', label: 'Cover' },
  { id: 'callsheet', label: 'Call sheet' },
  { id: 'shots', label: 'Shot list' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'frames', label: 'Composition frames' },
  { id: 'lighting', label: 'Lighting diagrams' },
  { id: 'colour', label: 'Colour palettes and script' },
  { id: 'sunplan', label: 'Sun and moon plan' },
  { id: 'checklist', label: 'Gear checklist' },
];

export function sectionCount(id: SectionId, p: Project): number | null {
  switch (id) {
    case 'cover':
    case 'callsheet':
    case 'sunplan':
      return null;
    case 'shots':
      return p.shots.length;
    case 'storyboard':
      return p.storyboard.length;
    case 'frames':
      return p.compositions.length;
    case 'lighting':
      return p.diagrams.length;
    case 'colour':
      return p.palettes.length + p.colourScript.length;
    case 'checklist':
      return p.checklist.length;
  }
}
