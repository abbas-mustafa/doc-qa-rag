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
    # Ingestion: one call per figure and per OCR'd page, so a single document can
    # cost _MAX_FIGURES_PER_DOC + _MAX_OCR_PAGES = 70 requests.
    #
    # This used to be gemini-2.5-flash, on its own model so a bulk upload couldn't
    # starve the answer path. That model's free tier turned out to be 20 requests
    # *per day* (quotaId GenerateRequestsPerDayPerProjectPerModel-FreeTier), i.e.
    # a third of what one scanned PDF needs — the isolation held, but it isolated
    # the answer path from a bucket that dies partway through the first upload.
    # gemini-3.5-flash is also 20/day, and ~8x slower (50s/page vs 6s). Every other
    # stable model with a separate bucket now 404s or 429s, so quota isolation is
    # simply not purchasable on the free tier; sharing chat_model's bucket is the
    # same trade condense_model already makes, and a live bucket beats a dead one.
    #
    # Measured, not assumed: identical digit retention (100% of numbers preserved
    # across pages of a real report, which is what a citation depends on). Overall
    # transcription similarity is NOT a discriminator here — it swings 38-73% across
    # repeat runs of the same model on the same page, so it measures formatting
    # choices, not comprehension. Don't re-litigate this on that metric.
    vision_model: str = "gemini-3.1-flash-lite"
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
