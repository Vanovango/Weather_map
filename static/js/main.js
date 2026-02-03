// =======================================
// MapLibre + OpenStreetMap (Vector)
// + Physical Terrain (DEM)
// =======================================

const map = new maplibregl.Map({
    container: 'map',

    // Векторный стиль на базе OpenStreetMap
    style: 'https://demotiles.maplibre.org/style.json',

    center: [37.61, 55.75], // Москва
    zoom: 11,
    pitch: 60,      // наклон камеры
    bearing: -10,   // поворот, как в навигаторе
    maxZoom: 20
});

// Навигация
map.addControl(new maplibregl.NavigationControl());

// =======================================
// Terrain + Hillshade
// =======================================

map.on('load', () => {

    // ---------- Источник высот ----------
    map.addSource('terrain-dem', {
        type: 'raster-dem',
        tiles: [
            'https://demotiles.maplibre.org/terrain-rgb/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        maxzoom: 14
    });

    // ---------- Включаем физический рельеф ----------
    map.setTerrain({
        source: 'terrain-dem',
        exaggeration: 1.5 // усиление высот
    });

    // ---------- Тени рельефа ----------
    map.addLayer({
        id: 'terrain-hillshade',
        type: 'hillshade',
        source: 'terrain-dem',
        paint: {
            'hillshade-exaggeration': 0.6,
            'hillshade-shadow-color': '#473B24'
        }
    });
});

// =======================================
// Инструменты выбора
// =======================================

let currentTool = "point";
let pointMarker = null;
let areaPoints = [];

// Кнопки
document.getElementById("toolPoint").onclick = () => {
    currentTool = "point";
    resetArea();
};

document.getElementById("toolArea").onclick = () => {
    currentTool = "area";
    resetPoint();
};

// =======================================
// Вспомогательные функции
// =======================================

function resetPoint() {
    if (pointMarker) {
        pointMarker.remove();
        pointMarker = null;
    }
}

function resetArea() {
    areaPoints = [];
    removeLayer("area-fill");
    removeLayer("area-line");

    if (map.getSource("area")) {
        map.removeSource("area");
    }
}

function removeLayer(id) {
    if (map.getLayer(id)) {
        map.removeLayer(id);
    }
}

// =======================================
// Клики по карте
// =======================================

map.on("click", (e) => {

    const lngLat = [e.lngLat.lng, e.lngLat.lat];

    // ---------- Точка ----------
    if (currentTool === "point") {
        resetArea();

        if (pointMarker) {
            pointMarker.remove();
        }

        pointMarker = new maplibregl.Marker({ color: "red" })
            .setLngLat(lngLat)
            .addTo(map);
    }

    // ---------- Область ----------
    if (currentTool === "area") {
        areaPoints.push(lngLat);
        drawPolygon(areaPoints);
    }
});

// =======================================
// Отрисовка области
// =======================================

function drawPolygon(points) {

    if (points.length < 3) return;

    const geojson = {
        type: "Feature",
        geometry: {
            type: "Polygon",
            coordinates: [[...points, points[0]]]
        }
    };

    if (map.getSource("area")) {
        map.getSource("area").setData(geojson);
        return;
    }

    map.addSource("area", {
        type: "geojson",
        data: geojson
    });

    map.addLayer({
        id: "area-fill",
        type: "fill",
        source: "area",
        paint: {
            "fill-color": "#007bff",
            "fill-opacity": 0.25
        }
    });

    map.addLayer({
        id: "area-line",
        type: "line",
        source: "area",
        paint: {
            "line-color": "#0056b3",
            "line-width": 2
        }
    });
}

// =======================================
// Получение прогноза (заглушка)
// =======================================

document.getElementById("getForecast").onclick = async () => {

    alert("Запрос отправлен на обработку");

    let lat, lon;

    if (currentTool === "point" && pointMarker) {
        const p = pointMarker.getLngLat();
        lat = p.lat;
        lon = p.lng;

    } else if (currentTool === "area" && areaPoints.length > 0) {
        lat = areaPoints.reduce((s, p) => s + p[1], 0) / areaPoints.length;
        lon = areaPoints.reduce((s, p) => s + p[0], 0) / areaPoints.length;

    } else {
        alert("Выберите точку или область");
        return;
    }

    const parameters = Array.from(
        document.querySelectorAll("input[type=checkbox]:checked")
    ).map(cb => cb.value);

    if (!parameters.length) {
        alert("Выберите параметры погоды");
        return;
    }

    try {
        const response = await fetch("/api/forecast", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lon, parameters })
        });

        const data = await response.json();
        document.getElementById("output").textContent =
            JSON.stringify(data, null, 2);

    } catch (err) {
        console.error(err);
        alert("Ошибка при получении данных");
    }
};
