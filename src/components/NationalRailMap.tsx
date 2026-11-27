import { useEffect, useRef } from "react";
import L from "leaflet";
import { wgs84togcj02 } from "coordtransform";
import { gcjToWgs84 } from "../lib/rail-gps";
import { loadRailNetworkOverview } from "../lib/rail-network";
import { nationalCategories } from "../lib/rail-national";
import type { NationalStation, NationalTrain } from "../lib/rail-national";
import { DETAIL_ZOOM, dwellForTrain, movingTrainBody, platformTrainBody, symbolLength } from "../lib/rail-national-detail";
import type { RailViewport, StationDwell, StationGeometry } from "../lib/rail-national-detail";
import type { TrainEquipment } from "../lib/rail-equipment";
import { equipmentKey } from "../hooks/useNationalRailDetail";
import type { Coordinate } from "../lib/train-position";
import "leaflet/dist/leaflet.css";

type Dot = { x: number; y: number; trains: NationalTrain[]; body?: L.Point[] };
type StopDot = { point: L.Point; station: NationalStation };
const nationalBounds = L.latLngBounds([17, 73], [54, 135]);
const latLng = ([longitude, latitude]: Coordinate): L.LatLngTuple => {
  const [x, y] = wgs84togcj02(longitude, latitude);
  return [y, x];
};

function railwayLabel(context: CanvasRenderingContext2D, label: string, x: number, y: number, color: string) {
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 3.5;
  context.strokeStyle = "#102531";
  context.strokeText(label, x, y);
  context.fillStyle = color;
  context.fillText(label, x, y);
}

function trainStroke(context: CanvasRenderingContext2D, points: L.Point[], width: number, color: string, coaches?: number, schematic = false) {
  context.beginPath();
  points.forEach(({ x, y }, i) => { if (i) context.lineTo(x, y); else context.moveTo(x, y); });
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#132a34";
  context.lineWidth = width + 2.6;
  context.stroke();
  context.strokeStyle = color;
  context.lineWidth = width;
  if (schematic) context.setLineDash([4, 3]);
  context.stroke();
  context.setLineDash([]);
  if (!coaches || schematic) return;
  const offsets = [0];
  for (let i = 1; i < points.length; i++) offsets.push(offsets[i - 1] + points[i].distanceTo(points[i - 1]));
  const total = offsets.at(-1)!;
  if (total / coaches < 4) return;
  context.strokeStyle = "#1a3540";
  context.lineWidth = 1;
  for (let index = 1, segment = 1; index < coaches; index++) {
    const target = index * total / coaches;
    while (offsets[segment] < target) segment++;
    const length = offsets[segment] - offsets[segment - 1];
    if (!length) continue;
    const a = points[segment - 1], b = points[segment];
    const center = a.add(b.subtract(a).multiplyBy((target - offsets[segment - 1]) / length));
    const normal = L.point(-(b.y - a.y), b.x - a.x).multiplyBy(width / 2 / length);
    context.beginPath();
    context.moveTo(center.x - normal.x, center.y - normal.y);
    context.lineTo(center.x + normal.x, center.y + normal.y);
    context.stroke();
  }
}

const stationPoints = new WeakMap<NationalStation, L.LatLngTuple>();
function stationLatLng(station: NationalStation) {
  const cached = stationPoints.get(station);
  if (cached) return cached;
  const value = latLng([station[2], station[3]]);
  stationPoints.set(station, value);
  return value;
}

function drawStations(instance: L.Map, context: CanvasRenderingContext2D, stations: NationalStation[], focus: string | null) {
  if (instance.getZoom() < 6) return [];
  const dots: StopDot[] = [], labelCells = new Set<string>();
  const size = instance.getSize();
  for (const station of stations) {
    const point = instance.latLngToContainerPoint(stationLatLng(station));
    const { x, y } = point;
    if (x < 0 || y < 0 || x > size.x || y > size.y) continue;
    const active = station[0] === focus;
    context.beginPath();
    context.arc(x, y, active ? 4 : 2.2, 0, 2 * Math.PI);
    context.fillStyle = active ? "#ffd597" : "#b7cacf";
    context.fill();
    const key = `${Math.floor(x / 70)}/${Math.floor(y / 17)}`;
    if (active || instance.getZoom() >= 9 && !labelCells.has(key)) {
      labelCells.add(key);
      context.font = active ? "700 13px system-ui" : "500 11px system-ui";
      railwayLabel(context, station[1], x, y + 11, active ? "#ffd597" : "#d3dce1");
    }
    dots.push({ point, station });
  }
  return dots;
}

function drawDots(instance: L.Map, canvas: HTMLCanvasElement, trains: NationalTrain[], stations: NationalStation[],
  selected: string | undefined, geometry: StationGeometry | null | undefined, stationCode: string | null, arrivals: StationDwell[],
  equipment: Record<string, TrainEquipment | null>): { dots: Dot[]; stops: StopDot[] } {
  const { x: width, y: height } = instance.getSize();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const context = canvas.getContext("2d");
  if (!context) return { dots: [], stops: [] };
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  const zoom = instance.getZoom(), size = zoom >= 10 ? 0 : zoom >= 7 ? 15 : 23;
  const stops = drawStations(instance, context, stations, stationCode);
  const cells = new Map<string, Dot>();
  const dots: Dot[] = [];
  let focus: Dot | undefined;
  for (const train of trains) {
    if (!train.point) continue;
    const { x, y } = instance.latLngToContainerPoint(latLng(train.point));
    const margin = zoom >= DETAIL_ZOOM.lengths ? 160 : 16;
    if (x < -margin || x > width + margin || y < -margin || y > height + margin) continue;
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
  for (const dot of dots) {
    let { x, y } = dot;
    const group = dot.trains;
    const train = group[0], active = train.id === selected, count = group.length;
    const color = count === 1 ? nationalCategories[train.category].color : "#d0edf7";
    if (count === 1 && zoom >= DETAIL_ZOOM.lengths) {
      const length = symbolLength(train, equipment[equipmentKey(train)]);
      const assignment = train.stopped && train.stationCode === stationCode ? dwellForTrain(train, arrivals) : undefined;
      const berthed = assignment?.platform && geometry ? platformTrainBody(geometry, assignment.platform, length.meters) : null;
      const path = berthed?.line || movingTrainBody(train, length.meters);
      if (path) {
        const body = path.map(point => instance.latLngToContainerPoint(latLng(point)));
        const mid = body[0].add(body.at(-1)!).divideBy(2);
        x = dot.x = mid.x; y = dot.y = mid.y;
        dot.body = body;
        const meterPerPixel = instance.distance(instance.containerPointToLatLng(mid), instance.containerPointToLatLng(mid.add([1, 0])));
        trainStroke(context, body, Math.min(14, Math.max(2.8, 3.4 / meterPerPixel)), color, length.coaches, berthed ? !berthed.track : !train.path);
      }
      if ((dot.body || assignment?.platform) && (active || zoom >= DETAIL_ZOOM.station)) {
        context.font = "700 11px system-ui";
        const label = assignment?.platform ? `${train.code} · ${assignment.platform}` : train.code;
        railwayLabel(context, label, x, y - 12, "#f4fbff");
      }
      if (dot.body) continue;
    }
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
  return { dots, stops };
}

const OSM_ATTRIBUTION = '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>';

function lineInBounds(line: Coordinate[], [west, south, east, north]: RailViewport["bounds"]) {
  let lowX = Infinity, lowY = Infinity, highX = -Infinity, highY = -Infinity;
  for (const [x, y] of line) {
    lowX = Math.min(lowX, x); highX = Math.max(highX, x);
    lowY = Math.min(lowY, y); highY = Math.max(highY, y);
  }
  return highX >= west && lowX <= east && highY >= south && lowY <= north;
}

function pickDistance(dot: Dot, point: L.Point): number {
  let distance = point.distanceTo([dot.x, dot.y]);
  const path = dot.body;
  if (!path) return distance;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], dx = b.x - a.x, dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    if (!length) continue;
    const fraction = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
    distance = Math.min(distance, point.distanceTo([a.x + dx * fraction, a.y + dy * fraction]));
  }
  return distance;
}

export function NationalRailMap({ trains, stations, selected, onSelect, reset, focus, showBasemap, onMapNotice, onView,
  geometry, arrivals, equipment }: {
  trains: NationalTrain[];
  stations: NationalStation[];
  selected?: NationalTrain;
  onSelect: (id: string) => void;
  reset: number;
  focus: { point: Coordinate; zoom?: number } | null;
  showBasemap: boolean;
  onMapNotice: (notice: string) => void;
  onView: (view: RailViewport) => void;
  geometry: StationGeometry | null | undefined;
  arrivals: StationDwell[];
  equipment: Record<string, TrainEquipment | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const map = useRef<L.Map | null>(null);
  const line = useRef<L.Polyline | null>(null);
  const stationsLayer = useRef<L.LayerGroup | null>(null);
  const basemapLayer = useRef<L.TileLayer | null>(null);
  const rendered = useRef<{ dots: Dot[]; stops: StopDot[] }>({ dots: [], stops: [] });
  const stationCode = useRef<string | null>(null);
  const current = useRef({ trains, stations, selected, onSelect, onMapNotice, onView, showBasemap, geometry, arrivals, equipment });
  const queueDraw = useRef(() => {});
  const notifyMap = useRef(() => {});
  current.current = { trains, stations, selected, onSelect, onMapNotice, onView, showBasemap, geometry, arrivals, equipment };

  useEffect(() => {
    if (!host.current || !overlay.current) return;
    const canvas = overlay.current;
    const instance = L.map(host.current, { minZoom: 2, maxZoom: 20, zoomSnap: .5, preferCanvas: true, scrollWheelZoom: true });
    map.current = instance;
    instance.attributionControl.setPrefix(false);
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(instance);
    const basemap = L.tileLayer("https://wprd0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&size=1&scl=1&style=8&lang=zh_cn", {
      subdomains: "1234", maxNativeZoom: 18, className: "rail-national-basemap",
      attribution: '<a href="https://www.amap.com/" target="_blank" rel="noreferrer">高德地图</a>',
    });
    basemapLayer.current = basemap;
    stationsLayer.current = L.layerGroup().addTo(instance);
    const network = L.layerGroup().addTo(instance);
    let frame = 0, zooming = false, active = true, tilesLoaded = false, tilesFailed = false, networkFailed = false;
    let refreshId = 0, refreshTimer: number | undefined;
    notifyMap.current = () => current.current.onMapNotice(
      networkFailed ? "铁路图层加载失败，已保留可用线路。"
        : current.current.showBasemap && tilesFailed && !tilesLoaded ? "底图暂不可用，仍可查看铁路网和列车。" : "",
    );
    basemap.on("tileload", () => {
      if (tilesLoaded) return;
      tilesLoaded = true;
      notifyMap.current();
    });
    basemap.on("tileerror", () => { if (!tilesLoaded) { tilesFailed = true; notifyMap.current(); } });
    const draw = () => {
      frame = 0;
      if (zooming) return;
      const value = current.current;
      rendered.current = drawDots(instance, canvas, value.trains, value.stations, value.selected?.id, value.geometry,
        stationCode.current, value.arrivals, value.equipment);
    };
    queueDraw.current = () => { if (!frame) frame = requestAnimationFrame(draw); };
    instance.on("move resize", queueDraw.current);
    instance.on("zoomstart", () => { zooming = true; canvas.style.visibility = "hidden"; });
    instance.on("zoomend", () => { zooming = false; canvas.style.visibility = ""; queueDraw.current(); });
    const refresh = () => {
      const revision = ++refreshId;
      const bounds = instance.getBounds(), zoom = instance.getZoom();
      const [west, south] = gcjToWgs84([bounds.getWest(), bounds.getSouth()]);
      const [east, north] = gcjToWgs84([bounds.getEast(), bounds.getNorth()]);
      const viewBounds: RailViewport["bounds"] = [west, south, east, north];
      let closest: string | null = null, nearest = 2100;
      if (zoom >= DETAIL_ZOOM.station) {
        const center = instance.getCenter();
        for (const station of current.current.stations) {
          if (!/^[A-Z]{3}$/.test(station[0])) continue;
          const position = stationLatLng(station);
          if (!bounds.contains(position)) continue;
          const distance = center.distanceTo(position);
          if (distance < nearest) { closest = station[0]; nearest = distance; }
        }
      }
      stationCode.current = closest;
      current.current.onView({ zoom, bounds: viewBounds, station: closest });
      queueDraw.current();
      const selection = zoom >= DETAIL_ZOOM.tracks ? { zoom, bounds: viewBounds } : undefined;
      void loadRailNetworkOverview(selection).then(({ lines }) => {
        if (!active || revision !== refreshId) return;
        const visible = selection ? lines.filter(line => lineInBounds(line, viewBounds)) : lines;
        network.clearLayers();
        L.polyline(visible.map(points => points.map(latLng)), {
          weight: selection ? 1.15 : 1, color: "#a2bac4", opacity: selection ? .73 : .48, interactive: false,
          attribution: OSM_ATTRIBUTION,
        }).addTo(network).bringToBack();
        networkFailed = false;
        notifyMap.current();
      }).catch(() => { if (active && revision === refreshId) { networkFailed = true; notifyMap.current(); } });
    };
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(refresh, 180);
    };
    instance.on("moveend", scheduleRefresh);
    instance.on("click", (event: L.LeafletMouseEvent) => {
      let distance = 13, nearest: Dot | undefined;
      for (const dot of rendered.current.dots) {
        const delta = pickDistance(dot, event.containerPoint);
        if (delta <= distance) { distance = delta; nearest = dot; }
      }
      if (nearest) {
        if (nearest.trains.length === 1) current.current.onSelect(nearest.trains[0].id);
        else instance.setView(instance.containerPointToLatLng([nearest.x, nearest.y]), Math.min(instance.getMaxZoom(), instance.getZoom() + 2));
        return;
      }
      let stop: StopDot | undefined, hit = 10;
      for (const item of rendered.current.stops) {
        const gap = item.point.distanceTo(event.containerPoint);
        if (gap < hit) { hit = gap; stop = item; }
      }
      if (stop) instance.setView(stationLatLng(stop.station), Math.max(instance.getZoom(), DETAIL_ZOOM.station + 1));
    });
    instance.fitBounds(nationalBounds, { padding: [14, 14] });
    const resize = new ResizeObserver(() => { instance.invalidateSize({ pan: false }); queueDraw.current(); scheduleRefresh(); });
    resize.observe(host.current);
    scheduleRefresh();
    return () => {
      active = false;
      resize.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(refreshTimer);
      instance.remove();
      map.current = null;
      line.current = null;
      stationsLayer.current = null;
      basemapLayer.current = null;
      queueDraw.current = () => {};
      notifyMap.current = () => {};
    };
  }, []);

  useEffect(() => {
    const tileLayer = basemapLayer.current, instance = map.current;
    if (!tileLayer || !instance) return;
    if (showBasemap) tileLayer.addTo(instance);
    else tileLayer.remove();
    notifyMap.current();
  }, [showBasemap]);
  useEffect(() => { queueDraw.current(); }, [trains, stations, selected?.id, geometry, arrivals, equipment]);
  useEffect(() => {
    const layer = stationsLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const [, kind, ref, name, , points] of geometry?.platforms || []) {
      const coordinates = points.map(latLng);
      const options: L.PathOptions = { color: "#e2bb87", weight: kind === "area" ? 1 : 3, opacity: .9,
        fillColor: "#ac915d", fillOpacity: .46, attribution: OSM_ATTRIBUTION };
      const platform = (kind === "area" ? L.polygon(coordinates, options) : L.polyline(coordinates, options)).addTo(layer);
      const label = document.createElement("span");
      label.textContent = [ref, name].filter(Boolean).join(" · ") || "未标编号的站台";
      platform.bindTooltip(label, { sticky: true, className: "rail-national-platform-label" });
    }
  }, [geometry]);
  const path = selected?.path;
  useEffect(() => {
    line.current?.remove();
    line.current = map.current && path ? L.polyline(path.map(latLng), {
      color: "#90f4ff", weight: 3, opacity: .92, interactive: false,
    }).addTo(map.current) : null;
  }, [path]);
  useEffect(() => { if (reset) map.current?.fitBounds(nationalBounds, { padding: [14, 14] }); }, [reset]);
  useEffect(() => { if (focus && map.current) map.current.setView(latLng(focus.point), Math.max(focus.zoom ?? 8, map.current.getZoom())); }, [focus]);

  return (
    <div className={`rail-national-map-shell${showBasemap ? "" : " rail-network-only"}`}>
      <div ref={host} className="rail-national-map" aria-label="全国列车运行地图" />
      <canvas ref={overlay} aria-hidden="true" />
    </div>
  );
}
