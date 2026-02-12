from pathlib import Path

from earth2studio.models.px import FCN3
from earth2studio.data import GFS
from earth2studio.io import ZarrBackend
from earth2studio.run import deterministic as run

def main():
    run_time = "2026-02-05T06:00:00"  # Время старта прогноза (UTC).


    nsteps = 16  # 4 дня = 96 часов => 16 шаговм(*FCN3 делает шаг 6 часов.)

    out_dir = Path("storage/forecasts/fcn3") / run_time.replace(":", "").replace("-", "")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "data.zarr"

    model = FCN3.load_model(FCN3.load_default_package())  # Загружаем модель (нейронка)

    data = GFS()  # Источник начальных условий

    io = ZarrBackend(str(out_path))  # Вывод

    run([run_time], nsteps, model, data, io)
    print("Saved forecast to:", out_path)

if __name__ == "__main__":
    main()
