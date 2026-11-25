from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    database_url: str = "postgresql+asyncpg://stt:stt@localhost:5433/stt"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-transcribe-live"
    gemini_languages: str = ""

    whisper_enabled: bool = True
    whisper_model: str = "../models/hinglish-swift"
    whisper_threads: int = 2

    vocabulary: str = "RFQ,BOQ,PO,quotation,purchase order,vendor,GST,invoice"
    max_session_seconds: int = 180
    max_sessions: int = 4
    static_dir: str = "static"

    @property
    def words(self) -> list[str]:
        return [w.strip() for w in self.vocabulary.split(",") if w.strip()]


settings = Settings()
