from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import datetime

app = FastAPI()

# Модель для получения данных с фронта
class WeatherRequest(BaseModel):
    params: List[str]
    timestamp: str
    coordinates: Optional[dict] = None  # Добавляем координаты

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

# Хранилище для последних запросов (для отладки)
last_requests = []

@app.get("/")
async def root():
    """Главная страница для проверки работы сервера"""
    return {
        "message": "Weather API Server is running",
        "last_requests": last_requests[-5:] if last_requests else []
    }

@app.post("/api/weather/")
async def get_weather(weather_request: WeatherRequest):
    """Эндпоинт для получения данных о погодных параметрах"""
    
    # Логируем полученные данные
    print("=" * 60)
    print(f"[{datetime.datetime.now()}] Получены параметры погоды:")
    print(f"Параметры: {weather_request.params}")
    
    if weather_request.coordinates:
        print(f"Координаты: {weather_request.coordinates}")
        print(f"Широта: {weather_request.coordinates.get('lat')}")
        print(f"Долгота: {weather_request.coordinates.get('lon')}")
    else:
        print("Координаты: не указаны")
        
    print(f"Время: {weather_request.timestamp}")
    print("=" * 60)
    
    # Сохраняем запрос для истории
    request_data = {
        "timestamp": datetime.datetime.now().isoformat(),
        "params": weather_request.params,
        "coordinates": weather_request.coordinates,
        "client_timestamp": weather_request.timestamp
    }
    last_requests.append(request_data)
    
    # Ограничиваем историю 100 последними запросами
    if len(last_requests) > 100:
        last_requests.pop(0)
    
    # Возвращаем ответ
    response_data = {
        "status": "success",
        "message": "Параметры успешно получены",
        "received_params": weather_request.params,
        "server_time": datetime.datetime.now().isoformat(),
        "total_requests": len(last_requests)
    }
    
    if weather_request.coordinates:
        response_data["coordinates"] = weather_request.coordinates
    
    return response_data

@app.get("/api/debug/")
async def get_debug_info():
    """Эндпоинт для отладки - показывает историю запросов"""
    return {
        "total_requests": len(last_requests),
        "requests": last_requests
    }