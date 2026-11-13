import { describe, expect, it } from 'vitest';
import {
  hyperfocal,
  depthOfField,
  fieldOfView,
  sceneSizeAtDistance,
  focalForSceneWidth,
  distanceForSubject,
  lensEquivalence,
  dollyZoomFocal,
  anamorphic,
  backgroundBlurDiscMm,
  backgroundBlurFraction,
  describeBlur,
  apertureForDof,
  distanceForDof,
  circleOfConfusion,
  cropFactor,
  getSensor,
  exposureValue,
  shutterFromEv,
  apertureFromEv,
  isoFromEv,
  densityToStops,
  stopsToDensity,
  ndShutter,
  nearestStandardShutter,
  ND_PRESETS,
  stopsBetween,
  shutterFromAngle,
  angleFromShutter,
  slowMotion,
  timelapseFromClip,
  timelapseFromShoot,
  rule500,
  npfRule,
  starTrail,
  SIDEREAL_DEG_PER_S,
  inverseSquareStops,
  inverseSquareRatio,
  distanceForStops,
  powerStops,
  kelvinToMired,
  miredToKelvin,
  miredShift,
  suggestGels,
  gbPerHour,
  minutesOnCard,
  cardsNeeded,
  battery,
  scriptEstimate,
  framesToTimecode,
  timecodeToFrames,
  formatTimecode,
  parseTimecode,
  addTimecodes,
  subtractTimecodes,
} from './index';

describe('sensors', () => {
  it('derives crop factor from dimensions', () => {
    expect(cropFactor(36, 24)).toBeCloseTo(1, 6);
    expect(cropFactor(22.3, 14.9)).toBeCloseTo(1.61, 2);
  });
  it('circle of confusion follows d/1500', () => {
    expect(circleOfConfusion({ width: 36, height: 24 })).toBeCloseTo(0.0288, 3);
  });
  it('custom sensors are supported', () => {
    const s = getSensor('custom', { width: 30, height: 20, name: 'Test' });
    expect(s.crop).toBeCloseTo(1.2, 2);
    expect(getSensor('nonsense').id).toBe('full-frame');
  });
});

describe('hyperfocal and depth of field', () => {
  it('50 mm f/8 full frame CoC 0.029 -> ~10.83 m', () => {
    expect(hyperfocal(50, 8, 0.029)).toBeCloseTo(10.83, 2);
  });
  it('classic DoF at 5 m', () => {
    const d = depthOfField(50, 8, 5, 0.029);
    expect(d.near).toBeCloseTo(3.426, 2);
    expect(d.far).toBeCloseTo(9.248, 2);
    expect(d.total).toBeCloseTo(5.82, 2);
  });
  it('focusing at the hyperfocal distance gives sharpness from H/2 to infinity', () => {
    const H = hyperfocal(50, 8, 0.029);
    const d = depthOfField(50, 8, H, 0.029);
    expect(d.near).toBeCloseTo(H / 2, 3);
    expect(d.far).toBe(Infinity);
  });
  it('inverse DoF solvers recover the forward inputs', () => {
    expect(apertureForDof(50, 5, 5.82, 0.029)).toBeCloseTo(8, 1);
    expect(distanceForDof(50, 8, 5.82, 0.029)).toBeCloseTo(5, 1);
    expect(Number.isNaN(apertureForDof(50, 0.5, 5, 0.029))).toBe(true);
  });
});

describe('field of view', () => {
  it('50 mm full frame horizontal ~39.6°', () => {
    const f = fieldOfView(50, 36, 24);
    expect(f.horizontal).toBeCloseTo(39.6, 1);
    expect(f.vertical).toBeCloseTo(26.99, 1);
    expect(f.diagonal).toBeCloseTo(46.79, 1);
  });
  it('scene size at distance and its inverse agree', () => {
    const s = sceneSizeAtDistance(50, 36, 24, 5);
    expect(s.width).toBeCloseTo(3.564, 2);
    expect(s.height).toBeCloseTo(2.376, 2);
    expect(focalForSceneWidth(36, s.width, 5)).toBeCloseTo(50, 4);
  });
  it('distance to frame a 1.8 m subject full height on 50 mm FF is 3.8 m', () => {
    expect(distanceForSubject(50, 24, 1.8, 1)).toBeCloseTo(3.8, 3);
  });
});

describe('equivalence, dolly zoom, anamorphic, blur', () => {
  it('APS-C 1.6x 50 mm f/2.8 ~ 80 mm f/4.5 full frame', () => {
    const e = lensEquivalence(50, 2.8, 1.6, 1);
    expect(e.focal).toBeCloseTo(80, 6);
    expect(e.aperture).toBeCloseTo(4.48, 2);
  });
  it('dolly zoom doubles focal length when distance doubles', () => {
    expect(dollyZoomFocal(50, 5, 10)).toBe(100);
  });
  it('2x anamorphic on 16:9 gives 3.56:1 and 7680 px wide', () => {
    const a = anamorphic(2, 3840, 2160);
    expect(a.desqueezedAspect).toBeCloseTo(3.556, 2);
    expect(a.deliveryWidth).toBe(7680);
    expect(anamorphic(1.33, 4096, 3072).desqueezedAspect).toBeCloseTo(1.773, 2);
  });
  it('background blur disc for 85 mm f/1.8 at 2 m is ~2.1 mm', () => {
    expect(backgroundBlurDiscMm(85, 1.8, 2)).toBeCloseTo(2.096, 2);
    expect(describeBlur(backgroundBlurFraction(85, 1.8, 2, 36))).toBe('Very shallow');
    expect(describeBlur(backgroundBlurFraction(24, 8, 5, 36))).toBe('Background sharp');
  });
});

describe('exposure', () => {
  it('Sunny 16 at 1/125 ISO 100 is EV ~15', () => {
    expect(exposureValue(16, 1 / 125, 100)).toBeCloseTo(14.97, 1);
    expect(exposureValue(16, 1 / 125, 400)).toBeCloseTo(12.97, 1);
  });
  it('solves each side of the triangle', () => {
    expect(shutterFromEv(15, 16, 100)).toBeCloseTo(1 / 128, 5);
    expect(apertureFromEv(15, 1 / 125, 100)).toBeCloseTo(16.19, 1);
    expect(isoFromEv(13, 16, 1 / 125)).toBeCloseTo(390.6, 0);
  });
  it('stops between exposures', () => {
    expect(stopsBetween({ f: 4, t: 1 / 50, iso: 800 }, { f: 8, t: 1 / 50, iso: 800 })).toBeCloseTo(-2, 6);
    expect(stopsBetween({ f: 4, t: 1 / 50, iso: 800 }, { f: 4, t: 1 / 100, iso: 800 })).toBeCloseTo(-1, 6);
    expect(stopsBetween({ f: 4, t: 1 / 50, iso: 800 }, { f: 4, t: 1 / 50, iso: 1600 })).toBeCloseTo(1, 6);
  });
  it('ND density and stops', () => {
    expect(densityToStops(0.9)).toBeCloseTo(3, 1);
    expect(densityToStops(3.0)).toBeCloseTo(10, 1);
    expect(stopsToDensity(10)).toBeCloseTo(3.01, 2);
    expect(ND_PRESETS.find((p) => p.stops === 3)?.label).toBe('ND8');
    expect(ND_PRESETS.find((p) => p.stops === 10)?.factor).toBe(1024);
  });
  it('10-stop ND with 1/125 s -> ~8.2 s', () => {
    expect(ndShutter(1 / 125, 10)).toBeCloseTo(8.192, 2);
  });
  it('snaps to the nearest standard shutter', () => {
    expect(nearestStandardShutter(0.0081)).toBeCloseTo(1 / 125, 6);
    expect(nearestStandardShutter(8.192)).toBe(8);
  });
});

describe('motion', () => {
  it('180° at 24 fps is 1/48 s', () => {
    expect(shutterFromAngle(180, 24)).toBeCloseTo(1 / 48, 8);
    expect(angleFromShutter(1 / 50, 25)).toBeCloseTo(180, 8);
  });
  it('120 fps played at 24 is 20% speed, 5x slower, 1/240 s', () => {
    const s = slowMotion(120, 24);
    expect(s.speedPercent).toBeCloseTo(20, 6);
    expect(s.slowFactor).toBe(5);
    expect(s.recommendedShutter).toBeCloseTo(1 / 240, 8);
  });
  it('time lapse from clip length', () => {
    const t = timelapseFromClip({ intervalS: 5, clipS: 10, playbackFps: 25, fileSizeMb: 25 });
    expect(t.frames).toBe(250);
    expect(t.shootS).toBe(1250);
    expect(t.storageGb).toBeCloseTo(6.25, 6);
    expect(t.speedup).toBe(125);
  });
  it('time lapse from shoot time', () => {
    const t = timelapseFromShoot(10, 3600, 25, 20);
    expect(t.frames).toBe(360);
    expect(t.clipS).toBeCloseTo(14.4, 6);
    expect(t.storageGb).toBeCloseTo(7.2, 6);
  });
});

describe('stars', () => {
  it('500 rule', () => {
    expect(rule500(24, 1)).toBeCloseTo(20.83, 2);
    expect(rule500(24, 1.6)).toBeCloseTo(13.02, 2);
  });
  it('NPF rule for 24 mm f/2.8 with 4.3 µm pixels is ~9.5 s', () => {
    expect(npfRule(24, 2.8, 4.3)).toBeCloseTo(9.458, 2);
  });
  it('star trail over 30 s on 24 mm is ~12 px at 4.3 µm', () => {
    expect(SIDEREAL_DEG_PER_S).toBeCloseTo(0.004178, 5);
    const t = starTrail(30, 24, 4.3);
    expect(t.angleDeg).toBeCloseTo(0.1253, 3);
    expect(t.trailMm).toBeCloseTo(0.0525, 3);
    expect(t.trailPx).toBeCloseTo(12.2, 0);
  });
});

describe('light', () => {
  it('inverse square: doubling distance loses 2 stops', () => {
    expect(inverseSquareStops(2, 4)).toBeCloseTo(-2, 8);
    expect(inverseSquareStops(4, 2)).toBeCloseTo(2, 8);
    expect(inverseSquareRatio(2, 4)).toBeCloseTo(0.25, 8);
    expect(distanceForStops(4, 2)).toBeCloseTo(2, 8);
    expect(distanceForStops(2, -2)).toBeCloseTo(4, 8);
    expect(powerStops(100, 50)).toBeCloseTo(-1, 8);
  });
  it('mired conversions and gel advice', () => {
    expect(kelvinToMired(5600)).toBeCloseTo(178.57, 1);
    expect(miredToKelvin(312.5)).toBeCloseTo(3200, 6);
    expect(miredShift(5600, 3200)).toBeCloseTo(133.9, 0);
    const advice = suggestGels(5600, 3200);
    expect(advice.single.gels[0].name).toBe('3/4 CTO');
    expect(advice.single.resultK).toBeGreaterThan(3000);
    expect(advice.single.resultK).toBeLessThan(3500);
    const cooling = suggestGels(3200, 5600);
    expect(cooling.single.gels[0].kind).toBe('ctb');
  });
});

describe('storage and battery', () => {
  it('100 Mbps is ~45 GB per hour', () => {
    expect(gbPerHour(100)).toBeCloseTo(45, 6);
  });
  it('card minutes and card counts', () => {
    expect(minutesOnCard(128, 100)).toBeCloseTo(170.67, 1);
    expect(cardsNeeded(3, 100, 64)).toBe(3);
  });
  it('battery runtime', () => {
    const b = battery(2000, 7.2, 5, 3, 8);
    expect(b.wh).toBeCloseTo(14.4, 6);
    expect(b.minutesPerBattery).toBeCloseTo(172.8, 6);
    expect(b.batteriesForShoot).toBe(3);
  });
});

describe('script', () => {
  it('90 pages ~ 90 minutes and 23 days at 4 pages a day', () => {
    const e = scriptEstimate(90);
    expect(e.runtimeMin).toBe(90);
    expect(e.days).toBe(23);
  });
});

describe('timecode', () => {
  it('non-drop conversions', () => {
    expect(formatTimecode(framesToTimecode(1800, 25))).toBe('00:01:12:00');
    expect(timecodeToFrames({ h: 0, m: 1, s: 0, f: 0 }, 24)).toBe(1440);
    expect(formatTimecode(addTimecodes({ h: 0, m: 0, s: 59, f: 20 }, { h: 0, m: 0, s: 0, f: 10 }, 25))).toBe('00:01:00:05');
    expect(formatTimecode(subtractTimecodes({ h: 0, m: 1, s: 0, f: 0 }, { h: 0, m: 0, s: 0, f: 1 }, 25))).toBe('00:00:59:24');
  });
  it('drop-frame 29.97 skips frames 0 and 1 each minute except every tenth', () => {
    expect(formatTimecode(framesToTimecode(1800, 29.97, true), true)).toBe('00:01:00;02');
    expect(timecodeToFrames({ h: 0, m: 1, s: 0, f: 2 }, 29.97, true)).toBe(1800);
    expect(formatTimecode(framesToTimecode(17982, 29.97, true), true)).toBe('00:10:00;00');
    expect(timecodeToFrames({ h: 0, m: 10, s: 0, f: 0 }, 29.97, true)).toBe(17982);
    // one hour of DF timecode is 107892 frames
    expect(timecodeToFrames({ h: 1, m: 0, s: 0, f: 0 }, 29.97, true)).toBe(107892);
    expect(formatTimecode(framesToTimecode(107892, 29.97, true), true)).toBe('01:00:00;00');
  });
  it('parses timecode strings', () => {
    expect(parseTimecode('01:02:03:04')).toEqual({ h: 1, m: 2, s: 3, f: 4 });
    expect(parseTimecode('01:02:03;04')).toEqual({ h: 1, m: 2, s: 3, f: 4 });
    expect(parseTimecode('nope')).toBeNull();
  });
});
