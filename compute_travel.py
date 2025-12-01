"""
compute_travel.py

Reads `data/races.csv` and `data/circuits.csv`, computes distances (km) between consecutive
races in the same season using circuit lat/lng and outputs `data/travel_between_races.csv`.

Output columns:
year,from_round,from_circuitId,from_name,from_lat,from_lng,to_round,to_circuitId,to_name,to_lat,to_lng,distance_km

Usage:
    python compute_travel.py

Optional args (see code): change input/output paths.
"""

import csv
import math
import os

# Input/output paths (relative to project root)
RACES_CSV = os.path.join('data', 'races.csv')
CIRCUITS_CSV = os.path.join('data', 'circuits.csv')
OUT_CSV = os.path.join('data', 'travel_between_races.csv')
OUT_SUMMARY = os.path.join('data', 'season_travel_summary.csv')


def haversine(lat1, lon1, lat2, lon2):
    """Return distance in kilometers between two lat/lon points using haversine formula."""
    # convert degrees to radians
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi/2.0)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    R = 6371.0088  # mean Earth radius in kilometers
    return R * c


def load_circuits(path):
    """Return dict mapping circuitId (int) -> {name, lat, lng}
    Skips entries with missing lat/lng.
    """
    circuits = {}
    with open(path, newline='', encoding='utf-8') as fh:
        reader = csv.DictReader(fh)
        for r in reader:
            cid = r.get('circuitId')
            if not cid:
                continue
            try:
                cid_i = int(cid)
            except ValueError:
                continue
            try:
                lat = float(r.get('lat'))
                lng = float(r.get('lng'))
            except (TypeError, ValueError):
                # missing or invalid coordinates
                continue
            circuits[cid_i] = {
                'name': r.get('name') or r.get('circuitRef') or '',
                'lat': lat,
                'lng': lng,
            }
    return circuits


def load_races(path):
    """Return list of race rows as dicts with keys: raceId, year(int), round(int), circuitId(int), name, date
    Rows without numeric year/round/circuitId are skipped.
    """
    races = []
    with open(path, newline='', encoding='utf-8') as fh:
        reader = csv.DictReader(fh)
        for r in reader:
            try:
                year = int(r.get('year'))
                round_no = int(r.get('round'))
                circuitId = int(r.get('circuitId'))
            except (TypeError, ValueError):
                # skip incomplete rows
                continue
            races.append({
                'raceId': r.get('raceId'),
                'year': year,
                'round': round_no,
                'circuitId': circuitId,
                'name': r.get('name') or '',
                'date': r.get('date') or '',
            })
    return races


def compute_travel(races, circuits):
    """Compute distances between consecutive rounds within each season.
    Returns a tuple (rows, summary) where `rows` is a list of leg rows (with cumulative_km),
    and `summary` is a list of per-season aggregates.
    """
    # Group races by year
    by_year = {}
    for race in races:
        by_year.setdefault(race['year'], []).append(race)

    out_rows = []
    summary = []
    for year, rlist in by_year.items():
        # sort by round ascending
        rlist_sorted = sorted(rlist, key=lambda r: r['round'])
        running_total = 0.0
        legs_count = 0
        for i in range(1, len(rlist_sorted)):
            prev = rlist_sorted[i-1]
            curr = rlist_sorted[i]
            prev_c = circuits.get(prev['circuitId'])
            curr_c = circuits.get(curr['circuitId'])
            if not prev_c or not curr_c:
                # skip if coordinates missing
                continue
            dist_km = haversine(prev_c['lat'], prev_c['lng'], curr_c['lat'], curr_c['lng'])
            running_total += dist_km
            legs_count += 1
            out_rows.append({
                'year': year,
                'from_round': prev['round'],
                'from_circuitId': prev['circuitId'],
                'from_name': prev_c.get('name',''),
                'from_lat': prev_c['lat'],
                'from_lng': prev_c['lng'],
                'to_round': curr['round'],
                'to_circuitId': curr['circuitId'],
                'to_name': curr_c.get('name',''),
                'to_lat': curr_c['lat'],
                'to_lng': curr_c['lng'],
                'distance_km': round(dist_km, 3),
                'cumulative_km': round(running_total, 3),
            })

        # add season summary (even if legs_count == 0)
        summary.append({
            'year': year,
            'total_distance_km': round(running_total, 3),
            'legs_count': legs_count,
            'average_leg_km': round(running_total / legs_count, 3) if legs_count else 0.0,
        })

    return out_rows, summary


def write_output(path, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', newline='', encoding='utf-8') as fh:
        fieldnames = ['year','from_round','from_circuitId','from_name','from_lat','from_lng',
                      'to_round','to_circuitId','to_name','to_lat','to_lng','distance_km','cumulative_km']
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)


def write_summary(path, summary_rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', newline='', encoding='utf-8') as fh:
        fieldnames = ['year', 'total_distance_km', 'legs_count', 'average_leg_km']
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for r in sorted(summary_rows, key=lambda x: x['year']):
            writer.writerow(r)


def main():
    print('Loading circuits from:', CIRCUITS_CSV)
    circuits = load_circuits(CIRCUITS_CSV)
    print(f'Loaded {len(circuits)} circuits with coordinates.')

    print('Loading races from:', RACES_CSV)
    races = load_races(RACES_CSV)
    print(f'Loaded {len(races)} races (filtered incomplete rows).')

    print('Computing travel between consecutive rounds per season...')
    rows, summary = compute_travel(races, circuits)
    print(f'Computed {len(rows)} inter-round travel legs.')

    print('Writing travel legs to:', OUT_CSV)
    write_output(OUT_CSV, rows)

    print('Writing season summary to:', OUT_SUMMARY)
    write_summary(OUT_SUMMARY, summary)

    print('Done.')


if __name__ == '__main__':
    main()
