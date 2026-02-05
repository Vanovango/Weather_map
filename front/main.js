import './style.css';
import {Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import {Feature} from 'ol';
import {Point} from 'ol/geom';
import {Style, Icon} from 'ol/style';
import {fromLonLat, toLonLat} from 'ol/proj';
import Overlay from 'ol/Overlay';
import axios from 'axios';

const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({
      source: new OSM()
    })
  ],
  view: new View({
    center: fromLonLat([37.6173, 55.7558]), // Москва по умолчанию
    zoom: 10
  })
});

// Переменные для маркера
let markerSource = new VectorSource();
let markerLayer = new VectorLayer({
  source: markerSource
});
map.addLayer(markerLayer);

// Переменная для хранения координат
let selectedCoordinates = null;

// Создаем элемент для отображения координат
const coordinateInfo = document.createElement('div');
coordinateInfo.id = 'coordinate-info';
coordinateInfo.style.cssText = `
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 5px;
  font-size: 14px;
  z-index: 1000;
  max-width: 250px;
  display: none;
`;
document.getElementById('map').appendChild(coordinateInfo);

// Добавляем обработчик клика на карту для установки маркера
map.on('click', function(event) {
  const coordinates = event.coordinate;
  const lonLat = toLonLat(coordinates);
  
  // Сохраняем координаты в градусах
  selectedCoordinates = {
    lon: lonLat[0].toFixed(6),
    lat: lonLat[1].toFixed(6)
  };
  
  // Создаем маркер
  const marker = new Feature({
    geometry: new Point(coordinates)
  });
  
  // Стиль маркера
  marker.setStyle(new Style({
    image: new Icon({
      src: 'https://cdn.mapmarker.io/api/v1/font-awesome/v5/pin?icon=fa-map-marker&size=50&color=FF0000',
      scale: 0.5,
      anchor: [0.5, 1]
    })
  }));
  
  // Очищаем предыдущий маркер и добавляем новый
  markerSource.clear();
  markerSource.addFeature(marker);
  
  // Показываем информацию о координатах
  coordinateInfo.innerHTML = `
    <strong>📍 Выбранная точка:</strong><br>
    Широта: ${selectedCoordinates.lat}<br>
    Долгота: ${selectedCoordinates.lon}<br>
    <small>Кликните на карту чтобы изменить</small>
  `;
  coordinateInfo.style.display = 'block';
  
  console.log('Координаты маркера установлены:', selectedCoordinates);
});

// URL сервера
const SERVER_URL = 'http://localhost:8000';

// Функция для отправки данных на сервер
async function sendWeatherData(selections, coordinates) {
  try {
    const requestData = {
      params: selections,
      timestamp: new Date().toISOString()
    };
    
    // Добавляем координаты если они есть
    if (coordinates) {
      requestData.coordinates = coordinates;
    }
    
    const response = await axios.post(`${SERVER_URL}/weather/`, requestData);
    
    let successMessage = `✅ Данные отправлены!<br>Параметры: ${selections.join(', ')}`;
    if (coordinates) {
      successMessage += `<br>📍 Координаты: ${coordinates.lat}, ${coordinates.lon}`;
    }
    
    console.log('✅ Данные успешно отправлены на сервер:', response.data);
    showNotification(successMessage, 'success');
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка при отправке данных:', error);
    
    let errorMessage = 'Не удалось отправить данные на сервер';
    if (error.response) {
      errorMessage = `Ошибка сервера: ${error.response.status} - ${error.response.data?.message || 'Неизвестная ошибка'}`;
    } else if (error.request) {
      errorMessage = 'Сервер не отвечает. Убедитесь что сервер запущен на http://localhost:8000';
    }
    
    showNotification(`❌ ${errorMessage}`, 'error');
    throw error;
  }
}

// Функция для показа уведомлений
function showNotification(message, type = 'info') {
  // Создаем элемент уведомления
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 15px 20px;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    color: white;
    border-radius: 5px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    max-width: 500px;
    text-align: center;
  `;
  notification.innerHTML = message;
  
  document.body.appendChild(notification);
  
  // Автоматически скрываем через 5 секунд
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 500);
  }, 5000);
}

// Функция для проверки доступности сервера
async function checkServerConnection() {
  try {
    const response = await axios.get(`${SERVER_URL}/`);
    console.log('✅ Сервер доступен:', response.data);
    return true;
  } catch (error) {
    console.warn('⚠️ Сервер недоступен. Убедитесь что FastAPI сервер запущен');
    return false;
  }
}

// Обработчик изменения выбранных параметров погоды
window.addEventListener('weatherParamsChanged', function(event) {
  const selections = event.detail.selections;
  // Здесь можно добавить логику обновления карты
});

// Обработчик кнопки "Рассчитать погоду"
document.addEventListener('DOMContentLoaded', function() {
  const savedSelections = JSON.parse(localStorage.getItem('weatherSelections')) || [];
  console.log('Текущие выбранные параметры при загрузке:', savedSelections);
  
  // Находим кнопку "Рассчитать погоду"
  const calculateButton = document.querySelector('.get_weather');
  
  if (calculateButton) {
    calculateButton.addEventListener('click', async function() {
      // Получаем текущие выбранные параметры
      const currentSelections = JSON.parse(localStorage.getItem('weatherSelections')) || [];
      
      if (currentSelections.length === 0) {
        showNotification('⚠️ Пожалуйста, выберите хотя бы один параметр погоды', 'error');
        return;
      }
      
      console.log('Отправка параметров на сервер:', currentSelections);
      console.log('Выбранные координаты:', selectedCoordinates);
      
      // Визуальная обратная связь
      const originalText = calculateButton.textContent;
      calculateButton.textContent = '📡 Отправка...';
      calculateButton.disabled = true;
      calculateButton.style.backgroundColor = '#ffa500';
      
      try {
        // Проверяем соединение с сервером
        const isServerAvailable = await checkServerConnection();
        if (!isServerAvailable) {
          showNotification('⚠️ Сервер недоступен. Запустите сервер командой: uvicorn main:app --reload', 'error');
        }
        
        // Отправляем данные на сервер
        const result = await sendWeatherData(currentSelections, selectedCoordinates);
        
        // Зеленый цвет при успехе
        calculateButton.style.backgroundColor = '#4CAF50';
        calculateButton.textContent = '✅ Успешно!';
        
        // Через 2 секунды возвращаем обычный вид
        setTimeout(() => {
          calculateButton.textContent = originalText;
          calculateButton.disabled = false;
          calculateButton.style.backgroundColor = '';
        }, 2000);
        
      } catch (error) {
        // Красный цвет при ошибке
        calculateButton.style.backgroundColor = '#f44336';
        calculateButton.textContent = '❌ Ошибка';
        
        // Через 2 секунды возвращаем обычный вид
        setTimeout(() => {
          calculateButton.textContent = originalText;
          calculateButton.disabled = false;
          calculateButton.style.backgroundColor = '';
        }, 2000);
      }
    });
  }
  
  // Проверяем соединение с сервером при загрузке
  checkServerConnection();
});