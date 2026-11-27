"""Build a dated, compact nationwide passenger railway timetable from GTFS."""

import argparse
import csv
import io
import itertools
import json
import math
import re
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zipfile import ZipFile

CODE = re.compile(r"(?:[GDCZTKYS]\d{1,4}[A-Z]?|\d{4})")


def rows(archive, name):
    with io.TextIOWrapper(archive.open(name + ".txt"), encoding="utf-8-sig") as stream:
        yield from csv.DictReader(stream)


def seconds(value):
    hours, minutes, secs = map(int, value.split(":"))
    return hours * 3600 + minutes * 60 + secs


def distance_squared(point, other, longitude_scale):
    return ((point[0] - other[0]) * longitude_scale) ** 2 + (point[1] - other[1]) ** 2


def simplify(points, scale):
    """Keep turns to within roughly 350 m at map scale."""
    keep = {0, len(points) - 1}
    pending = [(0, len(points) - 1)]
    while pending:
        first, last = pending.pop()
        ax, ay = points[first]
        bx, by = points[last]
        dx, dy = (bx - ax) * scale, by - ay
        length = dx * dx + dy * dy
        farthest, threshold = 0, .003**2
        for i in range(first + 1, last):
            x, y = (points[i][0] - ax) * scale, points[i][1] - ay
            fraction = min(1, max(0, (x * dx + y * dy) / length)) if length else 0
            error = (x - fraction * dx) ** 2 + (y - fraction * dy) ** 2
            if error > threshold:
                farthest, threshold = i, error
        if farthest:
            keep.add(farthest)
            pending.extend(((first, farthest), (farthest, last)))
    return tuple(tuple(round(value * 10000) for value in points[i]) for i in sorted(keep))


def shape_legs(points, stops, stations):
    anchors = []
    start = 0
    for index, (station, _, _) in enumerate(stops):
        _, _, lon, lat = stations[station]
        scale = math.cos(math.radians(lat))
        previous = stops[index - 1][0] if index else None
        if previous == station:
            anchors.append(anchors[-1])
            continue
        candidates = range(start, len(points))
        nearest = min(candidates, key=lambda i: distance_squared(points[i], (lon, lat), scale), default=None)
        if nearest is None or distance_squared(points[nearest], (lon, lat), scale) > .023**2:
            anchors.append(None)
            continue
        anchors.append(nearest)
        start = nearest + 1
    for start, end in zip(anchors, anchors[1:]):
        if start is None or end is None or start >= end:
            yield None
            continue
        line = points[start:end + 1]
        scale = math.cos(math.radians(line[0][1]))
        length = sum(math.sqrt(distance_squared(a, b, scale)) for a, b in zip(line, line[1:]))
        direct = math.sqrt(distance_squared(line[0], line[-1], scale))
        yield simplify(line, scale) if length <= max(.45, direct * 4.5) else None


def official_roster(directory, day):
    file = directory / (day.isoformat() + ".json")
    if not file.exists():
        return None
    payload = json.loads(file.read_text(encoding="utf-8-sig"))
    if payload.get("status") is not True or not isinstance(payload.get("data"), list):
        raise ValueError(f"12306 roster unavailable for {day}")
    roster = {row["train_no"] for row in payload["data"] if row.get("train_no")}
    if len(roster) < 4000:
        raise ValueError(f"12306 roster unexpectedly small for {day}: {len(roster)}")
    return roster


def compile_feed(archive, roster_directory, today, feed_url):
    info = next(rows(archive, "feed_info"))
    feed_date = date.fromisoformat(info["feed_version"])
    days = [today + timedelta(days=offset) for offset in range(-4, 3)]
    if feed_date > today or today - feed_date > timedelta(days=14):
        raise ValueError(f"Timetable snapshot is outside the accepted freshness window: {feed_date}")
    day_index = {day.strftime("%Y%m%d"): index for index, day in enumerate(days)}
    rosters = [official_roster(roster_directory, day) for day in days]
    service = defaultdict(int)
    for row in rows(archive, "calendar_dates"):
        index = day_index.get(row["date"])
        if index is not None and row["exception_type"] == "1":
            service[row["service_id"]] |= 1 << index
    for row in rows(archive, "calendar_dates"):
        index = day_index.get(row["date"])
        if index is not None and row["exception_type"] == "2":
            service[row["service_id"]] &= ~(1 << index)

    stations, station_index = [], {}
    for row in rows(archive, "stops"):
        try:
            lon, lat = float(row["stop_lon"]), float(row["stop_lat"])
        except ValueError:
            continue
        if not (10 <= lat <= 58 and 65 <= lon <= 145):
            continue
        station_index[row["stop_id"]] = len(stations)
        stations.append([row["stop_id"], row["stop_name"], round(lon, 5), round(lat, 5)])

    stops_by_trip = defaultdict(list)
    for row in rows(archive, "stop_times"):
        stops_by_trip[row["trip_id"]].append(row)

    trains, shape_users, path_index = [], defaultdict(list), {}
    coverage = [0] * len(days)
    for row in rows(archive, "trips"):
        code, train_id = row["trip_short_name"], row["trip_id"]
        mask = service.get(row["service_id"], 0)
        if not CODE.fullmatch(code) or not mask:
            continue
        for i, roster in enumerate(rosters):
            if roster is not None and train_id not in roster:
                mask &= ~(1 << i)
        if not mask:
            continue
        try:
            timetable = sorted(stops_by_trip[train_id], key=lambda item: int(item["stop_sequence"]))
            stops = [[station_index.get(item["stop_id"], -1), seconds(item["arrival_time"]),
                      seconds(item["departure_time"])] for item in timetable]
        except ValueError:
            continue
        if len(stops) < 2 or len(stops) > 250 or any(
            arrive < (stops[i - 1][2] if i else 0) or leave < arrive or leave >= 5 * 86400
            for i, (_, arrive, leave) in enumerate(stops)
        ) or stops[0][2] >= min(86400, stops[-1][1]):
            continue
        for i in range(len(days)):
            coverage[i] += bool(mask & (1 << i))
        train = [code, mask, stops, [], train_id]
        trains.append(train)
        if row["shape_id"] and all(stop[0] >= 0 for stop in stops):
            shape_users[row["shape_id"]].append(train)

    for shape, records in itertools.groupby(rows(archive, "shapes"), key=lambda row: row["shape_id"]):
        if shape not in shape_users:
            continue
        points = [(float(row["shape_pt_lon"]), float(row["shape_pt_lat"])) for row in records]
        if len(points) < 2 or not all(65 <= x <= 145 and 10 <= y <= 58 for x, y in points):
            continue
        for train in shape_users[shape]:
            train[3].extend(-1 if line is None else path_index.setdefault(line, len(path_index))
                            for line in shape_legs(points, train[2], stations))

    paths = list(path_index)
    current = days.index(today)
    if len(stations) < 2500 or len(trains) < 6500 or coverage[current] < 5500:
        raise ValueError(f"Nationwide timetable coverage is unexpectedly low: {coverage}")
    return {
        "schema": 1, "feedDate": feed_date.isoformat(), "feedUrl": feed_url,
        "days": [[day.isoformat(), coverage[i], len(rosters[i]) if rosters[i] is not None else None]
                 for i, day in enumerate(days)],
        "stations": stations, "trains": trains, "paths": paths,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--feed", type=Path, required=True)
    parser.add_argument("--feed-url", required=True)
    parser.add_argument("--rosters", type=Path, required=True)
    parser.add_argument("--today", type=date.fromisoformat,
                        default=datetime.now(timezone(timedelta(hours=8))).date())
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    with ZipFile(args.feed) as archive:
        snapshot = compile_feed(archive, args.rosters, args.today, args.feed_url)
    packed = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(packed) > 16 * 1024 * 1024:
        raise ValueError("Nationwide timetable exceeded the serving size limit")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(packed)
    print(f"{len(snapshot['trains'])} timetable records, {len(snapshot['paths'])} paths, {len(packed):,} bytes")
    print(snapshot["days"])


if __name__ == "__main__":
    main()
