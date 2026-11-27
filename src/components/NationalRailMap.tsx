import { useEffect, useRef } from "react";
import L from "leaflet";
import { wgs84togcj02 } from "coordtransform";
import { loadRailNetworkOverview } from "../lib/rail-network";
import { nationalCategories } from "../lib/rail-national";
import type { NationalTrain } from "../lib/rail-national";
import type { Coordinate } from "../lib/train-position";
import "leaflet/dist/leaflet.css";

type Dot = { x: number; y: number; trains: NationalTrain[] };
const nationalBounds = L.latLngBounds([17, 73], [54, 135]);
const latLng = ([longitude, latitude]: Coordinate): L.LatLngTuple => {
  const [x, y] = wgs84togcj02(longitude, latitude);
  return [y, x];
};

function drawDots(instance: L.Map, canvas: HTMLCanvasElement, trains: NationalTrain[], selected?: string): Dot[] {
  const { x: width, y: height } = instance.getSize();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const context = canvas.getContext("2d");
  if (!context) return [];
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  const zoom = instance.getZoom(), size = zoom >= 10 ? 0 : zoom >= 7 ? 15 : 23;
  const cells = new Map<string, Dot>();
  const dots: Dot[] = [];
  let focus: Dot | undefined;
  for (const train of trains) {
    if (!train.point) continue;
    const { x, y } = instance.latLngToContainerPoint(latLng(train.point));
    if (x < -16 || x > width + 16 || y < -16 || y > height + 16) continue;
    const dot = { x, y, trains: [train] };
    if (train.id === selected) {
      focus = dot;
    } else if (!size) {
      dots.push(dot);
    } else {
      const key = `${Math.floor(x / size)}/${Math.floor(y / size)}`;
      const cell = cells.get(key);
      if (cell) {
        cell.trains.push(train);
        cell.x += (x - cell.x) / cell.trains.length;
        cell.y += (y - cell.y) / cell.trains.length;
      } else cells.set(key, dot);
    }
  }
  dots.push(...cells.values());
  if (focus) dots.push(focus);
  for (const { x, y, trains: group } of dots) {
    const train = group[0], active = train.id === selected, count = group.length;
    const color = count === 1 ? nationalCategories[train.category].color : "#d0edf7";
    const radius = active ? 7 : count === 1 ? 3.7 : count < 10 ? 8 : 10;
    context.beginPath();
    context.arc(x, y, radius, 0, 2 * Math.PI);
    context.fillStyle = color;
    context.strokeStyle = "#122b37";
    context.lineWidth = active ? 2.6 : 1.2;
    context.fill();
    context.stroke();
    if (count > 1 || active) {
      context.font = active ? "700 12px system-ui" : "700 9px system-ui";
      context.textAlign = "center";
      context.textBaseline = "middle";
      if (active) {
        context.strokeStyle = "#102531";
        context.lineWidth = 4;
        context.strokeText(train.code, x, y - 16);
        context.fillStyle = "#f4fbff";
        context.fillText(train.code, x, y - 16);
      } else {
        context.fillStyle = "#152d3b";
        context.fillText(String(count), x, y + .5);
      }
    }
  }
  return dots;
}

export function NationalRailMap({ trains, selected, onSelect, reset, focus, onMapNotice }: {
  trains: NationalTrain[];
  selected?: NationalTrain;
  onSelect: (id: string) => void;
  reset: number;
  focus: { id: number; point: Coordinate } | null;
  onMapNotice: (notice: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const map = useRef<L.Map | null>(null);
  const line = useRef<L.Polyline | null>(null);
  const dots = useRef<Dot[]>([]);
  const current = useRef({ trains, selected, onSelect, onMapNotice });
  const queueDraw = useRef(() => {});
  current.current = { trains, selected, onSelect, onMapNotice };

  useEffect(() => {
    if (!host.current || !overlay.current) return;
    const canvas = overlay.current;
    const instance = L.map(host.current, { minZoom: 3, maxZoom: 17, zoomSnap: .5, preferCanvas: true, scrollWheelZoom: false });
    map.current = instance;
    instance.attributionControl.setPrefix(false);
    const basemap = L.tileLayer("https://wprd0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&size=1&scl=1&style=8&lang=zh_cn", {
      subdomains: "1234", maxNativeZoom: 18, className: "rail-national-basemap",
      attribution: '<a href="https://www.amap.com/" target="_blank" rel="noreferrer">高德地图</a>',
    });
    let frame = 0, zooming = false, active = true, tilesLoaded = false, networkFailed = false;
    const notifyMap = () => current.current.onMapNotice(
      networkFailed ? "铁路网图层暂不可用，车次位置仍可查看。" : tilesLoaded ? "" : "底图暂不可用，仍可查看铁路网和列车。",
    );
    basemap.on("tileload", () => {
      if (tilesLoaded) return;
      tilesLoaded = true;
      notifyMap();
    });
    basemap.on("tileerror", () => { if (!tilesLoaded) notifyMap(); });
    basemap.addTo(instance);
    const draw = () => {
      frame = 0;
      if (zooming) return;
      dots.current = drawDots(instance, canvas, current.current.trains, current.current.selected?.id);
    };
    queueDraw.current = () => { if (!frame) frame = requestAnimationFrame(draw); };
    instance.on("move resize", queueDraw.current);
    instance.on("zoomstart", () => { zooming = true; canvas.style.visibility = "hidden"; });
    instance.on("zoomend", () => { zooming = false; canvas.style.visibility = ""; queueDraw.current(); });
    instance.on("click", (event: L.LeafletMouseEvent) => {
      let distance = 13, nearest: Dot | undefined;
      for (const dot of dots.current) {
        const delta = Math.hypot(dot.x - event.containerPoint.x, dot.y - event.containerPoint.y);
        if (delta <= distance) { distance = delta; nearest = dot; }
      }
      if (!nearest) return;
      if (nearest.trains.length === 1) current.current.onSelect(nearest.trains[0].id);
      else instance.setView(instance.containerPointToLatLng([nearest.x, nearest.y]), Math.min(instance.getMaxZoom(), instance.getZoom() + 2));
    });
    instance.fitBounds(nationalBounds, { padding: [14, 14] });
    const resize = new ResizeObserver(() => { instance.invalidateSize({ pan: false }); queueDraw.current(); });
    resize.observe(host.current);
    void loadRailNetworkOverview().then(({ lines }) => {
      if (active) {
        L.polyline(lines.map(points => points.map(latLng)), {
          weight: 1, color: "#99b4bb", opacity: .42, interactive: false,
          attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>',
        }).addTo(instance).bringToBack();
      }
    }).catch(() => { if (active) { networkFailed = true; notifyMap(); } });
    return () => {
      active = false;
      resize.disconnect();
      cancelAnimationFrame(frame);
      instance.remove();
      map.current = null;
      line.current = null;
      queueDraw.current = () => {};
    };
  }, []);

  useEffect(() => { queueDraw.current(); }, [trains, selected?.id]);
  const path = selected?.path;
  useEffect(() => {
    line.current?.remove();
    line.current = map.current && path ? L.polyline(path.map(latLng), {
      color: "#90f4ff", weight: 3, opacity: .92, interactive: false,
    }).addTo(map.current) : null;
  }, [path]);
  useEffect(() => { if (reset) map.current?.fitBounds(nationalBounds, { padding: [14, 14] }); }, [reset]);
  useEffect(() => { if (focus && map.current) map.current.setView(latLng(focus.point), Math.max(8, map.current.getZoom())); }, [focus]);

  return (
    <div className="rail-national-map-shell">
      <div ref={host} className="rail-national-map" aria-label="全国列车运行地图" />
      <canvas ref={overlay} aria-hidden="true" />
    </div>
  );
}
