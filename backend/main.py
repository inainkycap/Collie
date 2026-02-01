from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, Dict, Literal, List
from collections import defaultdict

# Import Person C algorithms (optional)
try:
    from algorithm_person_c import SettlementCalculator, PlaceFetcher, CrowdAvoidanceScorer
    ALGORITHMS_AVAILABLE = True
except Exception:
    ALGORITHMS_AVAILABLE = False

app = FastAPI(title="Collie API")

# IMPORTANT:
# - allow_credentials must be False if allow_origins=["*"] (we don't use cookies)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Fix: handle browser preflight OPTIONS for any route
@app.options("/{path:path}")
def preflight(path: str):
    return Response(status_code=200)

# In-memory store
trips: Dict[str, dict] = {}

# Init place fetcher if available
place_fetcher = PlaceFetcher() if ALGORITHMS_AVAILABLE else None


# -------------------------
# Models
# -------------------------
class TripCreate(BaseModel):
    title: Optional[str] = "Weekend Trip"

class TripUpdate(BaseModel):
    title: str

class JoinTrip(BaseModel):
    name: Optional[str] = "Anonymous"

class Vote(BaseModel):
    type: Literal["destination", "dates"]
    option: str
    member_id: str

class ExpenseCreate(BaseModel):
    amount: float
    paid_by: str
    split_between: List[str]
    description: Optional[str] = None


# -------------------------
# Helpers
# -------------------------
def ensure_trip(trip_id: str) -> dict:
    if trip_id not in trips:
        trips[trip_id] = {
            "title": "Weekend Trip",
            "members": {},  # member_id -> name
            "votes": {"destination": {}, "dates": {}},
            "memberVotes": {},  # member_id -> {destination: "...", dates: "..."}
            "expenses": [],  # list of expense dicts
            "options": {
                "destination": ["Lisbon", "Porto", "Barcelona", "Valencia", "Amsterdam"],
                "dates": ["Feb 7 – Feb 9", "Feb 14 – Feb 16", "Mar 1 – Mar 3", "Mar 8 – Mar 10"],
            },
        }
    return trips[trip_id]

def tally(trip: dict) -> dict:
    dest = [{"option": k, "votes": v} for k, v in trip["votes"]["destination"].items()]
    dates = [{"option": k, "votes": v} for k, v in trip["votes"]["dates"].items()]
    dest.sort(key=lambda x: x["votes"], reverse=True)
    dates.sort(key=lambda x: x["votes"], reverse=True)
    winner = {
        "destination": dest[0]["option"] if dest else None,
        "dates": dates[0]["option"] if dates else None,
    }
    return {"destinations": dest, "dates": dates, "winner": winner}

def total_spent(trip: dict) -> float:
    return round(sum(e["amount"] for e in trip["expenses"]), 2)


# -------------------------
# Core trip endpoints
# -------------------------
@app.post("/trip")
def create_trip(trip: TripCreate):
    import random, string
    trip_id = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    t = ensure_trip(trip_id)
    t["title"] = (trip.title or "Weekend Trip").strip() or "Weekend Trip"
    return {"trip_id": trip_id}

@app.get("/trip/{trip_id}")
def get_trip(trip_id: str):
    t = ensure_trip(trip_id)
    return {
        "trip_id": trip_id,
        "title": t["title"],
        "member_count": len(t["members"]),
        "total_spent": total_spent(t),
        "winner": tally(t)["winner"],
    }

@app.put("/trip/{trip_id}")
def update_trip(trip_id: str, update: TripUpdate):
    t = ensure_trip(trip_id)
    new_title = (update.title or "").strip()
    if not new_title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    t["title"] = new_title
    return {"ok": True, "title": t["title"]}

@app.get("/trip/{trip_id}/members")
def get_members(trip_id: str):
    t = ensure_trip(trip_id)
    members = [{"member_id": mid, "name": name} for mid, name in t["members"].items()]
    members.sort(key=lambda m: m["name"].lower())
    return {"members": members}

@app.get("/trip/{trip_id}/options")
def get_options(trip_id: str):
    t = ensure_trip(trip_id)
    return {"title": t["title"], "options": t["options"]}

@app.post("/trip/{trip_id}/join")
def join_trip(trip_id: str, join: JoinTrip):
    t = ensure_trip(trip_id)
    import random, string
    member_id = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    name = (join.name or "Anonymous").strip() or "Anonymous"
    t["members"][member_id] = name
    return {"member_id": member_id}

@app.post("/trip/{trip_id}/vote")
def vote(trip_id: str, vote: Vote):
    t = ensure_trip(trip_id)
    member_id = vote.member_id
    type_ = vote.type
    option = vote.option

    # Optional: enforce member exists
    if member_id not in t["members"]:
        raise HTTPException(status_code=400, detail="Member not found. Join first.")

    t["memberVotes"].setdefault(member_id, {})
    prev = t["memberVotes"][member_id].get(type_)

    if prev:
        t["votes"][type_][prev] -= 1
        if t["votes"][type_][prev] <= 0:
            del t["votes"][type_][prev]

    t["memberVotes"][member_id][type_] = option
    t["votes"][type_][option] = t["votes"][type_].get(option, 0) + 1

    return {"ok": True}

@app.get("/trip/{trip_id}/results")
def results(trip_id: str):
    t = ensure_trip(trip_id)
    return tally(t)


# -------------------------
# Recommendations / Itinerary (anti-touristy by default)
# -------------------------
@app.get("/trip/{trip_id}/recommendations")
def recommendations(trip_id: str, avoid_crowds: bool = True):
    t = ensure_trip(trip_id)
    winning_dest = tally(t)["winner"]["destination"]

    if not winning_dest:
        picks = [d for d in t["options"]["destination"][:3] if d]
        return {"suggestions": [{"destination": d, "reason": "Vote first to unlock hidden gems"} for d in picks]}

    if ALGORITHMS_AVAILABLE:
        try:
            coords = place_fetcher.geocode_destination(winning_dest)
            if not coords:
                return {"suggestions": [{"destination": winning_dest, "reason": "Winner of group vote"}]}

            lat, lon = coords
            places = place_fetcher.fetch_nearby_places(
                lat, lon, radius_km=3.0,
                categories=["cafe", "restaurant", "museum", "park", "attraction"]
            )
            if not places:
                return {"suggestions": [{"destination": winning_dest, "reason": "Winner of group vote"}]}

            ranked = CrowdAvoidanceScorer.rank_places(places, avoid_crowds=avoid_crowds)
            out = []
            for p in ranked[:6]:
                if p.crowd_score < 0.3:
                    reason = f"✨ Hidden gem — {p.category}"
                elif p.crowd_score < 0.6:
                    reason = f"📍 Local favorite — {p.category}"
                else:
                    reason = f"🔥 Popular-ish — {p.category}"
                out.append({"destination": p.name, "reason": reason})
            return {"suggestions": out}
        except Exception:
            return {"suggestions": [{"destination": winning_dest, "reason": "Winner of group vote"}]}

    return {"suggestions": [{"destination": winning_dest, "reason": "Winner of group vote"}]}

@app.get("/trip/{trip_id}/itinerary")
def itinerary(trip_id: str, avoid_crowds: bool = True):
    t = ensure_trip(trip_id)
    winning_dest = tally(t)["winner"]["destination"]
    if not winning_dest:
        raise HTTPException(status_code=400, detail="No destination selected yet. Vote first!")

    days = {
        "day_1": {"morning": f"Explore central {winning_dest}", "afternoon": "Lunch + one standout place", "evening": "Dinner + relaxed walk"},
        "day_2": {"morning": "Museum / landmark (skip the queues if possible)", "afternoon": "Markets / neighborhoods", "evening": "Low-key nightlife"},
        "day_3": {"morning": "Brunch + coffee", "afternoon": "Last sights + souvenirs", "evening": "Pack + depart"},
    }

    recommendations = []
    if ALGORITHMS_AVAILABLE:
        try:
            coords = place_fetcher.geocode_destination(winning_dest)
            if coords:
                lat, lon = coords
                places = place_fetcher.fetch_nearby_places(lat, lon, radius_km=3.0)
                if places:
                    ranked = CrowdAvoidanceScorer.rank_places(places, avoid_crowds=avoid_crowds)
                    for p in ranked[:10]:
                        recommendations.append({
                            "name": p.name,
                            "category": p.category,
                            "crowd_score": round(p.crowd_score, 2),
                            "distance_km": round(p.distance_from_center, 2),
                            "is_hidden_gem": p.crowd_score < 0.3
                        })

                    # Put top picks into the skeleton
                    if len(ranked) >= 1:
                        days["day_1"]["morning"] = f"Visit {ranked[0].name}"
                    if len(ranked) >= 2:
                        days["day_1"]["afternoon"] = f"Explore {ranked[1].name}"
                    if len(ranked) >= 3:
                        days["day_2"]["morning"] = f"See {ranked[2].name}"
        except Exception:
            pass

    return {
        "trip_id": trip_id,
        "destination": winning_dest,
        "avoid_crowds_mode": avoid_crowds,
        "days": days,
        "recommendations": recommendations,
    }


# -------------------------
# Expenses / Settlement
# -------------------------
@app.post("/trip/{trip_id}/expense")
def add_expense(trip_id: str, expense: ExpenseCreate):
    t = ensure_trip(trip_id)

    data = {
        "amount": float(expense.amount),
        "paid_by": (expense.paid_by or "").strip(),
        "split_between": [s.strip() for s in (expense.split_between or []) if s.strip()],
        "description": (expense.description or "Expense").strip(),
    }

    if data["amount"] <= 0:
        raise HTTPException(status_code=400, detail="Amount must be > 0")
    if not data["paid_by"]:
        raise HTTPException(status_code=400, detail="paid_by is required")
    if not data["split_between"]:
        raise HTTPException(status_code=400, detail="split_between must contain at least one name")

    t["expenses"].append(data)
    return {"ok": True, "expense": data, "total_spent": total_spent(t)}

@app.get("/trip/{trip_id}/expenses")
def get_expenses(trip_id: str):
    t = ensure_trip(trip_id)
    return {"expenses": t["expenses"], "total_spent": total_spent(t)}

@app.get("/trip/{trip_id}/settle")
def settle(trip_id: str):
    t = ensure_trip(trip_id)
    expenses = t["expenses"]
    if not expenses:
        return {"trip_id": trip_id, "transfers": [], "total_expenses": 0.0, "summary": "No expenses to settle"}

    if ALGORITHMS_AVAILABLE:
        try:
            transfers = SettlementCalculator.calculate_settlements(expenses)
            transfer_dicts = [
                {"from_person": tr.from_person, "to_person": tr.to_person, "amount": round(tr.amount, 2)}
                for tr in transfers
            ]
            summary = SettlementCalculator.format_settlement_summary(transfers)
            total = sum(e["amount"] for e in expenses)
            return {"trip_id": trip_id, "transfers": transfer_dicts, "total_expenses": round(total, 2), "summary": summary}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Settlement failed: {e}")

    # Fallback minimal
    return {"trip_id": trip_id, "transfers": [], "total_expenses": sum(e["amount"] for e in expenses), "summary": "Settlement algorithm unavailable"}

@app.get("/")
def root():
    return {"status": "ok", "message": "Collie API", "algorithms_available": ALGORITHMS_AVAILABLE}
