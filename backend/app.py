from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, JSON, text
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import os

app = Flask(__name__)

# CORS: allow frontend to call backend APIs
CORS(
    app,
    resources={r"/api/*": {"origins": "*"}},
    methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# ------------------------------------------------------------
# Database config
# - Local dev: SQLite (fuelsplit.db)
# - Production (Render): DATABASE_URL env var (Postgres)
# ------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///fuelsplit.db")

# Normalize postgres scheme for psycopg3 + SQLAlchemy
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# ------------------------------------------------------------
# DB Model
# ------------------------------------------------------------
class FuelSession(Base):
    __tablename__ = "fuel_sessions"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    fuel = Column(String(20))
    tripMode = Column(String(10))
    rate = Column(Float)

    cost1 = Column(Float)
    cost2 = Column(Float)
    totalCost = Column(Float)
    totalLiters = Column(Float)

    payload = Column(JSON)

Base.metadata.create_all(bind=engine)

# ------------------------------------------------------------
# ROUTES
# ------------------------------------------------------------
@app.get("/")
def root():
    return jsonify({"ok": True, "service": "fuelsplit-backend"})

@app.get("/api/health")
def api_health():
    return jsonify({"ok": True, "service": "fuelsplit-backend", "time": datetime.utcnow().isoformat()})

@app.get("/api/version")
def api_version():
    return jsonify({"ok": True, "message": "LATEST DEPLOY", "time": datetime.utcnow().isoformat()})

@app.get("/api/sessions")
def get_sessions():
    db = SessionLocal()
    try:
        rows = db.query(FuelSession).order_by(FuelSession.id.desc()).limit(50).all()
        out = []
        for r in rows:
            data = r.payload or {}
            data["id"] = r.id
            data["created_at"] = r.created_at.isoformat()
            out.append(data)
        return jsonify(out)
    finally:
        db.close()

@app.post("/api/sessions")
def create_session():
    data = request.get_json(force=True) or {}

    trip1 = data.get("trip1") or {}
    trip2 = data.get("trip2") or {}

    cost1 = float(trip1.get("cost", data.get("cost1", 0)) or 0)
    cost2 = float(trip2.get("cost", data.get("cost2", 0)) or 0)

    total_cost = float(data.get("totalCost", cost1 + cost2) or 0)
    total_liters = float(data.get("totalLiters", 0) or 0)

    db = SessionLocal()
    try:
        row = FuelSession(
            fuel=str(data.get("fuel", "")),
            tripMode=str(data.get("tripMode", "")),
            rate=float(data.get("rate", 0) or 0),
            cost1=cost1,
            cost2=cost2,
            totalCost=total_cost,
            totalLiters=total_liters,
            payload=data
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return jsonify({"ok": True, "id": row.id})
    finally:
        db.close()

@app.delete("/api/sessions")
def clear_sessions():
    db = SessionLocal()
    try:
        db.execute(text("DELETE FROM fuel_sessions"))
        db.commit()
        return jsonify({"ok": True})
    finally:
        db.close()

# Local run only
if __name__ == "__main__":
    app.run(debug=True)
