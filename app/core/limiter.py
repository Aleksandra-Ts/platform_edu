"""Настройка rate limiting"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Создаем глобальный limiter
limiter = Limiter(key_func=get_remote_address)

