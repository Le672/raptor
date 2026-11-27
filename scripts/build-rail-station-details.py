"""Extract mapped railway platforms and numbered tracks for official stations."""
import argparse
from collections import defaultdict
import json
import math
from pathlib import Path
import re

import osmium


URBAN = {"subway", "light_rail", "tram", "monorail", "funicular"}
NUMBER = re.compile(r"(?<![0-9A-Za-z])0*([1-9]\d{0,2}[AB]?)(?![0-9A-Za-z])", re.I)
NAMED_REF = re.compile(r"(?<!\d)0*([1-9]\d{0,2}[AB]?)\s*(?:号)?(?:站台|站臺|股道|道)", re.I)


def refs(text):
    return sorted(set(value.upper() for value in NUMBER.findall(text or "")))


def urban(tags):
    return (any(tags.get(key) == "yes" for key in URBAN) or
            tags.get("station") in URBAN or tags.get("usage") == "urban" or tags.get("train") == "no")


def write(file, data):
    file.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf8")


def collections_from(paths):
    geometries, excluded, relations = {}, set(), {}
    for path in paths:
        for obj in osmium.FileProcessor(path).with_filter(osmium.filter.KeyFilter("railway", "route", "public_transport")):
            tags = dict(obj.tags)
            if isinstance(obj, osmium.osm.Relation):
                if tags.get("route") in URBAN or urban(tags):
                    excluded.update(m.ref for m in obj.members if m.type == "w")
                elif (tags.get("railway") == "platform" or tags.get("public_transport") == "platform") and tags.get("type") == "multipolygon":
                    ids = [m.ref for m in obj.members if m.type == "w" and m.role in ("outer", "")]
                    if ids:
                        relations[obj.id] = tags, ids
            elif isinstance(obj, osmium.osm.Way) and not urban(tags):
                kind = tags.get("railway")
                if kind in ("platform", "platform_edge", "rail", "narrow_gauge") or tags.get("public_transport") == "platform":
                    if tags.get("disused") != "yes" and tags.get("abandoned") != "yes":
                        geometries[obj.id] = tags, [node.ref for node in obj.nodes]
    members = {member for _, ids in relations.values() for member in ids if member not in geometries and member not in excluded}
    for path in paths:
        if members:
            for obj in osmium.FileProcessor(path, entities=osmium.osm.WAY).with_filter(osmium.filter.IdFilter(members)):
                geometries[obj.id] = {}, [node.ref for node in obj.nodes]
    needed = {node for way, (_, nodes) in geometries.items() if way not in excluded for node in nodes}
    coords = {}
    for path in paths:
        for node in osmium.FileProcessor(path, entities=osmium.osm.NODE).with_filter(osmium.filter.IdFilter(needed)):
            if node.location.valid():
                coords[node.id] = [round(node.location.lon, 7), round(node.location.lat, 7)]
    print(f"Read {len(geometries):,} railway and platform ways and {len(coords):,} coordinates", flush=True)
    return geometries, excluded, relations, coords


def extract(paths, graph, output):
    ways, excluded, relations, coords = collections_from(paths)
    sources = graph["stations"]
    grid = defaultdict(list)
    for code, data in sources.items():
        lon, lat = data["coordinate"]
        grid[(math.floor(lon * 20), math.floor(lat * 20))].append((code, lon, lat))

    def nearest(points):
        lon = sum(p[0] for p in points) / len(points)
        lat = sum(p[1] for p in points) / len(points)
        x, y = math.floor(lon * 20), math.floor(lat * 20)
        scale = math.cos(math.radians(lat))
        candidates = []
        for a in range(x - 1, x + 2):
            for b in range(y - 1, y + 2):
                for code, sx, sy in grid.get((a, b), []):
                    distance = math.hypot((lon - sx) * scale, lat - sy) * 111_195
                    if distance <= 1700:
                        candidates.append((distance, code))
        candidates.sort()
        return candidates

    # OSM platform signs can name an island while its edge and track use different refs.
    # Keep those roles distinct; preserve each explicit ref and every real coordinate.
    details = defaultdict(lambda: {"platforms": [], "tracks": []})
    relation_tags = {}
    for rel, (tags, ids) in relations.items():
        if not any(member in excluded for member in ids):
            for member in ids:
                relation_tags.setdefault(member, (rel, tags))
    for way, (tags, nodes) in ways.items():
        if way in excluded or len(nodes) < 2 or not all(node in coords for node in nodes):
            continue
        relation, outer = relation_tags.get(way, (None, {}))
        tags = {**outer, **tags}
        shape = [coords[node] for node in nodes]
        kind = tags.get("railway")
        tags_ref = refs(tags.get("ref", ""))
        if kind in ("rail", "narrow_gauge"):
            if not tags_ref or tags.get("usage") in ("industrial", "military", "test"):
                continue
            # A numbered track is useful for positioning only inside the local station throat.
            if abs(shape[-1][0] - shape[0][0]) + abs(shape[-1][1] - shape[0][1]) > .055:
                continue
            for _, code in nearest(shape)[:2]:
                details[code]["tracks"].append([way, tags_ref, shape])
        elif kind in ("platform", "platform_edge") or tags.get("public_transport") == "platform":
            if kind not in ("platform", "platform_edge") and tags.get("train") != "yes":
                continue
            candidates = nearest(shape)
            if not candidates:
                continue
            _, code = candidates[0]
            name = tags.get("name:zh", tags.get("name", ""))[:45]
            label = tags.get("ref", "")[:35]
            # Reject public-transport platforms that explicitly identify a different mode.
            if urban(tags):
                continue
            closed = nodes[0] == nodes[-1] and len(nodes) >= 4 and tags.get("area") != "no"
            if not tags_ref:
                tags_ref = sorted(set(value.upper() for value in NAMED_REF.findall(name)))
            details[code]["platforms"].append([way, "edge" if kind == "platform_edge" else "area" if closed else "line",
                                               label, name, tags_ref, shape])

    tiles = defaultdict(dict)
    station_tiles = {}
    for code, data in sorted(details.items()):
        if not data["platforms"]:
            continue
        lon, lat = sources[code]["coordinate"]
        tile = f"{math.floor(lon * 4)}-{math.floor(lat * 4)}"
        station_tiles[code] = tile
        tiles[tile][code] = data
    output.mkdir(parents=True, exist_ok=True)
    for tile, stations in tiles.items():
        write(output / (tile + ".json"), stations)
    write(output / "index.json", {"schema": 1, "source": "OpenStreetMap", "stations": station_tiles})
    print(f"{len(station_tiles)} stations, {len(tiles)} tiles, {sum(len(row['platforms']) for row in details.values())} platform features", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pbf", nargs="+", required=True)
    parser.add_argument("--graph", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    extract(args.pbf, json.loads(args.graph.read_text(encoding="utf8")), args.output)
