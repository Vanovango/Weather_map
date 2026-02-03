const map = L.map('map').setView([55.75, 37.61], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

let marker = null;

map.on('click', function (e) {
    if (marker) {
        marker.remove();
    }
    marker = L.marker(e.latlng).addTo(map);
});

document.getElementById("getForecast").onclick = async () => {
    if (!marker) {
        alert("Выберите точку на карте");
        return;
    }

    const parameters = Array.from(
        document.querySelectorAll("input[type=checkbox]:checked")
    ).map(cb => cb.value);

    const response = await fetch("/api/forecast", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            lat: marker.getLatLng().lat,
            lon: marker.getLatLng().lng,
            parameters: parameters
        })
    });

    const data = await response.json();
    document.getElementById("output").textContent =
        JSON.stringify(data, null, 2);
};
