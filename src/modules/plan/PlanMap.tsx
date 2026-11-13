import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geoDestination } from '@/lib/sun';

export interface PlanMapProps {
  camera: { lat: number; lng: number };
  subject: { lat: number; lng: number } | null;
  sunAz: number;
  sunUp: boolean;
  moonAz: number;
  moonUp: boolean;
  sunriseAz: number | null;
  sunsetAz: number | null;
  onCameraMove: (lat: number, lng: number) => void;
  onSubjectMove: (lat: number, lng: number) => void;
  onMapClick: (lat: number, lng: number) => void;
}

function pinIcon(kind: 'camera' | 'subject') {
  return L.divIcon({
    className: '',
    html: `<div class="pin pin--${kind}" aria-hidden="true">${kind === 'camera' ? 'C' : 'S'}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export default function PlanMap(props: PlanMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const cam = useRef<L.Marker | null>(null);
  const subj = useRef<L.Marker | null>(null);
  const lines = useRef<{ sun: L.Polyline; moon: L.Polyline; shot: L.Polyline; rise: L.Polyline; set: L.Polyline } | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (!host.current || map.current) return;
    const m = L.map(host.current, { zoomControl: true, attributionControl: true, tap: true } as L.MapOptions).setView([props.camera.lat, props.camera.lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
      crossOrigin: true,
    }).addTo(m);
    cam.current = L.marker([props.camera.lat, props.camera.lng], { icon: pinIcon('camera'), draggable: true, title: 'Camera position' }).addTo(m);
    cam.current.on('dragend', () => {
      const p = cam.current!.getLatLng();
      propsRef.current.onCameraMove(p.lat, p.lng);
    });
    cam.current.on('drag', () => draw());
    lines.current = {
      sun: L.polyline([], { color: '#E0AB00', weight: 3 }).addTo(m),
      moon: L.polyline([], { color: '#6f7fa8', weight: 2 }).addTo(m),
      shot: L.polyline([], { color: '#0B0B0C', weight: 2 }).addTo(m),
      rise: L.polyline([], { color: '#E0AB00', weight: 1.5, dashArray: '4 6', opacity: 0.8 }).addTo(m),
      set: L.polyline([], { color: '#E0AB00', weight: 1.5, dashArray: '4 6', opacity: 0.8 }).addTo(m),
    };
    m.on('click', (e: L.LeafletMouseEvent) => propsRef.current.onMapClick(e.latlng.lat, e.latlng.lng));
    m.on('zoomend moveend', () => draw());
    map.current = m;
    draw();
    // Leaflet measures its container on mount; a resize after layout settles avoids grey tiles.
    setTimeout(() => m.invalidateSize(), 50);
    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const m = map.current;
    const ln = lines.current;
    if (!m || !ln || !cam.current) return;
    const p = propsRef.current;
    const c = cam.current.getLatLng();
    const b = m.getBounds();
    const widthM = m.distance(b.getNorthWest(), b.getNorthEast());
    const len = Math.max(30, widthM * 0.33);
    const ray = (az: number, scale = 1) => {
      const d = geoDestination(c.lat, c.lng, az, len * scale);
      return [
        [c.lat, c.lng],
        [d.lat, d.lng],
      ] as [number, number][];
    };
    ln.sun.setLatLngs(ray(p.sunAz)).setStyle({ opacity: p.sunUp ? 1 : 0.3 });
    ln.moon.setLatLngs(ray(p.moonAz)).setStyle({ opacity: p.moonUp ? 1 : 0.3 });
    ln.rise.setLatLngs(p.sunriseAz != null ? ray(p.sunriseAz, 1.4) : []);
    ln.set.setLatLngs(p.sunsetAz != null ? ray(p.sunsetAz, 1.4) : []);
    if (p.subject) {
      ln.shot.setLatLngs([
        [c.lat, c.lng],
        [p.subject.lat, p.subject.lng],
      ]);
    } else ln.shot.setLatLngs([]);
  }

  // Sync camera marker from props (e.g. typed coordinates or loaded plan)
  useEffect(() => {
    if (!map.current || !cam.current) return;
    const cur = cam.current.getLatLng();
    if (Math.abs(cur.lat - props.camera.lat) > 1e-7 || Math.abs(cur.lng - props.camera.lng) > 1e-7) {
      cam.current.setLatLng([props.camera.lat, props.camera.lng]);
      map.current.panTo([props.camera.lat, props.camera.lng]);
    }
    draw();
  }, [props.camera.lat, props.camera.lng]);

  // Subject marker lifecycle
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (props.subject && !subj.current) {
      subj.current = L.marker([props.subject.lat, props.subject.lng], { icon: pinIcon('subject'), draggable: true, title: 'Subject position' }).addTo(m);
      subj.current.on('dragend', () => {
        const p = subj.current!.getLatLng();
        propsRef.current.onSubjectMove(p.lat, p.lng);
      });
    } else if (!props.subject && subj.current) {
      subj.current.remove();
      subj.current = null;
    } else if (props.subject && subj.current) {
      subj.current.setLatLng([props.subject.lat, props.subject.lng]);
    }
    draw();
  }, [props.subject]);

  useEffect(() => {
    draw();
  }, [props.sunAz, props.sunUp, props.moonAz, props.moonUp, props.sunriseAz, props.sunsetAz]);

  return <div ref={host} style={{ height: '100%', width: '100%' }} aria-label="Map with camera and subject pins" role="application" />;
}
