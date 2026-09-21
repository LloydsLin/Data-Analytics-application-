import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Digital Back Office AI Data Analyst"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Gemini API Configuration
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    
    # Storage and limits
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    DATA_DIR: Path = BASE_DIR / "uploads"
    SAMPLE_DIR: Path = BASE_DIR.parent / "sample_data"
    MAX_FILE_SIZE_MB: int = 50
    
    # CORS
    CORS_ORIGINS: list[str] = ["*"]
    
    model_config = {
        "env_file": ".env",
        "extra": "ignore"
    }

settings = Settings()
os.makedirs(settings.DATA_DIR, exist_ok=True)
