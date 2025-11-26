"""API версия 1"""
from fastapi import APIRouter

from app.api.v1 import admin as admin_router
from app.api.v1 import auth as auth_router
from app.api.v1 import users as users_router
from app.api.v1 import lectures as lectures_router
from app.api.v1 import tests as tests_router

api_router = APIRouter()

api_router.include_router(auth_router.router, tags=["auth"])
api_router.include_router(users_router.router, tags=["users"])
api_router.include_router(admin_router.router, tags=["admin"])
api_router.include_router(lectures_router.router, tags=["lectures"])
api_router.include_router(tests_router.router, prefix="/tests", tags=["tests"])
