"""Build a durable, versioned railway cache from public OSM PBF extracts.

Requires osmium (PyPI). Uses OSM node identities for connectivity, never nearby
coordinates or geometric crossings. Complete geometries are stored separately
from the routing index and the simplified display layer.
"""
import argparse
import collections
import datetime
import hashlib
import json
import math
import pathlib
import re
import sys
import time

parser = argparse.ArgumentParser()
parser.add_argument('--pbf', nargs='+', required=True)
parser.add_argument('--stations', required=True)
parser.add_argument('--station-fallback', default='src/data/rail-station-coordinates.json')
parser.add_argument('--output', default='public/rail-network')
parser.add_argument('--version', required=True)
parser.add_argument('--python-libs')
args = parser.parse_args()
if args.python_libs: sys.path.insert(0, args.python_libs)
import osmium

started = time.monotonic()
root = pathlib.Path(args.output)
destination = root / args.version
destination.mkdir(parents=True, exist_ok=True)
official = json.loads(pathlib.Path(args.stations).read_text(encoding='utf8'))['stations']
fallback = json.loads(pathlib.Path(args.station_fallback).read_text(encoding='utf8'))
ways = {}
station_nodes = {}
station_areas = {}
station_relations = {}
urban_ways = set()
sources = []
EXCLUDED_ROUTES = {'subway', 'light_rail', 'tram', 'monorail', 'funicular'}
ACCEPTED_TRACKS = {'rail', 'narrow_gauge', 'preserved'}

def station_allowed(tags):
    return (tags.get('railway') in {'station', 'halt'} and tags.get('station') not in EXCLUDED_ROUTES
            and tags.get('subway') != 'yes' and tags.get('train') != 'no')

def report(stage, **values):
    print(json.dumps({'stage': stage, **values}, ensure_ascii=True), flush=True)

def railway_allowed(tags, urban=False):
    # Operator/owner are deliberately NOT inclusion criteria.
    return (tags.get('railway') in ACCEPTED_TRACKS and not urban
            and tags.get('subway') != 'yes' and tags.get('tram') != 'yes'
            and tags.get('light_rail') != 'yes'
            and tags.get('railway:subtype') not in EXCLUDED_ROUTES
            and tags.get('usage') != 'urban'
            and tags.get('disused') != 'yes' and tags.get('abandoned') != 'yes')

for path in args.pbf:
    with osmium.io.Reader(path) as reader:
        header = reader.header()
        snapshot = header.get('osmosis_replication_timestamp')
    sha = hashlib.sha256()
    with open(path, 'rb') as stream:
        while data := stream.read(4 * 1024 * 1024): sha.update(data)
    sources.append({'file': pathlib.Path(path).name, 'url': 'https://download.geofabrik.de/asia/' + pathlib.Path(path).name,
                    'bytes': pathlib.Path(path).stat().st_size, 'snapshotAt': snapshot, 'sha256': sha.hexdigest()})
    for item in osmium.FileProcessor(path).with_filter(osmium.filter.KeyFilter('railway', 'route')):
        if isinstance(item, osmium.osm.Way):
            tags = dict(item.tags)
            if tags.get('railway') in ACCEPTED_TRACKS:
                ways[item.id] = {'id': item.id, 'nodes': [node.ref for node in item.nodes], 'tags': tags}
            elif station_allowed(tags):
                station_areas[item.id] = {'id': item.id, 'nodes': [node.ref for node in item.nodes], 'tags': tags}
        elif isinstance(item, osmium.osm.Relation):
            if item.tags.get('route') in EXCLUDED_ROUTES:
                urban_ways.update(member.ref for member in item.members if member.type == 'w')
            elif station_allowed(dict(item.tags)):
                station_relations[item.id] = {'id': item.id, 'tags': dict(item.tags), 'nodeMembers': [member.ref for member in item.members if member.type == 'n'],
                                              'wayMembers': [member.ref for member in item.members if member.type == 'w' and member.role in {'outer', '', 'station'}]}
        elif isinstance(item, osmium.osm.Node):
            tags = dict(item.tags)
            if station_allowed(tags) and item.location.valid():
                station_nodes[item.id] = {'id': item.id, 'coordinate': [item.location.lon, item.location.lat], 'tags': tags}
    report('tags-read', file=pathlib.Path(path).name, trackWays=len(ways), stationNodes=len(station_nodes), excludedUrbanWays=len(urban_ways))

excluded = [way for way in ways.values() if not railway_allowed(way['tags'], way['id'] in urban_ways)]
ways = {key: way for key, way in ways.items() if railway_allowed(way['tags'], key in urban_ways) and len(way['nodes']) >= 2}
required_nodes = set(node for way in ways.values() for node in way['nodes'])
relation_way_ids = set(member for relation in station_relations.values() for member in relation['wayMembers'])
relation_ways = {}
if relation_way_ids:
    for path in args.pbf:
        for way in osmium.FileProcessor(path, entities=osmium.osm.WAY).with_filter(osmium.filter.IdFilter(relation_way_ids)):
            relation_ways[way.id] = [node.ref for node in way.nodes]
required_nodes.update(node for way in station_areas.values() for node in way['nodes'])
required_nodes.update(node for relation in station_relations.values() for node in relation['nodeMembers'])
required_nodes.update(node for values in relation_ways.values() for node in values)
coordinates = {}
for path in args.pbf:
    for node in osmium.FileProcessor(path, entities=osmium.osm.NODE).with_filter(osmium.filter.IdFilter(required_nodes)):
        if node.location.valid(): coordinates[node.id] = [round(node.location.lon, 7), round(node.location.lat, 7)]
    report('coordinates-read', file=pathlib.Path(path).name, nodes=len(coordinates), required=len(required_nodes))
missing_geometry = [key for key, way in ways.items() if any(node not in coordinates for node in way['nodes'])]
if missing_geometry: raise RuntimeError(f'Extract has incomplete way geometry: {len(missing_geometry)} ways')

def km(a, b):
    rad = math.pi / 180
    h = math.sin((b[1] - a[1]) * rad / 2) ** 2 + math.cos(a[1] * rad) * math.cos(b[1] * rad) * math.sin((b[0] - a[0]) * rad / 2) ** 2
    return 12742 * math.asin(min(1, math.sqrt(h)))

def normalize_name(value): return value.strip().removesuffix('站')
station_records = [{**node, 'kind': 'node'} for node in station_nodes.values()]
for area in station_areas.values():
    points = [coordinates[node] for node in set(area['nodes']) if node in coordinates]
    if points: station_records.append({**area, 'kind': 'way', 'coordinate': [sum(p[0] for p in points)/len(points),sum(p[1] for p in points)/len(points)]})
for relation in station_relations.values():
    nodes = set(relation['nodeMembers']) | {node for member in relation['wayMembers'] for node in relation_ways.get(member,[])}
    points = [coordinates[node] for node in nodes if node in coordinates]
    if points: station_records.append({**relation, 'kind': 'relation', 'coordinate': [sum(p[0] for p in points)/len(points),sum(p[1] for p in points)/len(points)]})
by_name = collections.defaultdict(list)
for node in station_records:
    names = set()
    for key in ['name:zh', 'name:zh-Hans', 'name', 'official_name:zh', 'official_name', 'alt_name']:
        names.update(normalize_name(value) for value in node['tags'].get(key, '').split(';') if value.strip())
    for name in names: by_name[name].append(node)
matched = {}
ambiguous = []
for station in official:
    code, name = station['code'], station['name']
    candidates = by_name[normalize_name(name)]
    referenced = [node for node in candidates if code in {node['tags'].get(key) for key in ['ref', 'ref:cr', 'ref:12306', 'railway:ref', 'ref:CN', 'ref:cn-railway']}]
    if referenced: candidates = referenced
    else:
        train_only = [node for node in candidates if node['tags'].get('train') == 'yes']
        if train_only: candidates = train_only
    if candidates and not any(km(a['coordinate'], b['coordinate']) > 1.5 for a in candidates for b in candidates):
        candidates.sort(key=lambda node: node['id'])
        selected = candidates[0]
        matched[code] = {'name': name, 'coordinate': selected['coordinate'], 'osmNodes': [node['id'] for node in candidates if node['kind'] == 'node'],
                         'osmWays': [node['id'] for node in candidates if node['kind'] == 'way'], 'osmRelations': [node['id'] for node in candidates if node['kind'] == 'relation'],
                         'coordinateSnapshotAt': min(source['snapshotAt'] for source in sources)}
    else:
        old = fallback['stations'].get(code)
        if old and old['name'] == name:
            matched[code] = {**old, 'coordinateSnapshotAt': fallback.get('snapshotAt')}
        elif candidates:
            ambiguous.append({'code': code, 'name': name, 'osmNodes': [node['id'] for node in candidates]})

# A small spatial index snaps stations to multiple real track vertices. No
# synthetic connections are ever added to the railway graph.
grid = collections.defaultdict(list)
rail_nodes = set(node for way in ways.values() for node in way['nodes'])
for node in rail_nodes:
    point = coordinates[node]; grid[(math.floor(point[0] * 50), math.floor(point[1] * 50))].append(node)
main_nodes = set(node for way in ways.values() if not way['tags'].get('service') and way['tags'].get('usage') not in {'industrial', 'military', 'test'} for node in way['nodes'])
node_ways = collections.defaultdict(set)
for way in ways.values():
    for node in way['nodes']: node_ways[node].add(way['id'])
station_candidates = {}
coverage = []
for station in official:
    code, name = station['code'], station['name']
    entry = matched.get(code)
    candidates = []
    if entry:
        point = entry['coordinate']; gx, gy = math.floor(point[0] * 50), math.floor(point[1] * 50)
        nearby = []
        for x in range(gx - 2, gx + 3):
            for y in range(gy - 2, gy + 3):
                for node in grid[(x,y)]:
                    separation = km(point, coordinates[node])
                    if separation <= 2: nearby.append((separation, node))
        nearby.sort()
        preferred = [pair for pair in nearby if pair[1] in main_nodes]
        if preferred: nearby = preferred
        # Separate nearby parallel tracks remain separate candidates. Candidates
        # from the same physical rail are retained only at distinct positions.
        selected_ways = set()
        for separation, node in nearby:
            if node_ways[node] & selected_ways: continue
            candidates.append((separation, node))
            selected_ways.update(node_ways[node])
            if len(candidates) == 6: break
        if candidates: station_candidates[code] = candidates
    coverage.append({'code': code, 'name': name, 'status': 'mapped' if candidates else 'coordinate-only' if entry else 'missing-coordinate',
                     'trackDistanceMeters': round(candidates[0][0] * 1000) if candidates else None})
report('station-coverage', official=len(official), coordinates=len(matched), connectedToTrack=len(station_candidates), unresolved=sum(row['status'] != 'mapped' for row in coverage))

counts = collections.Counter(node for way in ways.values() for node in way['nodes'])
junctions = {node for node, count in counts.items() if count > 1}
junctions.update(node for way in ways.values() for node in [way['nodes'][0], way['nodes'][-1]])
junctions.update(node for candidates in station_candidates.values() for _, node in candidates)
node_ids = sorted(junctions)
node_index = {node: index for index, node in enumerate(node_ids)}
vertices = [coordinates[node] for node in node_ids]
edges = []
geometries = []
edge_sources = []
line_counts = collections.defaultdict(lambda: {'ways': 0, 'trackKm': 0})
total_km = 0
def spatial_key(way):
    point = coordinates[way['nodes'][len(way['nodes']) // 2]]
    return (math.floor(point[0] * 2), math.floor(point[1] * 2), way['id'])

for way in sorted(ways.values(), key=spatial_key):
    tags = way['tags']; source_nodes = way['nodes']
    maxspeed_match = re.search(r'\d+', tags.get('maxspeed', ''))
    maxspeed = int(maxspeed_match.group()) if maxspeed_match else 0
    flags = (1 if tags.get('highspeed') == 'yes' or maxspeed >= 250 else 0) | (2 if tags.get('service') else 0) | (4 if tags.get('usage') in {'industrial', 'military', 'test'} else 0) | (8 if tags.get('railway') == 'narrow_gauge' or tags.get('gauge') not in {None, '', '1435', '1435;1435'} else 0) | (16 if tags.get('railway') == 'preserved' or tags.get('railway:preserved') == 'yes' else 0)
    line = []
    way_length = 0
    for node in source_nodes:
        line.append(node)
        if node in junctions and len(line) > 1:
            points = [coordinates[value] for value in line]
            length = sum(km(a,b) for a,b in zip(points, points[1:]))
            if length > .0001:
                edges.append([node_index[line[0]], node_index[line[-1]], round(length * 1000, 2), maxspeed, flags])
                geometries.append(points)
                edge_sources.append(way['id'])
                way_length += length
            line = [node]
    total_km += way_length
    name = tags.get('name:zh') or tags.get('name') or tags.get('ref') or '(unnamed)'
    line_counts[name]['ways'] += 1; line_counts[name]['trackKm'] += way_length

def save(filename, payload):
    payload = {'schema': 1, 'version': args.version, **payload}
    data = (json.dumps(payload, separators=(',', ':'), ensure_ascii=False) + '\n').encode('utf8')
    if len(data) >= 25 * 1024 * 1024: raise RuntimeError('Asset exceeds Pages size limit: ' + filename)
    (destination / filename).write_bytes(data)
    return {'file': args.version + '/' + filename, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

graph_stations = {code: {'name': matched[code]['name'], 'coordinate': matched[code]['coordinate'],
                          'candidates': [node_index[node] for _, node in values]} for code, values in station_candidates.items()}
node_files = [dict(save(f'nodes-{first // 100000:03d}.json', {'first': first, 'nodes': vertices[first:first+100000]}), first=first, count=len(vertices[first:first+100000])) for first in range(0, len(vertices), 100000)]
edge_files = [dict(save(f'edges-{first // 100000:03d}.json', {'first': first, 'edges': edges[first:first+100000]}), first=first, count=len(edges[first:first+100000])) for first in range(0, len(edges), 100000)]
graph_file = save('graph.json', {'nodeFiles': node_files, 'edgeFiles': edge_files, 'stations': graph_stations})
chunks = []
for first in range(0, len(edges), 1200):
    lines = geometries[first:first+1200]
    flat = [point for line in lines for point in line]
    chunk = save(f'geometry-{first // 1200:03d}.json', {'schema': 1, 'version': args.version, 'first': first, 'lines': lines, 'osmWays': edge_sources[first:first+1200]})
    chunks.append({**chunk, 'first': first, 'count': len(lines), 'bounds': [min(p[0] for p in flat), min(p[1] for p in flat), max(p[0] for p in flat), max(p[1] for p in flat)]})

def simplified(points, tolerance=.15):
    if len(points) <= 2: return points
    # Douglas-Peucker, only for the OVERVIEW. Routed geometry stays intact.
    a, b = points[0], points[-1]; cos = math.cos(a[1] * math.pi / 180)
    dx, dy = (b[0]-a[0]) * cos, b[1]-a[1]
    greatest = 0; index = 0
    for i, point in enumerate(points[1:-1], 1):
        fraction = max(0, min(1, ((point[0]-a[0])*cos*dx + (point[1]-a[1])*dy)/(dx*dx+dy*dy or 1)))
        distance = km(point, [a[0]+fraction*(b[0]-a[0]), a[1]+fraction*(b[1]-a[1])])
        if distance > greatest: greatest = distance; index = i
    if greatest > tolerance: return simplified(points[:index+1], tolerance)[:-1] + simplified(points[index:], tolerance)
    return [a, b]

# Low zoom displays a deduplicated overview. High zoom fetches only intersecting
# geographic tiles, with the original full track geometry. Both are display
# layers; route matching always uses the complete geometries above.
coarse = {}
tiles = collections.defaultdict(list)
for way in sorted(ways.values(), key=spatial_key):
    points = [coordinates[node] for node in way['nodes']]
    left, bottom = min(p[0] for p in points), min(p[1] for p in points)
    right, top = max(p[0] for p in points), max(p[1] for p in points)
    for x in range(math.floor(left / 2), math.floor(right / 2) + 1):
        for y in range(math.floor(bottom / 2), math.floor(top / 2) + 1): tiles[(x,y)].append(points)
    if not way['tags'].get('service'):
        rounded = [[round(p[0],3),round(p[1],3)] for p in simplified(points,.75)]
        line = [p for i,p in enumerate(rounded) if i == 0 or p != rounded[i-1]]
        if len(line) >= 2:
            key = json.dumps(line if line[0] <= line[-1] else line[::-1], separators=(',',':'))
            coarse.setdefault(key, line)
tile_assets = []
for (x,y), lines in sorted(tiles.items()):
    for first in range(0,len(lines),12000):
        asset = save(f'map-{x}-{y}-{first // 12000:02d}.json', {'lines': lines[first:first+12000]})
        tile_assets.append({**asset, 'bounds': [x*2,y*2,(x+1)*2,(y+1)*2]})
overview = save('overview.json', {'lines': list(coarse.values()), 'tiles': tile_assets})
report('network-built', junctions=len(vertices), edges=len(edges), geometryChunks=len(chunks), mapTiles=len(tile_assets), overviewLines=len(coarse))
audit = save('coverage.json', {'officialStations': len(official), 'mappedStations': len(station_candidates), 'stations': coverage, 'ambiguousNames': ambiguous,
                               'excludedUrbanWays': len(excluded), 'excludedWaySample': [{'id': way['id'], 'railway': way['tags'].get('railway'), 'name': way['tags'].get('name')} for way in excluded[:40]]})
inventory = save('lines.json', {'lines': [{'name': name, 'ways': values['ways'], 'trackKm': round(values['trackKm'],3)} for name, values in sorted(line_counts.items())]})
manifest = {'schema': 1, 'version': args.version, 'coordinateSystem': 'WGS84', 'source': 'OpenStreetMap contributors', 'license': 'ODbL-1.0',
            'sourceUrl': 'https://www.openstreetmap.org/copyright', 'snapshotAt': min(source['snapshotAt'] for source in sources), 'sources': sources,
            'importedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'scope': 'China including Hong Kong and Macau, plus Laos for 12306 international services. Railways only; no urban subway, tram, light rail, monorail or funicular.',
            'counts': {'ways': len(ways), 'geometryPoints': sum(len(line) for line in geometries), 'junctions': len(vertices), 'edges': len(edges), 'trackKm': round(total_km,3),
                       'officialStations': len(official), 'stationCoordinates': len(matched), 'mappedStations': len(station_candidates), 'excludedUrbanWays': len(excluded)},
            'graph': graph_file, 'overview': overview, 'coverage': audit, 'inventory': inventory, 'geometry': chunks}
(root / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf8')
station_snapshot = {**fallback, 'snapshotAt': manifest['snapshotAt'], 'stations': matched}
(destination / 'stations.json').write_text(json.dumps(station_snapshot, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf8')
report('complete', **manifest['counts'], geometryChunks=len(chunks), assetMiB=round(sum(file.stat().st_size for file in destination.glob('*.json')) / 1024**2,2), seconds=round(time.monotonic()-started))
