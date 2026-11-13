import { uid } from '@/lib/id';
import type { Composition, Project, Shot, StoryboardFrame, LightingDiagram } from '@/types/project';
import { classifyShotSize } from '@/lib/frame/shotSize';
import { useProjects } from './projects';

export function nextShotNumber(project: Project, scene: number): string {
  const inScene = project.shots.filter((s) => s.scene === scene);
  return String.fromCharCode(65 + (inScene.length % 26)) + (inScene.length >= 26 ? Math.floor(inScene.length / 26) + 1 : '');
}

export function createShot(project: Project, partial: Partial<Shot> = {}): Shot {
  const scene = partial.scene ?? (project.shots.length ? Math.max(...project.shots.map((s) => s.scene)) : 1);
  return {
    id: uid(),
    scene,
    shotNumber: nextShotNumber(project, scene),
    size: '',
    angle: '',
    movement: '',
    lens: '',
    aperture: '',
    fps: '',
    location: '',
    description: '',
    equipment: '',
    status: 'planned',
    order: project.shots.length + 1,
    ...partial,
  };
}

/** Create a shot-list entry from a composition. Returns the new shot id. */
export function sendCompositionToShotList(comp: Composition): string {
  const store = useProjects.getState();
  const project = store.currentId ? store.projects[store.currentId] : null;
  if (!project) return '';
  const shot = createShot(project, {
    size: classifyShotSize(comp.elements) ?? '',
    angle: comp.angle,
    movement: comp.movement,
    lens: `${comp.focalLength} mm`,
    aperture: `f/${comp.aperture}`,
    description: comp.name,
    compositionId: comp.id,
    paletteId: comp.paletteId,
  });
  store.patchCurrent((p) => ({ shots: [...p.shots, shot] }));
  return shot.id;
}

/** Create a storyboard frame from a composition. Returns the new frame id. */
export function sendCompositionToStoryboard(comp: Composition): string {
  const store = useProjects.getState();
  const frame: StoryboardFrame = {
    id: uid(),
    order: 0,
    source: 'composition',
    compositionId: comp.id,
    strokes: [],
    caption: comp.name,
    dialogue: '',
    size: classifyShotSize(comp.elements) ?? '',
    movement: comp.movement,
    lens: `${comp.focalLength} mm`,
    durationSec: 4,
  };
  store.patchCurrent((p) => ({ storyboard: [...p.storyboard, { ...frame, order: p.storyboard.length + 1 }] }));
  return frame.id;
}

export function attachDiagramToShot(diagram: LightingDiagram, shotId: string) {
  useProjects.getState().patchCurrent((p) => ({ shots: p.shots.map((s) => (s.id === shotId ? { ...s, diagramId: diagram.id } : s)) }));
}

export function emptyComposition(name: string, focalLength: number, aperture: number): Composition {
  return {
    id: uid(),
    name,
    aspect: '16:9',
    guides: { thirds: true, goldenRatio: false, goldenSpiral: false, goldenTriangles: false, diagonals: false, centre: false, actionSafe: false, titleSafe: false, headroom: false, leadRoom: false },
    elements: [{ id: uid(), kind: 'standing', x: 0.4, y: 1.15, scale: 1.2, flip: false }],
    angle: 'eye',
    movement: 'static',
    focalLength,
    aperture,
    subjectDistance: 3,
    backgroundOpacity: 0.6,
    notes: '',
    updatedAt: Date.now(),
  };
}
