from pydantic import BaseModel, Field, field_validator


class GridRequest(BaseModel):
    coordinates: list[list[float]] = Field(
        ...,
        min_length=3,
        description="Polygon vertices as [latitude, longitude] pairs.",
    )
    grid_spacing: float = Field(
        default=0.5,
        gt=0,
        description="Grid step size in degrees.",
    )

    @field_validator("coordinates")
    @classmethod
    def validate_coordinate_pairs(cls, coords: list[list[float]]) -> list[list[float]]:
        for i, pair in enumerate(coords):
            if len(pair) != 2:
                raise ValueError(
                    f"Coordinate {i} must be a [latitude, longitude] pair."
                )
        return coords


class GridPoint(BaseModel):
    lat: float
    lon: float


class Bounds(BaseModel):
    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float


class GridResponse(BaseModel):
    success: bool = True
    grid_points: list[GridPoint]
    count: int
    bounds: Bounds
    grid_spacing: float


class PolygonPredictionRequest(BaseModel):
    coordinates: list[list[float]] = Field(
        ...,
        min_length=3,
        description="Polygon vertices as [latitude, longitude] pairs.",
    )
    grid_spacing: float = Field(
        default=0.5,
        gt=0,
        description="Grid step size in degrees.",
    )
    weather: dict | None = Field(
        default=None,
        description="Optional weather dictionary containing temp, humidity, wind, rainfall.",
    )

    @field_validator("coordinates")
    @classmethod
    def validate_coordinate_pairs(cls, coords: list[list[float]]) -> list[list[float]]:
        for i, pair in enumerate(coords):
            if len(pair) != 2:
                raise ValueError(
                    f"Coordinate {i} must be a [latitude, longitude] pair."
                )
        return coords

