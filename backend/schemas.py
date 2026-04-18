# backend/schemas.py — Pydantic models for request/response validation
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# --- Response wrapper ---
class APIResponse(BaseModel):
    success: bool
    data: Optional[dict | list] = None
    message: str = ""
    error: Optional[str] = None


# --- Restaurant ---
class RestaurantOut(BaseModel):
    restaurant_id: int
    name: str
    cuisines: str = ""
    location: str = ""
    rate: float = 0.0
    votes: int = 0
    approx_cost: int = 0
    online_order: int = 0
    book_table: int = 0
    rest_type: str = ""
    recommendation_score: Optional[float] = None
    predicted_rating: Optional[float] = None
    group_score: Optional[float] = None
    technique_used: Optional[str] = None
    alpha_used: Optional[float] = None
    similarity_score: Optional[float] = None


# --- Auth ---
class UserRegister(BaseModel):
    email: str
    password: str
    preferences: Optional[dict] = Field(default_factory=lambda: {
        "cuisines": [],
        "price_range": "₹₹",
        "area": ""
    })


class UserLogin(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    user_id: str
    email: str
    role: str = "user"
    preferences: dict = {}
    interaction_count: int = 0
    most_common_location: Optional[str] = None
    created_at: Optional[str] = None


# --- Interactions ---
class InteractionCreate(BaseModel):
    restaurant_id: int
    restaurant_name: str = ""
    action: str = "click"  # click, rate, visit, bookmark
    rating: Optional[float] = None
    location: str = ""


class InteractionOut(BaseModel):
    user_id: str
    restaurant_id: int
    restaurant_name: str
    action: str
    rating: Optional[float] = None
    location: str
    timestamp: str


# --- Preferences ---
class PreferencesUpdate(BaseModel):
    cuisines: Optional[List[str]] = None
    price_range: Optional[str] = None
    area: Optional[str] = None


# --- Admin ---
class AlphaUpdate(BaseModel):
    global_alpha: float = Field(ge=0.0, le=1.0)


class ABTestConfig(BaseModel):
    hybrid: int = Field(ge=0, le=100)
    cbf_only: int = Field(ge=0, le=100)


# --- Group ---
class GroupMember(BaseModel):
    user_id: Optional[str] = None
    cuisines: Optional[str] = None
    price_range: Optional[str] = None
    area: Optional[str] = None


class GroupRequest(BaseModel):
    members: List[GroupMember] = Field(min_length=2, max_length=4)
    top_n: int = 10
