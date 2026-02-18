from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Tuple, Optional

import numpy as np
import xarray as xr
from PIL import Image
import matplotlib.cm as cm
import pandas as pd


# =========================
# Config
# =========================

@dataclass
class Config:
    input_zarr: str = r"D:\Job\Weather_map\storage\forecasts\fourcastnet3\TEST_RUN\data.zarr"
    out_tiles_root: str = r"D:\Job\Weather_map\storage\tiles"
    model_name: str = "fourcastnet3"

    # Переменные
    variables: Tuple[str, ...] = ("t2m", "wind")

    # Зумы (для проверки ставь 2..4, потом 0..6)
    z_min: int = 2
    z_max: int = 4

    tile_size: int = 256

    # Ограничение времени (None = все)
    time_indices: Optional[Tuple[int, ...]] = (0,)

    # Диапазоны значений
    ranges = {
        "t2m": (-40.0, 45.0),   # °C
        "wind": (0.0, 30.0),    # m/s
    }

    # Цветовые карты
    cmaps = {
        "t2m": "coolwarm",
        "wind": "viridis",
    }

    # ===== РЕГИОН: Западная Россия =====
    min_lat: float = 45.0
    max_lat: float = 70.0
    min_lon: float = 20.0
    max_lon: float = 60.0


CFG = Config()


# =========================
# WebMercator helpers
# =========================

def tile_lon_bounds(z: int, x: int) -> Tuple[float, float]:
    n = 2 ** z
    lon_left = x / n * 360.0 - 180.0
    lon_right = (x + 1) / n * 360.0 - 180.0
    return lon_left, lon_right

def tile_lat_bounds(z: int, y: int) -> Tuple[float, float]:
    n = 2 ** z

    def inv_merc(t: float) -> float:
        return math.degrees(math.atan(math.sinh(t)))

    lat_top = inv_merc(math.pi * (1 - 2 * y / n))
    lat_bottom = inv_merc(math.pi * (1 - 2 * (y + 1) / n))
    return lat_bottom, lat_top  # (min, max)


def build_latlon_grid_for_tile(z: int, x: int, y: int, size: int):
    """
    Возвращает qlat, qlon формы (size, size), чтобы bilinear_sample работал корректно.
    """
    lon_l, lon_r = tile_lon_bounds(z, x)
    lat_b, lat_t = tile_lat_bounds(z, y)

    # центры пикселей
    xs = (np.arange(size) + 0.5) / size
    ys = (np.arange(size) + 0.5) / size

    lon_1d = lon_l + (lon_r - lon_l) * xs          # (W,)
    lat_1d = lat_t + (lat_b - lat_t) * ys          # (H,) сверху вниз

    qlon = np.repeat(lon_1d[None, :], size, axis=0)  # (H,W)
    qlat = np.repeat(lat_1d[:, None], size, axis=1)  # (H,W)

    return qlat.astype(np.float32), qlon.astype(np.float32)


# =========================
# Sampling
# =========================

def normalize_longitudes(ds_lon: np.ndarray, qlon: np.ndarray) -> np.ndarray:
    """
    Если долгота в датасете 0..360, то -180..180 переводим в 0..360.
    """
    if float(ds_lon.min()) >= 0.0 and float(ds_lon.max()) > 180.0:
        q = qlon.copy()
        q[q < 0.0] += 360.0
        return q
    return qlon


def bilinear_sample(field: np.ndarray, lat: np.ndarray, lon: np.ndarray,
                    qlat: np.ndarray, qlon: np.ndarray) -> np.ndarray:
    """
    field: (nlat, nlon)
    qlat, qlon: (H, W)
    """
    dlat = float(lat[1] - lat[0])
    dlon = float(lon[1] - lon[0])

    fi = (qlat - float(lat[0])) / dlat
    fj = (qlon - float(lon[0])) / dlon

    i0 = np.floor(fi).astype(np.int32)
    j0 = np.floor(fj).astype(np.int32)
    i1 = i0 + 1
    j1 = j0 + 1

    h, w = qlat.shape
    out = np.full((h, w), np.nan, dtype=np.float32)

    ok = (
        (i0 >= 0) & (i1 < field.shape[0]) &
        (j0 >= 0) & (j1 < field.shape[1])
    )

    if not np.any(ok):
        return out

    wi = (fi - i0).astype(np.float32)
    wj = (fj - j0).astype(np.float32)

    # bilinear
    out[ok] = (
        field[i0[ok], j0[ok]] * (1 - wi[ok]) * (1 - wj[ok]) +
        field[i1[ok], j0[ok]] * wi[ok] * (1 - wj[ok]) +
        field[i0[ok], j1[ok]] * (1 - wi[ok]) * wj[ok] +
        field[i1[ok], j1[ok]] * wi[ok] * wj[ok]
    ).astype(np.float32)

    return out


# =========================
# Color
# =========================

def colorize(values: np.ndarray, vmin: float, vmax: float, cmap_name: str) -> np.ndarray:
    cmap = cm.get_cmap(cmap_name)
    x = (values - vmin) / (vmax - vmin)
    x = np.clip(x, 0.0, 1.0)
    rgba = (cmap(x) * 255).astype(np.uint8)
    rgba[~np.isfinite(values), 3] = 0
    return rgba


def time_to_slug(t) -> str:
    # делаем строку YYYYMMDDTHHMMSSZ
    return pd.to_datetime(t).strftime("%Y%m%dT%H%M%SZ")


# =========================
# Main
# =========================

def main():
    cfg = CFG
    ds = xr.open_zarr(cfg.input_zarr)

    # координаты
    if "latitude" not in ds.coords or "longitude" not in ds.coords:
        raise ValueError("Expected coords 'latitude' and 'longitude' in dataset.")

    lat = ds["latitude"].values.astype(np.float32)
    lon = ds["longitude"].values.astype(np.float32)

    # lat должен быть возрастающим для нашей билинейки
    if lat[0] > lat[-1]:
        ds = ds.sortby("latitude")
        lat = ds["latitude"].values.astype(np.float32)

    if "time" not in ds.coords:
        raise ValueError("Expected coord 'time' in dataset.")

    times = ds["time"].values
    time_indices = cfg.time_indices if cfg.time_indices is not None else tuple(range(len(times)))

    out_root = Path(cfg.out_tiles_root) / cfg.model_name

    for var in cfg.variables:
        if var not in ds.data_vars:
            raise ValueError(f"Variable '{var}' not found. Available: {list(ds.data_vars)}")

        vmin, vmax = cfg.ranges[var]
        cmap_name = cfg.cmaps[var]

        for ti in time_indices:
            t_slug = time_to_slug(times[ti])
            field = ds[var].isel(time=ti).values.astype(np.float32)  # (lat,lon)

            for z in range(cfg.z_min, cfg.z_max + 1):
                n = 2 ** z
                for x in range(n):
                    for y in range(n):

                        # ===== ФИЛЬТР ПО РЕГИОНУ =====
                        lat_b, lat_t = tile_lat_bounds(z, y)
                        lon_l, lon_r = tile_lon_bounds(z, x)

                        if (
                            lat_t < cfg.min_lat or lat_b > cfg.max_lat or
                            lon_r < cfg.min_lon or lon_l > cfg.max_lon
                        ):
                            continue
                        # =============================

                        qlat, qlon = build_latlon_grid_for_tile(z, x, y, cfg.tile_size)
                        qlon = normalize_longitudes(lon, qlon)

                        sampled = bilinear_sample(field, lat, lon, qlat, qlon)
                        rgba = colorize(sampled, vmin, vmax, cmap_name)

                        out_dir = out_root / var / t_slug / str(z) / str(x)
                        out_dir.mkdir(parents=True, exist_ok=True)
                        Image.fromarray(rgba, "RGBA").save(out_dir / f"{y}.png")

                print(f"done: var={var} time={t_slug} z={z}")

    print("Tiles written to:", out_root)


if __name__ == "__main__":
    main()
