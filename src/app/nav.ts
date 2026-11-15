import type { LucideIcon } from 'lucide-react';
import {
  Map as MapIcon,
  Boxes,
  Sun,
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
  Wrench,
} from 'lucide-react';

export interface Tool {
  index: string;
  id: string;
  path: string;
  name: string;
  short: string;
  description: string;
  icon: LucideIcon;
  group: 'plan' | 'toolkit';
  tab?: boolean;
}

export const TOOLS: Tool[] = [
  { index: '01', id: 'plan', path: '/plan', name: 'Shoot Plan', short: 'Plan', description: 'Cameras, lighting, audio and home base on one plan, with views for each.', icon: MapIcon, group: 'plan', tab: true },
  { index: '02', id: 'gear', path: '/gear', name: 'Gear', short: 'Gear', description: 'Your kit with inputs and outputs, connections, and the equipment list.', icon: Boxes, group: 'plan', tab: true },
  { index: '03', id: 'shots', path: '/shots', name: 'Shot List', short: 'Shots', description: 'Scenes and shots with lens, movement, status and CSV export.', icon: ListOrdered, group: 'plan', tab: true },
  { index: '04', id: 'storyboard', path: '/storyboard', name: 'Storyboard', short: 'Board', description: 'Frames from compositions, images or sketches.', icon: LayoutGrid, group: 'plan', tab: true },
  { index: '05', id: 'callsheet', path: '/callsheet', name: 'Call Sheet', short: 'Call', description: 'Date, call time, location, sun times, people and schedule.', icon: CalendarClock, group: 'plan', tab: true },
  { index: '06', id: 'checklist', path: '/checklist', name: 'Packing Checklist', short: 'Pack', description: 'Tick off the equipment list and templates as you pack.', icon: ListChecks, group: 'plan' },
  { index: '07', id: 'export', path: '/export', name: 'Shoot Pack', short: 'Export', description: 'PDF of the whole plan, plus PNG, CSV and JSON downloads.', icon: FileDown, group: 'plan' },
  { index: '08', id: 'sun', path: '/sun', name: 'Sun and Moon', short: 'Sun', description: 'Sun and moon position, golden hour, twilight, shadow length.', icon: Sun, group: 'toolkit' },
  { index: '09', id: 'calc', path: '/calc', name: 'Calculators', short: 'Calc', description: 'Exposure, depth of field, field of view, time lapse and more.', icon: Calculator, group: 'toolkit' },
  { index: '10', id: 'frame', path: '/frame', name: 'Shot Designer', short: 'Frame', description: 'Compose frames with guides, silhouettes and lens coverage.', icon: Frame, group: 'toolkit' },
  { index: '11', id: 'colour', path: '/colour', name: 'Colour Studio', short: 'Colour', description: 'Palettes, extraction from stills, contrast, colour script.', icon: Palette, group: 'toolkit' },
  { index: '12', id: 'slate', path: '/slate', name: 'Slate', short: 'Slate', description: 'Full-screen clapperboard with timecode and take counter.', icon: Clapperboard, group: 'toolkit' },
  { index: '13', id: 'awards', path: '/awards', name: 'Astris Awards', short: 'Awards', description: 'Ceremony cards and an envelope reveal.', icon: Award, group: 'toolkit' },
];

export const UTILITY_NAV = [
  { id: 'projects', path: '/projects', name: 'Projects', icon: FolderOpen },
  { id: 'settings', path: '/settings', name: 'Settings', icon: Settings },
];

export const TOOLKIT_TAB = { id: 'toolkit', path: '/toolkit', name: 'Toolkit', short: 'Toolkit', icon: Wrench };

export const TAB_TOOLS = TOOLS.filter((t) => t.tab);
export const PLAN_TOOLS = TOOLS.filter((t) => t.group === 'plan');
export const KIT_TOOLS = TOOLS.filter((t) => t.group === 'toolkit');

export function toolByPath(pathname: string): Tool | undefined {
  return TOOLS.find((t) => pathname === t.path || pathname.startsWith(t.path + '/'));
}
