from datetime import datetime, timedelta
import random


def generate_forecast(lat: float, lon: float, parameters: list[str]) -> list[dict]:
    forecast = []
    now = datetime.utcnow()

    for hour in range(0, 48, 3):
        entry = {
            "time": (now + timedelta(hours=hour)).isoformat()
        }

        if "temperature" in parameters:
            entry["temperature"] = round(random.uniform(-10, 30), 1)

        if "wind_speed" in parameters:
            entry["wind_speed"] = round(random.uniform(0, 15), 1)

        if "wind_direction" in parameters:
            entry["wind_direction"] = random.choice(
                ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
            )

        if "precipitation" in parameters:
            entry["precipitation"] = round(random.uniform(0, 10), 1)

        if "pressure" in parameters:
            entry["pressure"] = round(random.uniform(720, 780), 1)  # мм рт. ст.

        forecast.append(entry)

    return forecast
