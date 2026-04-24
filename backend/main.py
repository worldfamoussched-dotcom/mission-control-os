"""FastAPI Application Entry Point - Mission Control OS Phase 1"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from contextlib import asynccontextmanager

from backend.api import routes
from backend.db.session import init_db

# Lifespan context for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    init_db()
    print("✓ Database initialized")
    yield
    # Shutdown
    print("✓ Application shutdown")

# Create FastAPI app
app = FastAPI(
    title="Mission Control OS",
    description="AI orchestration system with BATMAN/JARVIS/WAKANDA modes",
    version="0.0.1",
    lifespan=lifespan
)

# CORS middleware
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(routes.router, prefix="/api", tags=["missions"])

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "version": "0.0.1",
        "phase": "Phase 1 - Batman Mode MVP"
    }

# Documentation
@app.get("/")
async def root():
    """API root."""
    return {
        "message": "Mission Control OS API",
        "docs": "/docs",
        "openapi": "/openapi.json"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("ENV", "dev") == "dev"
    )
