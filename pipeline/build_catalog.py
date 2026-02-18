from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Any

import xarray as xr
import pandas as pd


# =========================
# CONFIG
# =========================

@dataclass
class Config:
    # Папка модели
    model_name: str = "fourcastnet3"

    # Путь к прогнозам
    forecasts_root: Path = Path("storage/forecasts/fourcastnet3")

    # Если None — берётся самая свежая папка
    run_time_slug: str | None = None

    # Куда писать catalog.json
    output_path: Path = Path("storage/metadata/catalog.json")

    # Публикуемые переменные
    variables = [
        {"id": "t2m", "name": "Temperature", "unit": "C", "min": -40, "max": 45},
        {"id": "wind", "name": "Wind speed", "unit": "m/s", "min": 0, "max": 30},
        # Если добавишь видимость:
        # {"id": "visibility", "name": "Visibility", "unit": "km", "min": 0, "max": 20},
    ]


CFG = Config()


# =========================
# HELPERS
# =========================

def find_latest_run(root: Path) -> str:
    runs = [p.name for p in root.iterdir() if p.is_dir()]
    if not runs:
        raise RuntimeError("No runs found in forecasts directory.")
    return sorted(runs)[-1]


def time_to_slug(t) -> str:
    ts = pd.to_datetime(t)
    return ts.strftime("%Y%m%dT%H%M%SZ")


# =========================
# MAIN
# =========================

def main():
    cfg = CFG

    if not cfg.forecasts_root.exists():
        raise RuntimeError(f"Forecast root not found: {cfg.forecasts_root}")

    # Определяем RUN_TIME
    if cfg.run_time_slug is None:
        run_time = find_latest_run(cfg.forecasts_root)
    else:
        run_time = cfg.run_time_slug

    zarr_path = cfg.forecasts_root / run_time / "data.zarr"

    if not zarr_path.exists():
        raise RuntimeError(f"Zarr not found: {zarr_path}")

    print(f"Using run: {run_time}")
    print(f"Opening: {zarr_path}")

    ds = xr.open_zarr(zarr_path)

    if "time" not in ds.coords:
        raise RuntimeError("Dataset has no 'time' coordinate.")

    times: List[str] = [time_to_slug(t) for t in ds["time"].values]

    if not times:
        raise RuntimeError("No time steps found in dataset.")

    # Проверка переменных
    for v in cfg.variables:
        if v["id"] not in ds.data_vars:
            raise RuntimeError(
                f"Variable '{v['id']}' not found in dataset. "
                f"Available: {list(ds.data_vars)}"
            )

    # Формирование catalog.json
    catalog: Dict[str, Any] = {
        "model": cfg.model_name,
        "run_time": run_time,
        "times": times,
        "variables": []
    }

    for v in cfg.variables:
        catalog["variables"].append({
            "id": v["id"],
            "name": v["name"],
            "unit": v["unit"],
            "min": v["min"],
            "max": v["max"],
            "times": times,
            "tileTemplate": f"/tiles/{cfg.model_name}/{v['id']}" + "/{time}/{z}/{x}/{y}.png"
        })

    # Сохраняем
    cfg.output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(cfg.output_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    print("Catalog written to:", cfg.output_path)
    print("Times:", len(times))
    print("Variables:", [v["id"] for v in catalog["variables"]])


if __name__ == "__main__":
    main()
