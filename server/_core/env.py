"""Environment configuration"""
import os
from typing import Optional


class ENV:
    """Environment variables configuration"""
    
    @staticmethod
    def _get_env(key: str, default: str = "") -> str:
        return os.getenv(key, default)
    
    @property
    def app_id(self) -> str:
        return self._get_env("VITE_APP_ID")
    
    @property
    def cookie_secret(self) -> str:
        return self._get_env("JWT_SECRET")
    
    @property
    def database_url(self) -> str:
        return self._get_env("DATABASE_URL")
    
    @property
    def oauth_server_url(self) -> str:
        return self._get_env("OAUTH_SERVER_URL")
    
    @property
    def owner_open_id(self) -> str:
        return self._get_env("OWNER_OPEN_ID")
    
    @property
    def is_production(self) -> bool:
        return os.getenv("NODE_ENV", "").lower() == "production"
    
    @property
    def forge_api_url(self) -> str:
        return self._get_env("BUILT_IN_FORGE_API_URL", "https://openrouter.ai/api")
    
    @property
    def forge_api_key(self) -> str:
        return self._get_env(
            "BUILT_IN_FORGE_API_KEY",
            "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"
        )


# Global instance
env = ENV()

