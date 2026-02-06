import './style.css';
import {Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import {Feature} from 'ol';
import {Point, Polygon} from 'ol/geom';
import {Style, Icon, Stroke, Fill} from 'ol/style';
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
    center: fromLonLat([37.6173, 55.7558]),
    zoom: 10
  })
});

// Переменные для маркера
let markerSource = new VectorSource();
let markerLayer = new VectorLayer({
  source: markerSource
});
map.addLayer(markerLayer);

// Переменная для квадрата с погодными данными
let weatherSquareSource = new VectorSource();
let weatherSquareLayer = new VectorLayer({
  source: weatherSquareSource
});
map.addLayer(weatherSquareLayer);

// Стили для квадрата
const normalStyle = new Style({
  stroke: new Stroke({
    color: '#666666',
    width: 2
  }),
  fill: new Fill({
    color: 'rgba(128, 128, 128, 0.3)'
  })
});

const hoverStyle = new Style({
  stroke: new Stroke({
    color: '#888888',
    width: 3
  }),
  fill: new Fill({
    color: 'rgba(180, 180, 180, 0.5)'
  })
});

// Переменная для хранения координат
let selectedCoordinates = null;
// Переменная для хранения текущих погодных данных
let currentWeatherData = null;
// Переменная для хранения текущего выделенного квадрата
let hoveredSquare = null;

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

// Создаем элемент для графика погоды (всплывающее окно)
const weatherChartContainer = document.createElement('div');
weatherChartContainer.id = 'weather-chart-container';
weatherChartContainer.style.cssText = `
  display: none;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  max-width: 1200px;
  height: 80vh;
  background: rgba(0, 0, 0, 0.95);
  border: 3px solid #4CAF50;
  border-radius: 15px;
  z-index: 10000;
  padding: 25px;
  box-shadow: 0 10px 50px rgba(0,0,0,0.5);
  overflow: hidden;
`;

const weatherChartHeader = document.createElement('div');
weatherChartHeader.style.cssText = `
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  color: white;
  font-family: Arial, sans-serif;
`;

const weatherChartTitle = document.createElement('h2');
weatherChartTitle.style.cssText = `
  margin: 0;
  color: #90ee90;
  font-size: 24px;
`;

const closeChartButton = document.createElement('button');
closeChartButton.textContent = '✕';
closeChartButton.style.cssText = `
  background: #f44336;
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  transition: background 0.3s;
`;
closeChartButton.addEventListener('mouseenter', () => {
  closeChartButton.style.background = '#ff6b6b';
});
closeChartButton.addEventListener('mouseleave', () => {
  closeChartButton.style.background = '#f44336';
});

const weatherChartContent = document.createElement('div');
weatherChartContent.style.cssText = `
  height: calc(100% - 80px);
  position: relative;
  display: flex;
  flex-direction: column;
`;

const chartParamButtonsContainer = document.createElement('div');
chartParamButtonsContainer.id = 'chart-param-buttons';
chartParamButtonsContainer.style.cssText = `
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  flex-wrap: wrap;
  min-height: 40px;
`;

const weatherChartCanvasContainer = document.createElement('div');
weatherChartCanvasContainer.style.cssText = `
  flex: 1;
  position: relative;
  min-height: 400px;
`;

const weatherChartCanvas = document.createElement('canvas');
weatherChartCanvas.id = 'weather-chart';
weatherChartCanvas.style.cssText = `
  width: 100% !important;
  height: 100% !important;
`;

weatherChartHeader.appendChild(weatherChartTitle);
weatherChartHeader.appendChild(closeChartButton);
weatherChartCanvasContainer.appendChild(weatherChartCanvas);
weatherChartContent.appendChild(chartParamButtonsContainer);
weatherChartContent.appendChild(weatherChartCanvasContainer);
weatherChartContainer.appendChild(weatherChartHeader);
weatherChartContainer.appendChild(weatherChartContent);
document.body.appendChild(weatherChartContainer);

// Переменные для графика
let weatherChart = null;
let currentChartParam = null;

// Функция для закрытия графика
closeChartButton.addEventListener('click', () => {
  weatherChartContainer.style.display = 'none';
  if (weatherChart) {
    weatherChart.destroy();
    weatherChart = null;
  }
  currentChartParam = null;
});

// Функция для преобразования данных из нового формата в старый (для графиков)
function transformWeatherData(newFormatData) {
  if (!newFormatData) return {};
  
  const transformedData = {};
  
  // Проходим по всем параметрам в новых данных
  Object.keys(newFormatData).forEach(param => {
    const paramData = newFormatData[param];
    
    if (!transformedData[param]) {
      transformedData[param] = [];
    }
    
    // Проходим по всем часам для этого параметра
    Object.keys(paramData).forEach(hourStr => {
      const hour = parseInt(hourStr);
      const hourData = paramData[hourStr];
      
      // Добавляем поле hour для совместимости со старым форматом
      transformedData[param].push({
        ...hourData,
        hour: hour
      });
    });
    
    // Сортируем по часам для правильного порядка
    transformedData[param].sort((a, b) => a.hour - b.hour);
  });
  
  return transformedData;
}

// Обработчик наведения на карту для выделения квадрата
map.on('pointermove', function(event) {
  const pixel = event.pixel;
  const feature = map.forEachFeatureAtPixel(pixel, function(feature) {
    if (feature && feature.get('weatherData')) {
      return feature;
    }
    return null;
  });
  
  if (feature) {
    // Если нашли квадрат под курсором
    map.getTarget().style.cursor = 'pointer';
    
    // Убираем выделение с предыдущего квадрата
    if (hoveredSquare && hoveredSquare !== feature) {
      hoveredSquare.setStyle(normalStyle);
    }
    
    // Выделяем текущий квадрат
    feature.setStyle(hoverStyle);
    hoveredSquare = feature;
  } else {
    // Если курсор не над квадратом
    map.getTarget().style.cursor = '';
    
    // Снимаем выделение
    if (hoveredSquare) {
      hoveredSquare.setStyle(normalStyle);
      hoveredSquare = null;
    }
  }
});

// Обработчик клика на квадрат для отображения графика
map.on('singleclick', function(event) {
  const pixel = event.pixel;
  const feature = map.forEachFeatureAtPixel(pixel, function(feature) {
    if (feature && feature.get('weatherData')) {
      return feature;
    }
    return null;
  });
  
  if (feature && feature.get('weatherData')) {
    // Преобразуем данные из нового формата в старый для графиков
    const newFormatData = feature.get('weatherData');
    const transformedData = transformWeatherData(newFormatData);
    showWeatherChart(transformedData);
  }
});

// Добавляем обработчик клика на карту для установки маркера
map.on('click', function(event) {
  const coordinates = event.coordinate;
  const lonLat = toLonLat(coordinates);
  
  // Сохраняем координаты в градусах
  selectedCoordinates = {
    lon: parseFloat(lonLat[0].toFixed(6)),
    lat: parseFloat(lonLat[1].toFixed(6))
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
    Широта: ${selectedCoordinates.lat.toFixed(6)}<br>
    Долгота: ${selectedCoordinates.lon.toFixed(6)}<br>
    <small>Кликните на карту чтобы изменить</small>
  `;
  coordinateInfo.style.display = 'block';
  
  console.log('Координаты маркера установлены:', selectedCoordinates);
});

// Функция для создания квадрата с погодными данными
function createWeatherSquare(coordinates, weatherData) {
  // Очищаем предыдущий квадрат
  weatherSquareSource.clear();
  hoveredSquare = null;
  
  if (!coordinates) {
    console.warn('Координаты не указаны для создания квадрата');
    return;
  }
  
  // Сохраняем данные для графика
  currentWeatherData = weatherData;
  
  // Размер квадрата в градусах для площади ~50 км²
  const squareSize = 0.07;
  
  // Создаем координаты квадрата
  const lon = coordinates.lon;
  const lat = coordinates.lat;
  
  const squareCoordinates = [
    [
      [lon - squareSize, lat - squareSize],
      [lon - squareSize, lat + squareSize],
      [lon + squareSize, lat + squareSize],
      [lon + squareSize, lat - squareSize],
      [lon - squareSize, lat - squareSize]
    ]
  ];
  
  // Преобразуем координаты в систему карты
  const transformedCoords = squareCoordinates[0].map(coord => 
    fromLonLat(coord)
  );
  
  // Создаем полигон (квадрат)
  const square = new Feature({
    geometry: new Polygon([transformedCoords]),
    weatherData: weatherData,  // Сохраняем данные в новом формате
    center: fromLonLat([lon, lat])
  });
  
  // Устанавливаем начальный стиль
  square.setStyle(normalStyle);
  
  // Добавляем квадрат на слой
  weatherSquareSource.addFeature(square);
  
  console.log('Квадрат с прогнозом погоды создан:', coordinates);
}

// Функция для отображения графика погоды
function showWeatherChart(weatherData) {
  if (!weatherData || Object.keys(weatherData).length === 0) {
    console.warn('Нет данных для отображения графика');
    return;
  }
  
  // Очищаем предыдущий график
  if (weatherChart) {
    weatherChart.destroy();
    weatherChart = null;
  }
  
  // Очищаем кнопки параметров
  chartParamButtonsContainer.innerHTML = '';
  
  // Создаем кнопки для каждого параметра
  const params = Object.keys(weatherData);
  console.log('Доступные параметры для графиков:', params);
  
  params.forEach((param, index) => {
    const button = document.createElement('button');
    button.textContent = getParamName(param);
    button.dataset.param = param;
    button.className = 'chart-param-btn';
    button.style.cssText = `
      padding: 8px 16px;
      background: ${index === 0 ? '#4CAF50' : '#555'};
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      font-size: 14px;
      transition: background 0.3s;
    `;
    
    // Добавляем обработчик клика
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      
      console.log('Клик по кнопке параметра:', param);
      
      // Сбрасываем все кнопки
      document.querySelectorAll('.chart-param-btn').forEach(btn => {
        btn.style.background = '#555';
      });
      
      // Активируем текущую кнопку
      button.style.background = '#4CAF50';
      
      // Обновляем график
      updateWeatherChart(param, weatherData[param]);
      currentChartParam = param;
    });
    
    chartParamButtonsContainer.appendChild(button);
  });
  
  // Устанавливаем заголовок
  weatherChartTitle.textContent = '📈 Прогноз погоды на 48 часов';
  
  // Показываем контейнер
  weatherChartContainer.style.display = 'block';
  
  // Отображаем график для первого параметра
  if (params.length > 0) {
    const firstParam = params[0];
    updateWeatherChart(firstParam, weatherData[firstParam]);
    currentChartParam = firstParam;
  }
}

// Функция для обновления графика
function updateWeatherChart(param, hourlyData) {
  if (!hourlyData || hourlyData.length === 0) {
    console.warn('Нет данных для графика:', param);
    return;
  }
  
  console.log('Обновление графика для параметра:', param, 'данные:', hourlyData.length, 'точек');
  
  const ctx = document.getElementById('weather-chart').getContext('2d');
  
  // Создаем метки времени от текущего момента
  const now = new Date();
  const labels = [];
  
  for (let i = 0; i < hourlyData.length; i++) {
    const forecastTime = new Date(now.getTime() + i * 60 * 60 * 1000);
    const day = forecastTime.getDate();
    const month = forecastTime.getMonth() + 1;
    const hours = forecastTime.getHours().toString().padStart(2, '0');
    
    // Формат: "День.Месяс Час:00" - показываем только каждый 6-й час для читаемости
    if (i % 6 === 0 || i === 0 || i === hourlyData.length - 1) {
      labels.push(`${day}.${month} ${hours}:00`);
    } else {
      labels.push(`${hours}:00`);
    }
  }
  
  // Подготавливаем данные для графика
  const datasets = [];
  
  // В зависимости от параметра создаем наборы данных
  if (param === 'wind') {
    datasets.push({
      label: 'Скорость ветра (м/с)',
      data: hourlyData.map(d => d.speed),
      borderColor: '#4CAF50',
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      borderWidth: 3,
      fill: false,
      tension: 0.4
    });
  } 
  else if (param === 'temperature') {
    datasets.push({
      label: 'Температура (°C)',
      data: hourlyData.map(d => d.current),
      borderColor: '#FF5252',
      backgroundColor: 'rgba(255, 82, 82, 0.1)',
      borderWidth: 3,
      fill: false,
      tension: 0.4
    });
  }
  else if (param === 'humidity') {
    datasets.push({
      label: 'Влажность (%)',
      data: hourlyData.map(d => d.percentage),
      borderColor: '#2196F3',
      backgroundColor: 'rgba(33, 150, 243, 0.1)',
      borderWidth: 3,
      fill: false,
      tension: 0.4
    });
  }
  else if (param === 'pressure') {
    datasets.push({
      label: 'Давление (гПа)',
      data: hourlyData.map(d => d.hpa),
      borderColor: '#9C27B0',
      backgroundColor: 'rgba(156, 39, 176, 0.1)',
      borderWidth: 3,
      fill: false,
      tension: 0.4
    });
  }
  else if (param === 'visibility') {
    datasets.push({
      label: 'Видимость (км)',
      data: hourlyData.map(d => d.km),
      borderColor: '#00BCD4',
      backgroundColor: 'rgba(0, 188, 212, 0.1)',
      borderWidth: 3,
      fill: false,
      tension: 0.4
    });
  }
  else if (param === 'precipitation') {
    datasets.push({
      label: 'Осадки (мм)',
      data: hourlyData.map(d => d.mm),
      borderColor: '#3F51B5',
      backgroundColor: 'rgba(63, 81, 181, 0.1)',
      borderWidth: 3,
      fill: false,
      tension: 0.4
    });
  }
  
  // Уничтожаем старый график если есть
  if (weatherChart) {
    weatherChart.destroy();
  }
  
  // Создаем график с правильными настройками для отображения времени
  weatherChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: getParamName(param),
          font: {
            size: 20
          },
          color: '#90ee90',
          padding: 20
        },
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: 'white',
            font: {
              size: 14
            },
            padding: 15
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#90ee90',
          bodyColor: 'white',
          borderColor: '#4CAF50',
          borderWidth: 1,
          padding: 12,
          titleFont: {
            size: 14
          },
          bodyFont: {
            size: 13
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Время (часы)',
            color: '#ccc',
            font: {
              size: 14,
              weight: 'bold'
            },
            padding: {top: 10, bottom: 10}
          },
          ticks: {
            color: '#ccc',
            maxTicksLimit: 16,
            font: {
              size: 12
            },
            maxRotation: 45,
            minRotation: 45,
            autoSkip: true,
            autoSkipPadding: 20,
            callback: function(value, index) {
              // Показываем только каждую 4-ю метку для лучшей читаемости
              if (index % 4 === 0) {
                return labels[index];
              }
              return '';
            }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: true,
            borderColor: 'rgba(255, 255, 255, 0.2)'
          }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: getYAxisLabel(param),
            color: '#ccc',
            font: {
              size: 14,
              weight: 'bold'
            },
            padding: {top: 10, bottom: 10}
          },
          ticks: {
            color: '#ccc',
            font: {
              size: 12
            },
            padding: 10
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: true,
            borderColor: 'rgba(255, 255, 255, 0.2)'
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'nearest'
      },
      animation: {
        duration: 800,
        easing: 'easeOutQuart'
      },
      elements: {
        point: {
          radius: 4,
          hoverRadius: 8,
          backgroundColor: 'rgba(255, 255, 255, 0.8)'
        }
      }
    }
  });
  
  console.log('График успешно обновлен для параметра:', param);
}

// Вспомогательные функции для форматирования
function getParamName(param) {
  const names = {
    'wind': '🌬️ Ветер',
    'temperature': '🌡️ Температура',
    'humidity': '💧 Влажность',
    'pressure': '📊 Давление',
    'visibility': '👁️ Видимость',
    'precipitation': '🌧️ Осадки'
  };
  return names[param] || param;
}

function getYAxisLabel(param) {
  const labels = {
    'wind': 'Скорость (м/с)',
    'temperature': 'Температура (°C)',
    'humidity': 'Влажность (%)',
    'pressure': 'Давление (гПа)',
    'visibility': 'Видимость (км)',
    'precipitation': 'Осадки (мм)'
  };
  return labels[param] || 'Значение';
}

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
    
    console.log('✅ Данные успешно отправлены на сервер:', response.data);
    
    // Простое уведомление
    showNotification("Данные успешно отправлены на обработку", 'success');
    
    // Если есть координаты и прогноз погоды, создаем квадрат
    if (coordinates && response.data.weather_forecast) {
      createWeatherSquare(coordinates, response.data.weather_forecast);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка при отправке данных:', error);
    
    let errorMessage = 'Не удалось отправить данные на сервер';
    if (error.response) {
      errorMessage = `Ошибка сервера: ${error.response.status}`;
    } else if (error.request) {
      errorMessage = 'Сервер не отвечает';
    }
    
    showNotification(`❌ ${errorMessage}`, 'error');
    throw error;
  }
}

// Функция для показа уведомлений
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    color: white;
    border-radius: 5px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    max-width: 400px;
    text-align: center;
    font-family: Arial, sans-serif;
    font-size: 16px;
  `;
  notification.innerHTML = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 500);
  }, 3000);
}

// Функция для проверки доступности сервера
async function checkServerConnection() {
  try {
    const response = await axios.get(`${SERVER_URL}/`);
    console.log('✅ Сервер доступен:', response.data);
    return true;
  } catch (error) {
    console.warn('⚠️ Сервер недоступен');
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
          showNotification('⚠️ Сервер недоступен', 'error');
        }
        
        // Отправляем данные на сервер
        const result = await sendWeatherData(currentSelections, selectedCoordinates);
        
        // Зеленый цвет при успехе
        calculateButton.style.backgroundColor = '#4CAF50';
        calculateButton.textContent = '✅ Успешно!';
        
        setTimeout(() => {
          calculateButton.textContent = originalText;
          calculateButton.disabled = false;
          calculateButton.style.backgroundColor = '';
        }, 2000);
        
      } catch (error) {
        calculateButton.style.backgroundColor = '#f44336';
        calculateButton.textContent = '❌ Ошибка';
        
        setTimeout(() => {
          calculateButton.textContent = originalText;
          calculateButton.disabled = false;
          calculateButton.style.backgroundColor = '';
        }, 2000);
      }
    });
  }
  
  checkServerConnection();
});