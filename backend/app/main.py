import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.config import settings
from app.api.endpoints import router as api_router
from app.services.data_store import data_store, reset_session_id, set_session_id
from app.services.demo_bootstrap import bootstrap_demo_data

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Enterprise AI Data Analyst powered by Google Gemini, DuckDB, and React."
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def session_store_context(request, call_next):
    token = set_session_id(request.headers.get("x-session-id"))
    try:
        bootstrap_demo_data(data_store, settings.SAMPLE_DIR)
        return await call_next(request)
    finally:
        reset_session_id(token)

# Include API Router
app.include_router(api_router, prefix="/api")

# Static files for production React build (if built)
dist_dir = settings.BASE_DIR.parent / "frontend" / "dist"
if dist_dir.exists():
    app.mount("/assets", StaticFiles(directory=dist_dir / "assets"), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = dist_dir / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(dist_dir / "index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
