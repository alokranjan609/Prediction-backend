
# Input coordinates are [lat, lon] pairs. Each grid point represents one cell
# inside the polygon at the given degree spacing.


from __future__ import annotations

import numpy as np
from shapely.geometry import Point, Polygon as ShapelyPolygon

DEFAULT_GRID_SPACING = 0.5


def polygon_to_grid(
    polygon_coords: list[list[float]],
    grid_spacing: float = DEFAULT_GRID_SPACING,
) -> dict:
    """
      1. Build Shapely polygon from [lat, lon] vertices
      2. Compute axis-aligned bounding box
      3. Step through bbox at grid_spacing intervals (np.arange)
      4. Keep points that fall inside the polygon
      5. If none qualify, use the polygon centroid

    Args:
        polygon_coords: List of [latitude, longitude] pairs (≥3 vertices).
        grid_spacing: Step size in degrees (default 0.5).

    Returns:
        Dict with grid_points, count, bounds, and grid_spacing.
    """
    if len(polygon_coords) < 3:
        raise ValueError("At least 3 coordinates are required to form a polygon.")

    if grid_spacing <= 0:
        raise ValueError("grid_spacing must be a positive number.")

    lats_c = [c[0] for c in polygon_coords]
    lons_c = [c[1] for c in polygon_coords]

    for i, (lat, lon) in enumerate(polygon_coords):
        if not (-90 <= lat <= 90):
            raise ValueError(f"Coordinate {i}: latitude must be between -90 and 90.")
        if not (-180 <= lon <= 180):
            raise ValueError(f"Coordinate {i}: longitude must be between -180 and 180.")

    poly = ShapelyPolygon([(c[1], c[0]) for c in polygon_coords])
    min_lat, max_lat = min(lats_c), max(lats_c)
    min_lon, max_lon = min(lons_c), max(lons_c)

    grid_pts = [
        (glat, glon)
        for glat in np.arange(min_lat, max_lat, grid_spacing)
        for glon in np.arange(min_lon, max_lon, grid_spacing)
        if poly.contains(Point(glon, glat))
    ]

    if not grid_pts:
        c = poly.centroid
        grid_pts = [(c.y, c.x)]

    grid_points = [{"lat": float(lat), "lon": float(lon)} for lat, lon in grid_pts]

    return {
        "grid_points": grid_points,
        "count": len(grid_points),
        "bounds": {
            "min_lat": min_lat,
            "max_lat": max_lat,
            "min_lon": min_lon,
            "max_lon": max_lon,
        },
        "grid_spacing": grid_spacing,
    }
