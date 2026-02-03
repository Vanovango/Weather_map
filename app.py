from flask import Flask, render_template, request, jsonify
from config import Config
from services.weather_ai import generate_forecast
from services.validators import validate_request

app = Flask(__name__)
app.config.from_object(Config)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/forecast", methods=["POST"])
def forecast():
    data = request.get_json()

    try:
        validate_request(data)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    forecast_data = generate_forecast(
        lat=data["lat"],
        lon=data["lon"],
        parameters=data["parameters"]
    )

    return jsonify(forecast_data)


if __name__ == "__main__":
    app.run()
