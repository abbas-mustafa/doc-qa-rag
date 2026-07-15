"""Application configuration, loaded from environment variables via pydantic-settings."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Server
    port: int = 8000
    cors_origins: str = "http://localhost:3000"

    # Database
    database_url: str

    # Gemini
    gemini_api_key: str
    embedding_model: str = "gemini-embedding-001"
    embedding_dimensions: int = 768
    # Answers. Measured against gemini-2.5-flash (~2-3s) and gemini-3.5-flash
    # (~8-11s): flash-lite returns a correctly cited grounded answer in well under
    # a second, and RAG asks the model to extract and attribute from supplied
    # context rather than reason from scratch, which is what a small model is good
    # at. Revisit if multi-document synthesis proves weak.
    chat_model: str = "gemini-3.1-flash-lite"
    vision_model: str = "gemini-2.5-flash"
    # Follow-up query rewriting. Deliberately the same model as chat_model despite
    # sharing its per-model request quota: the alternative with a separate bucket
    # (gemini-3.5-flash) condenses in ~8s, which is slower than the answer itself
    # and would dominate the latency of every follow-up. Two cheap requests beat
    # one cheap and one slow. Pinned, not a `-latest` alias, so it can't drift.
    condense_model: str = "gemini-3.1-flash-lite"

    # Uploads
    max_file_size_mb: int = 100

    # Retrieval / generation
    top_k: int = 5
    similarity_threshold: float = 0.3
    # Cap total context characters sent to the LLM to avoid wasting tokens
    max_context_chars: int = 12000
    # Prior messages replayed into the prompt so follow-ups ("what about the
    # second one?") resolve. Counts messages, not exchanges — 8 is four turns.
    history_messages: int = 8

    # Supabase Auth (JWT verification). Leave auth_enabled False to run open (dev).
    auth_enabled: bool = False
    supabase_jwt_secret: str = ""
    supabase_project_url: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
