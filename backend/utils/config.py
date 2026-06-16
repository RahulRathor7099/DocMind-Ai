"""
DocMind AI - Application Settings
Loads all configuration from environment variables using pydantic-settings
"""

from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from .env file."""

    # Authentication
    SECRET_KEY: str = Field(default="docmind-secret-key-change-in-production-32chars")
    ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=1440)

    # Database
    DATABASE_URL: str = Field(default="sqlite:///./docmind.db")

    # LLM Configuration
    LLM_PROVIDER: str = Field(default="gemini")  # gemini | groq | openai
    GEMINI_API_KEY: str = Field(default="")
    GROQ_API_KEY: str = Field(default="")
    OPENAI_API_KEY: str = Field(default="")

    # File Storage
    UPLOAD_DIR: str = Field(default="./uploads")
    MAX_FILE_SIZE_MB: int = Field(default=50)

    # CORS
    ALLOWED_ORIGINS: str = Field(default="http://localhost:3000")

    # Embeddings & RAG
    EMBEDDING_MODEL: str = Field(default="all-MiniLM-L6-v2")
    CHUNK_SIZE: int = Field(default=1000)
    CHUNK_OVERLAP: int = Field(default=200)
    RAG_TOP_K: int = Field(default=5)

    # SMTP / Email OTP Configuration
    SMTP_HOST: str = Field(default="smtp.gmail.com")
    SMTP_PORT: int = Field(default=587)
    SMTP_USER: str = Field(default="")
    SMTP_PASSWORD: str = Field(default="")
    SMTP_FROM_EMAIL: str = Field(default="noreply@docmind.ai")
    REQUIRE_OTP: bool = Field(default=False)


    @property
    def faiss_dir(self) -> str:
        import os
        return os.path.join(self.UPLOAD_DIR, "faiss")

    @property
    def pages_dir(self) -> str:
        import os
        return os.path.join(self.UPLOAD_DIR, "pages")

    @property
    def effective_llm_provider(self) -> str:
        provider = self.LLM_PROVIDER.lower()
        if provider == "gemini" and self.GEMINI_API_KEY:
            return "gemini"
        if provider == "groq" and self.GROQ_API_KEY:
            return "groq"
        if provider == "openai" and self.OPENAI_API_KEY:
            return "openai"
        
        # Fallbacks
        if self.GEMINI_API_KEY:
            return "gemini"
        if self.GROQ_API_KEY:
            return "groq"
        if self.OPENAI_API_KEY:
            return "openai"
        return "none"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()


# Singleton instance for direct import
settings = get_settings()

