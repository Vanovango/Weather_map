from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import datetime
import random
import json

app = FastAPI()

# Модель для получения данных с фронта
class WeatherRequest(BaseModel):
    params: List[str]
    timestamp: str
    coordinates: Optional[dict] = None

origins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174'
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Генератор рандомных погодных данных на 2 дня вперед в новом формате
def generate_weather_forecast(params: List[str]) -> Dict:
    """Генерирует прогноз погоды на 2 дня вперед с разбивкой по часам в новом формате"""
    hours = 48
    forecast_data = {}
    
    # Инициализируем структуру данных для каждого параметра
    for param in params:
        forecast_data[param] = {}
    
    # Генерируем данные для каждого часа
    for hour_num in range(hours):
        hour_str = str(hour_num)
        
        # Генерация данных для каждого параметра, если он выбран
        if 'wind' in params:
            speed = max(0, random.uniform(0, 15) + random.uniform(-3, 3))
            direction = random.randint(0, 360)
            gust = max(0, speed + random.uniform(0, 5))
            
            forecast_data['wind'][hour_str] = {
                'speed': round(speed, 1),
                'direction': direction,
                'gust': round(gust, 1)
            }
                
        if 'temperature' in params:
            base_temp = random.uniform(-10, 30)
            time_of_day = hour_num % 24
            daily_variation = -10 * ((time_of_day - 12) / 12) ** 2 + 10
            temp = base_temp + daily_variation + random.uniform(-2, 2)
            feels_like = temp + random.uniform(-3, 3)
            
            forecast_data['temperature'][hour_str] = {
                'current': round(temp, 1),
                'feels_like': round(feels_like, 1),
                'min': round(temp - random.uniform(0, 5), 1),
                'max': round(temp + random.uniform(0, 5), 1)
            }
                
        if 'humidity' in params:
            humidity = max(0, min(100, random.randint(30, 90) + random.randint(-20, 20)))
            dew_point = random.uniform(-5, 25)
            
            forecast_data['humidity'][hour_str] = {
                'percentage': humidity,
                'dew_point': round(dew_point, 1)
            }
                
        if 'pressure' in params:
            pressure = random.randint(980, 1030) + random.randint(-5, 5)
            trend_options = ['rising', 'falling', 'stable']
            
            forecast_data['pressure'][hour_str] = {
                'hpa': pressure,
                'trend': random.choice(trend_options)
            }
                
        if 'visibility' in params:
            visibility = max(0.1, random.uniform(1, 15) + random.uniform(-2, 2))
            condition_options = ['clear', 'foggy', 'hazy', 'misty']
            
            forecast_data['visibility'][hour_str] = {
                'km': round(visibility, 1),
                'condition': random.choice(condition_options)
            }
                
        if 'precipitation' in params:
            precipitation = max(0, random.uniform(0, 5) + random.uniform(-1, 1))
            precipitation_types = ['rain', 'snow', 'sleet', 'hail', 'none']
            precip_type = random.choice(precipitation_types)
            probability = random.randint(0, 100) if precip_type != 'none' else 0
            
            forecast_data['precipitation'][hour_str] = {
                'mm': round(precipitation, 1),
                'type': precip_type,
                'probability': probability
            }
    
    return forecast_data

# Хранилище для последних запросов
last_requests = []

@app.get("/")
async def root():
    return {
        "message": "Weather API Server is running",
        "last_requests": last_requests[-5:] if last_requests else []
    }

@app.post("/weather/")
async def get_weather(weather_request: WeatherRequest):
    """Эндпоинт для получения данных о погодных параметрах"""
    
    # Логируем полученные данные
    print("=" * 60)
    print(f"[{datetime.datetime.now()}] Получены параметры погоды:")
    print(f"Параметры: {weather_request.params}")
    
    if weather_request.coordinates:
        print(f"Координаты: {weather_request.coordinates}")
    else:
        print("Координаты: не указаны")
    print("=" * 60)
    
    # Генерируем прогноз погоды на 2 дня в новом формате
    weather_forecast = generate_weather_forecast(weather_request.params)
    
    # Сохраняем запрос для истории
    request_data = {
        "timestamp": datetime.datetime.now().isoformat(),
        "params": weather_request.params,
        "coordinates": weather_request.coordinates,
        "weather_forecast": weather_forecast,
        "client_timestamp": weather_request.timestamp
    }
    last_requests.append(request_data)
    
    # Ограничиваем историю 100 последними запросами
    if len(last_requests) > 100:
        last_requests.pop(0)
    
    # Возвращаем ответ с прогнозом в новом формате
    response_data = {
        "status": "success",
        "message": "Прогноз погоды на 2 дня сгенерирован",
        "received_params": weather_request.params,
        "weather_forecast": weather_forecast,
        "server_time": datetime.datetime.now().isoformat(),
        "request_id": len(last_requests)
    }
    
    if weather_request.coordinates:
        response_data["coordinates"] = weather_request.coordinates
    
    return response_data

@app.get("/debug/")
async def get_debug_info():
    return {
        "total_requests": len(last_requests),
        "requests": last_requests
    }