"""
Database Models for Trip Coordinator App
Uses SQLModel (combines SQLAlchemy + Pydantic)
"""

from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
import json


# ============================================================================
# DATABASE MODELS
# ============================================================================

class Trip(SQLModel, table=True):
    """Main trip entity"""
    id: str = Field(primary_key=True)  # e.g., "abc123"
    title: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    members: List["Member"] = Relationship(back_populates="trip")
    options: List["Option"] = Relationship(back_populates="trip")
    expenses: List["Expense"] = Relationship(back_populates="trip")
    itinerary_blocks: List["ItineraryBlock"] = Relationship(back_populates="trip")


class Member(SQLModel, table=True):
    """Trip participant"""
    id: Optional[int] = Field(default=None, primary_key=True)
    trip_id: str = Field(foreign_key="trip.id")
    name: str
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationship
    trip: Optional[Trip] = Relationship(back_populates="members")
    votes: List["Vote"] = Relationship(back_populates="member")


class Option(SQLModel, table=True):
    """Votable option (destination or date)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    trip_id: str = Field(foreign_key="trip.id")
    type: str  # "destination" or "date"
    label: str  # e.g., "Paris, France" or "June 15-20, 2025"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationship
    trip: Optional[Trip] = Relationship(back_populates="options")
    votes: List["Vote"] = Relationship(back_populates="option")


class Vote(SQLModel, table=True):
    """Individual vote on an option"""
    id: Optional[int] = Field(default=None, primary_key=True)
    member_id: int = Field(foreign_key="member.id")
    option_id: int = Field(foreign_key="option.id")
    weight: int = 1  # For future: weighted voting
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    member: Optional[Member] = Relationship(back_populates="votes")
    option: Optional[Option] = Relationship(back_populates="votes")


class Expense(SQLModel, table=True):
    """Group expense"""
    id: Optional[int] = Field(default=None, primary_key=True)
    trip_id: str = Field(foreign_key="trip.id")
    amount: float
    paid_by: str  # Member name
    split_between_json: str = Field(default="[]")  # JSON array of member names
    description: Optional[str] = None  # e.g., "Dinner at restaurant"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationship
    trip: Optional[Trip] = Relationship(back_populates="expenses")
    
    @property
    def split_between(self) -> List[str]:
        """Get split_between as a list"""
        return json.loads(self.split_between_json)
    
    @split_between.setter
    def split_between(self, value: List[str]):
        """Set split_between from a list"""
        self.split_between_json = json.dumps(value)


class ItineraryBlock(SQLModel, table=True):
    """Itinerary time block (morning/afternoon/evening)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    trip_id: str = Field(foreign_key="trip.id")
    day: int  # 1, 2, 3...
    slot: str  # "morning", "afternoon", "evening"
    text: str  # e.g., "Visit Louvre Museum"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationship
    trip: Optional[Trip] = Relationship(back_populates="itinerary_blocks")


# ============================================================================
# PYDANTIC MODELS (for API request/response)
# These are NOT database tables, just for validation
# ============================================================================

class TripCreate(SQLModel):
    """Request body for creating a trip"""
    title: str


class TripResponse(SQLModel):
    """Response when creating/getting a trip"""
    trip_id: str
    title: str
    invite_link: str
    created_at: datetime


class MemberCreate(SQLModel):
    """Request body for joining a trip"""
    name: str


class MemberResponse(SQLModel):
    """Response for member info"""
    id: int
    name: str
    joined_at: datetime


class OptionCreate(SQLModel):
    """Request body for creating a votable option"""
    type: str  # "destination" or "date"
    label: str


class VoteCreate(SQLModel):
    """Request body for casting a vote"""
    member_id: int
    option_id: int


class VoteResponse(SQLModel):
    """Response for vote tallying"""
    option_id: int
    option_label: str
    vote_count: int


class ExpenseCreate(SQLModel):
    """Request body for adding an expense"""
    amount: float
    paid_by: str
    split_between: List[str]
    description: Optional[str] = None


class ExpenseResponse(SQLModel):
    """Response for expense info"""
    id: int
    amount: float
    paid_by: str
    split_between: List[str]
    description: Optional[str]
    created_at: datetime


class TransferResponse(SQLModel):
    """Settlement transfer (from Person C's algorithm)"""
    from_person: str
    to_person: str
    amount: float


class SettlementResponse(SQLModel):
    """Complete settlement info"""
    trip_id: str
    transfers: List[TransferResponse]
    total_expenses: float
    summary: str


class ItineraryRequest(SQLModel):
    """Request body for generating itinerary"""
    destination: str
    avoid_crowds: bool = False


class PlaceRecommendation(SQLModel):
    """Single place recommendation"""
    name: str
    category: str
    crowd_score: float
    distance_km: float
    is_hidden_gem: bool


class ItineraryResponse(SQLModel):
    """Generated itinerary"""
    trip_id: str
    destination: str
    avoid_crowds_mode: bool
    days: dict  # {"day_1": {"morning": "...", "afternoon": "...", "evening": "..."}}
    recommendations: List[PlaceRecommendation]


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def expense_to_dict(expense: Expense) -> dict:
    """
    Convert Expense model to dict format for Person C's settlement algorithm
    
    Person C's algorithm expects:
    {
        'amount': float,
        'paid_by': str,
        'split_between': List[str]
    }
    """
    return {
        'amount': expense.amount,
        'paid_by': expense.paid_by,
        'split_between': expense.split_between
    }


def create_expense_from_dict(trip_id: str, expense_data: dict) -> Expense:
    """Create Expense model from dictionary"""
    expense = Expense(
        trip_id=trip_id,
        amount=expense_data['amount'],
        paid_by=expense_data['paid_by'],
        description=expense_data.get('description')
    )
    expense.split_between = expense_data['split_between']
    return expense
