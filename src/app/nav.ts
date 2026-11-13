import type { LucideIcon } from 'lucide-react';
import {
  Sun,
  Lightbulb,
  Frame,
  Palette,
  Calculator,
  ListOrdered,
  LayoutGrid,
  Clapperboard,
  Award,
  CalendarClock,
  ListChecks,
  FileDown,
  Settings,
  FolderOpen,
} from 'lucide-react';

export interface Tool {
  index: string;
  id: string;
  path: string;
  name: string;
  short: string;
  description: string;
  icon: LucideIcon;
  tab?: boolean;
}

export const TOOLS: Tool[] = [
  { index: '01', id: 'plan', path: '/plan', name: 'Sun and Moon Planner', short: 'Plan', description: 'Sun and moon position, golden hour, twilight, shadow length, saved plans.', icon: Sun, tab: true },
  { index: '02', id: 'light', path: '/light', name: 'Lighting Diagram', short: 'Light', description: 'Top-down lighting plans with a live 3D preview and exposure ratios.', icon: Lightbulb, tab: true },
  { index: '03', id: 'frame', path: '/frame', name: 'Shot Designer', short: 'Frame', description: 'Compose frames with guides, silhouettes, lens field of view and blur.', icon: Frame, tab: true },
  { index: '04', id: 'colour', path: '/colour', name: 'Colour Studio', short: 'Colour', description: 'OKLCH palettes, extraction from stills, contrast checks, colour script.', icon: Palette, tab: true },
  { index: '05', id: 'calc', path: '/calc', name: 'Calculators', short: 'Calc', description: 'Exposure, depth of field, field of view, time lapse, storage and more.', icon: Calculator, tab: true },
  { index: '06', id: 'shots', path: '/shots', name: 'Shot List', short: 'Shots', description: 'Scenes and shots with lens, movement, status, filters and CSV export.', icon: ListOrdered, tab: true },
  { index: '07', id: 'storyboard', path: '/storyboard', name: 'Storyboard', short: 'Board', description: 'Frames from compositions, images or sketches with captions and timing.', icon: LayoutGrid },
  { index: '08', id: 'slate', path: '/slate', name: 'Slate', short: 'Slate', description: 'Full-screen clapperboard with live timecode, take counter and clap.', icon: Clapperboard },
  { index: '09', id: 'awards', path: '/awards', name: 'Astris Awards', short: 'Awards', description: 'Ceremony categories, nominee cards and an envelope reveal.', icon: Award },
  { index: '10', id: 'callsheet', path: '/callsheet', name: 'Call Sheet', short: 'Call', description: 'Date, call time, location, sun times, people and schedule.', icon: CalendarClock },
  { index: '11', id: 'checklist', path: '/checklist', name: 'Gear Checklist', short: 'Gear', description: 'Templated kit lists you tick off per project.', icon: ListChecks },
  { index: '12', id: 'export', path: '/export', name: 'Shoot Pack', short: 'Export', description: 'Branded PDF of the whole project, plus PNG and JSON exports.', icon: FileDown },
];

export const UTILITY_NAV = [
  { id: 'projects', path: '/projects', name: 'Projects', icon: FolderOpen },
  { id: 'settings', path: '/settings', name: 'Settings', icon: Settings },
];

export const TAB_TOOLS = TOOLS.filter((t) => t.tab);
export const MORE_TOOLS = TOOLS.filter((t) => !t.tab);

export function toolByPath(pathname: string): Tool | undefined {
  return TOOLS.find((t) => pathname === t.path || pathname.startsWith(t.path + '/'));
}
