import { useCallback } from 'react';
import { useProject, useProjects } from '@/store/projects';
import { circleOfConfusion, getSensor, type Sensor } from '@/lib/calc/sensors';
import type { CameraSetup } from '@/types/project';

export function useCamera() {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const camera = project.camera;
  const sensor: Sensor = getSensor(camera.sensorId, camera.customSensor);
  const coc = circleOfConfusion(sensor);
  const setCamera = useCallback(
    (delta: Partial<CameraSetup>) => {
      patch((p) => ({ camera: { ...p.camera, ...delta } }));
    },
    [patch],
  );
  return { camera, sensor, coc, setCamera };
}
