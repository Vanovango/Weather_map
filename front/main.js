import './style.css';
import {Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';

const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({
      source: new OSM()
    })
  ],
  view: new View({
    center: [0, 0],
    zoom: 2
  })
});

// Обработчик изменения выбранных параметров погоды
window.addEventListener('weatherParamsChanged', function(event) {
  const selections = event.detail.selections;
  // console.log('Обновление карты с параметрами:', selections);
  
  // Здесь можно добавить логику обновления карты
  // в зависимости от выбранных параметров
  
  // Пример: изменение цвета фона карты в зависимости от количества выбранных параметров
  // const mapDiv = document.getElementById('map');
  // if (selections.length > 0) {
  //   mapDiv.style.border = '2px solid #4CAF50';
  // } else {
  //   mapDiv.style.border = 'none';
  // }
});

// Загружаем начальные параметры при загрузке
document.addEventListener('DOMContentLoaded', function() {
  const savedSelections = JSON.parse(localStorage.getItem('weatherSelections')) || [];
  console.log('Текущие выбранные параметры при загрузке:', savedSelections);
});