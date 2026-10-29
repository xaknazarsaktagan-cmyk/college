from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./abit.db"
    jwt_secret: str = "change-me-in-production-abit-2026"
    jwt_expire_hours: int = 72
    upload_dir: str = "./uploads"
    max_upload_mb: int = 5
    cors_origins: str = "http://localhost:8080,http://127.0.0.1:8080,http://localhost:3000"


settings = Settings()
