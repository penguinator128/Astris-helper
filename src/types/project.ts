/* ---------- Shared enums ---------- */

export type AspectId = '16:9' | '2.39:1' | '1.85:1' | '4:3' | '1:1' | '9:16' | '4:5';

export const ASPECTS: { id: AspectId; ratio: number; label: string }[] = [
  { id: '16:9', ratio: 16 / 9, label: '16:9' },
  { id: '2.39:1', ratio: 2.39, label: '2.39:1' },
  { id: '1.85:1', ratio: 1.85, label: '1.85:1' },
  { id: '4:3', ratio: 4 / 3, label: '4:3' },
  { id: '1:1', ratio: 1, label: '1:1' },
  { id: '9:16', ratio: 9 / 16, label: '9:16' },
  { id: '4:5', ratio: 4 / 5, label: '4:5' },
];

export function aspectRatio(id: AspectId): number {
  return ASPECTS.find((a) => a.id === id)?.ratio ?? 16 / 9;
}

export type ShotSize = 'ECU' | 'CU' | 'MCU' | 'MS' | 'MWS' | 'WS' | 'EWS';
export const SHOT_SIZES: { id: ShotSize; label: string }[] = [
  { id: 'ECU', label: 'Extreme close-up' },
  { id: 'CU', label: 'Close-up' },
  { id: 'MCU', label: 'Medium close-up' },
  { id: 'MS', label: 'Medium shot' },
  { id: 'MWS', label: 'Medium wide' },
  { id: 'WS', label: 'Wide shot' },
  { id: 'EWS', label: 'Extreme wide' },
];

export type CameraAngle = 'eye' | 'low' | 'high' | 'overhead' | 'dutch';
export const CAMERA_ANGLES: { id: CameraAngle; label: string }[] = [
  { id: 'eye', label: 'Eye level' },
  { id: 'low', label: 'Low angle' },
  { id: 'high', label: 'High angle' },
  { id: 'overhead', label: 'Overhead' },
  { id: 'dutch', label: 'Dutch tilt' },
];

export type CameraMove =
  | 'static'
  | 'push'
  | 'pull'
  | 'pan-l'
  | 'pan-r'
  | 'tilt-u'
  | 'tilt-d'
  | 'track-l'
  | 'track-r'
  | 'crane-u'
  | 'crane-d'
  | 'handheld';
export const CAMERA_MOVES: { id: CameraMove; label: string }[] = [
  { id: 'static', label: 'Static' },
  { id: 'push', label: 'Push in' },
  { id: 'pull', label: 'Pull out' },
  { id: 'pan-l', label: 'Pan left' },
  { id: 'pan-r', label: 'Pan right' },
  { id: 'tilt-u', label: 'Tilt up' },
  { id: 'tilt-d', label: 'Tilt down' },
  { id: 'track-l', label: 'Track left' },
  { id: 'track-r', label: 'Track right' },
  { id: 'crane-u', label: 'Crane up' },
  { id: 'crane-d', label: 'Crane down' },
  { id: 'handheld', label: 'Handheld' },
];

export type ShotStatus = 'planned' | 'shot' | 'pickup';

/* ---------- Camera / lens ---------- */

export interface CameraSetup {
  sensorId: string; // key into SENSORS, or 'custom'
  customSensor?: { width: number; height: number; name: string };
  focalLength: number; // mm
  aperture: number; // f-number
  fps: number;
  shutterAngle: number; // degrees
  iso: number;
}

/* ---------- Shot list ---------- */

export interface Shot {
  id: string;
  scene: number;
  shotNumber: string; // e.g. "1A"
  size: ShotSize | '';
  angle: CameraAngle | '';
  movement: CameraMove | '';
  lens: string;
  aperture: string;
  fps: string;
  location: string;
  description: string;
  equipment: string;
  status: ShotStatus;
  compositionId?: string;
  diagramId?: string;
  paletteId?: string;
  storyboardFrameId?: string;
  order: number;
}

/* ---------- Storyboard ---------- */

export interface Stroke {
  tool: 'pen' | 'line' | 'arrow' | 'eraser';
  points: { x: number; y: number }[]; // normalised 0..1
  width: number;
  colour: string;
}

export interface StoryboardFrame {
  id: string;
  order: number;
  source: 'blank' | 'composition' | 'image' | 'drawing';
  compositionId?: string;
  imageId?: string;
  strokes: Stroke[];
  caption: string;
  dialogue: string;
  size: ShotSize | '';
  movement: CameraMove | '';
  lens: string;
  durationSec: number;
  shotId?: string;
}

/* ---------- Lighting diagram ---------- */

export type LightKind =
  | 'key'
  | 'fill'
  | 'back'
  | 'hair'
  | 'kicker'
  | 'practical'
  | 'window'
  | 'sun'
  | 'bounce'
  | 'flag'
  | 'diffusion'
  | 'negfill';

export const LIGHT_KINDS: { id: LightKind; label: string; emits: boolean }[] = [
  { id: 'key', label: 'Key light', emits: true },
  { id: 'fill', label: 'Fill light', emits: true },
  { id: 'back', label: 'Back / rim light', emits: true },
  { id: 'hair', label: 'Hair light', emits: true },
  { id: 'kicker', label: 'Kicker', emits: true },
  { id: 'practical', label: 'Practical', emits: true },
  { id: 'window', label: 'Window', emits: true },
  { id: 'sun', label: 'Sun', emits: true },
  { id: 'bounce', label: 'Bounce card', emits: false },
  { id: 'flag', label: 'Flag', emits: false },
  { id: 'diffusion', label: 'Diffusion', emits: false },
  { id: 'negfill', label: 'Negative fill', emits: false },
];

export interface DiagramObjectBase {
  id: string;
  x: number; // metres, scene space
  y: number;
  rotation: number; // degrees, 0 = facing +y (towards top)
  locked: boolean;
  label: string;
}

export interface DiagramSubject extends DiagramObjectBase {
  type: 'subject';
  subjectKind: 'person' | 'object';
  height: number; // metres, standing height for a person
  /** Missing on older plans: standing. */
  pose?: Pose;
  /** Seat height for seated poses, or the surface for lying, metres. */
  seatHeight?: number;
  /** Lean back (+) or forward (−), degrees. */
  lean?: number;
}

export type Pose = 'standing' | 'chair' | 'couch' | 'bench' | 'kneeling' | 'lying' | 'walking' | 'custom';

export interface DiagramCamera extends DiagramObjectBase {
  type: 'camera';
  gearId?: string;
  // FOV comes from the project camera setup
}

export interface DiagramWall extends DiagramObjectBase {
  type: 'wall';
  length: number; // metres
}

export interface DiagramLight extends DiagramObjectBase {
  type: 'light';
  gearId?: string;
  kind: LightKind;
  power: number; // 0..100 %
  kelvin: number; // colour temperature
  size: number; // metres, soft source size
  height: number; // metres
  tilt: number; // degrees, down is negative
  gel: string; // hex or ''
  spread: number; // beam angle degrees
  /** What the fixture is; changes its output and how soft it is. Missing on older plans (an open LED). */
  fixture?: LightFixture;
  diffusion?: Diffusion;
}

export type LightFixture = 'led-mono' | 'fresnel' | 'softbox' | 'lantern' | 'led-panel' | 'rgb-panel' | 'tube' | 'practical-bulb' | 'open-face';
export type Diffusion = 'none' | 'light' | 'medium' | 'heavy';

export type EnvPreset = 'white-studio' | 'dark-studio' | 'daylight' | 'overcast' | 'natural-indoor' | 'warm-indoor' | 'low-light' | 'custom';

/** The room or location around the set: walls, floor, ambient light. */
export interface Environment {
  preset: EnvPreset;
  outdoor: boolean;
  wallColour: string;
  floorColour: string;
  /** Share of light the walls reflect, 0 to 1. White paint is about 0.85. */
  wallReflect: number;
  material: 'matte' | 'satin' | 'gloss';
  /** Back wall distance behind the subject, metres. */
  wallDistance: number;
  roomWidth: number;
  ceilingHeight: number;
  /** Light already in the space before your lights, lux. */
  ambientLux: number;
  ambientKelvin: number;
  sun: boolean;
  sunAzimuth: number; // degrees, 0 = top of the plan
  sunElevation: number;
}

/** Any other piece of kit placed on the plan: mics, recorders, wireless, monitors, grip, power. */
export interface DiagramGear extends DiagramObjectBase {
  type: 'gear';
  category: GearCategory;
  gearId?: string;
}

export type ZoneKind = 'base' | 'village' | 'power' | 'staging' | 'makeup' | 'parking' | 'nogo' | 'other' | FurnitureKind;
export type FurnitureKind = 'couch' | 'armchair' | 'chair' | 'bench' | 'table' | 'stool' | 'bed';

export const ZONE_KINDS: { id: ZoneKind; label: string }[] = [
  { id: 'base', label: 'Home base' },
  { id: 'village', label: 'Video village' },
  { id: 'power', label: 'Power' },
  { id: 'staging', label: 'Gear staging' },
  { id: 'makeup', label: 'Hair and make-up' },
  { id: 'parking', label: 'Parking' },
  { id: 'nogo', label: 'Keep clear' },
  { id: 'other', label: 'Area' },
];

/** A rectangular area on the plan, sized in metres. */
export interface DiagramZone extends DiagramObjectBase {
  type: 'zone';
  zoneKind: ZoneKind;
  w: number;
  h: number;
}

/** A floor mark for talent or camera. */
export interface DiagramMark extends DiagramObjectBase {
  type: 'mark';
}

export type DiagramObject = DiagramSubject | DiagramCamera | DiagramWall | DiagramLight | DiagramGear | DiagramZone | DiagramMark;

/* ---------- Gear inventory, inputs and outputs ---------- */

export type GearCategory =
  | 'camera'
  | 'lens'
  | 'adapter'
  | 'rigging'
  | 'filter'
  | 'support'
  | 'monitor'
  | 'mic'
  | 'wireless'
  | 'recorder'
  | 'audio-acc'
  | 'light'
  | 'grip'
  | 'battery'
  | 'power'
  | 'cable'
  | 'media'
  | 'other';

export type Connector =
  | 'XLR'
  | '3.5 mm TRS'
  | '3.5 mm TRRS'
  | '6.35 mm TRS'
  | 'HDMI'
  | 'Micro HDMI'
  | 'Mini HDMI'
  | 'SDI'
  | 'USB-C'
  | 'BNC timecode'
  | 'Wireless'
  | 'Shoe'
  | 'Mains'
  | 'DC barrel'
  | 'D-tap'
  | 'Mini XLR'
  | 'Lens mount'
  | 'Filter thread'
  | 'Filter tray'
  | 'Battery plate'
  | 'NATO'
  | 'Cold shoe'
  | '1/4-20'
  | '15 mm rods'
  | 'Focus ring'
  | 'Mic mount'
  | 'Other';

export type SignalKind = 'audio' | 'video' | 'timecode' | 'power' | 'data' | 'mount';

export interface GearPort {
  id: string;
  name: string;
  dir: 'in' | 'out';
  connector: Connector;
  signal: SignalKind;
  /** Mount, battery or wireless standard: 'RF', '82 mm', 'NP-F', 'V-mount', 'RF 2.4 GHz'. */
  standard?: string;
  /** On an input: supplies 48 V phantom. On an output: the mic needs phantom. */
  phantom?: boolean;
  /** Accepted voltage range on a power input. */
  vMin?: number;
  vMax?: number;
  /** Voltage supplied by a power output. */
  vOut?: number;
}

export interface GearSpec {
  label: string;
  value: string;
}

export interface LensSpec {
  manufacturer: string;
  model: string;
  mount: string;
  focalMin: number;
  focalMax: number;
  /** Widest aperture at the short end and at the long end (same for constant-aperture lenses). */
  maxAperture: number;
  maxApertureTele: number;
  minAperture: number;
  minFocus: number; // metres
  filterThread: number; // mm, 0 if none
}

export type FocusMode = 'MF' | 'AF-S' | 'AF-C' | 'Face and eye AF';

export interface CameraConfig {
  bodyId: string;
  manufacturer: string;
  model: string;
  mount: string;
  sensorId: string;
  lensGearId?: string;
  focalLength: number;
  aperture: number;
  shutterMode: 'angle' | 'speed';
  shutterAngle: number;
  shutterSpeed: number; // seconds
  iso: number;
  ei: number;
  kelvin: number;
  tint: number; // + magenta, - green
  focusMode: FocusMode;
  focusDistance: number; // metres
  resolution: string;
  fps: number;
  codec: string;
  format: string;
  profile: string;
  colourSpace: string;
  bitDepth: string;
  chroma: string;
  stabilisation: string;
  monitorLut: boolean;
  /** Neutral density in front of the lens, stops. Only set when the rig has an ND filter. */
  ndStops?: number;
  height: number; // lens height above the floor, metres
  tilt: number; // degrees, negative looks down
  panSpeed: number; // degrees per second, for the motion-blur simulation
  subjectSpeed: number; // metres per second across frame
  notes: string;
}

export interface RigPos {
  x: number;
  y: number;
  z: number;
  ry: number;
}

export interface GearItem {
  id: string;
  category: GearCategory;
  name: string;
  model: string;
  qty: number;
  power: string; // battery type or 'Mains', '' if none
  ports: GearPort[];
  notes: string;
  /** Kind of physical part, used for compatibility and the 3D rig (e.g. 'cage', 'top-handle', 'body-cinema'). */
  rigKind?: string;
  /** The camera this item is rigged to. */
  rigOf?: string;
  rigPos?: RigPos;
  specs?: GearSpec[];
  weightKg?: number;
  payloadKg?: number;
  camera?: CameraConfig;
  lens?: LensSpec;
}

/** A cable or wireless link from one item's output to another item's input. */
export interface Connection {
  id: string;
  fromGear: string;
  fromPort: string;
  toGear: string;
  toPort: string;
  notes: string;
}

export interface LightingDiagram {
  id: string;
  name: string;
  objects: DiagramObject[];
  gridSize: number; // metres
  showSunPath: boolean;
  notes: string;
  updatedAt: number;
  thumbnail?: string; // data URL png, small
  environment?: Environment;
  sceneNumber?: string;
  cameraNotes?: string;
}

/* ---------- Composition ---------- */

export type SilhouetteKind = 'standing' | 'seated' | 'two-shot' | 'group' | 'prop-box' | 'prop-round' | 'prop-tall';

export interface FrameElement {
  id: string;
  kind: SilhouetteKind;
  x: number; // 0..1 centre
  y: number; // 0..1 centre (feet anchor bottom)
  scale: number; // relative to frame height, 1 = full-height
  flip: boolean;
  colour?: string;
}

export interface Composition {
  id: string;
  name: string;
  aspect: AspectId;
  guides: {
    thirds: boolean;
    goldenRatio: boolean;
    goldenSpiral: boolean;
    goldenTriangles: boolean;
    diagonals: boolean;
    centre: boolean;
    actionSafe: boolean;
    titleSafe: boolean;
    headroom: boolean;
    leadRoom: boolean;
  };
  elements: FrameElement[];
  angle: CameraAngle;
  movement: CameraMove;
  focalLength: number;
  aperture: number;
  subjectDistance: number; // metres
  paletteId?: string;
  backgroundImageId?: string;
  backgroundOpacity: number;
  notes: string;
  updatedAt: number;
}

/* ---------- Colour ---------- */

export interface PaletteSwatch {
  hex: string;
  name: string;
}

export interface Palette {
  id: string;
  name: string;
  swatches: PaletteSwatch[];
  scheme: string;
  updatedAt: number;
}

export interface ColourScriptScene {
  id: string;
  label: string;
  colour: string;
  mood: string;
  order: number;
}

/* ---------- Planner ---------- */

export interface SunPlan {
  id: string;
  name: string;
  lat: number;
  lng: number;
  subjectLat?: number;
  subjectLng?: number;
  isoDate: string; // yyyy-mm-dd
  time: string; // HH:mm
  note: string;
  createdAt: number;
}

/* ---------- Call sheet & checklist ---------- */

export interface CallSheetPerson {
  id: string;
  name: string;
  role: string;
  callTime: string;
  contact: string;
}

export interface CallSheetScheduleItem {
  id: string;
  time: string;
  item: string;
  notes: string;
}

export interface CallSheet {
  isoDate: string;
  callTime: string;
  locationName: string;
  locationAddress: string;
  lat?: number;
  lng?: number;
  parking: string;
  people: CallSheetPerson[];
  schedule: CallSheetScheduleItem[];
  notes: string;
  weatherNote: string;
}

export interface ChecklistItem {
  id: string;
  group: string;
  label: string;
  done: boolean;
  qty: number;
  order: number;
}

/* ---------- Awards ---------- */

export interface AwardNominee {
  id: string;
  name: string;
  work: string;
}

export interface AwardCategory {
  id: string;
  name: string;
  nominees: AwardNominee[];
  winnerId?: string;
}

export interface Ceremony {
  id: string;
  title: string;
  year: number;
  tagline: string;
  categories: AwardCategory[];
  createdAt: number;
}

/* ---------- Slate ---------- */

export interface SlateState {
  production: string;
  roll: string;
  scene: string;
  shot: string;
  take: number;
  director: string;
  camera: string;
  fps: number;
  flash: boolean;
  mirrored: boolean;
  sound: boolean;
}

/* ---------- Project ---------- */

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  camera: CameraSetup;
  shots: Shot[];
  storyboard: StoryboardFrame[];
  storyboardAspect: AspectId;
  diagrams: LightingDiagram[];
  compositions: Composition[];
  palettes: Palette[];
  colourScript: ColourScriptScene[];
  plans: SunPlan[];
  callSheet: CallSheet;
  checklist: ChecklistItem[];
  awards: Ceremony[];
  slate: SlateState;
  gear: GearItem[];
  connections: Connection[];
}

export interface ProjectExport {
  format: 'astris-field-kit';
  version: 1;
  exportedAt: string;
  project: Project;
  images: Record<string, string>; // imageId -> data URL
}
