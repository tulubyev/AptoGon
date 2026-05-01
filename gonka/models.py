"""
Gonka model constants for HSI integration.

Choose based on latency vs accuracy tradeoff:
  - FAST      → real-time firewall checks (< 200ms target)
  - PRIMARY   → expression analysis, translation (< 3s)
  - REASONING → bond matching, complex decisions (< 10s)

Provider routing via GONKA_BASE_URL / GONKA_API_KEY:
  OpenRouter:  https://openrouter.ai/api/v1
  Together.ai: https://api.together.xyz/v1
  Ollama:      http://localhost:11434/v1  (GONKA_API_KEY=ollama, only FAST model)
"""

import os

_PROVIDER = os.getenv("GONKA_PROVIDER", "openrouter")

# OpenRouter model IDs
_OPENROUTER = {
    "fast":      "qwen/qwen3-14b",
    "primary":   "qwen/qwen3-32b",
    "reasoning": "qwen/qwen3-235b-a22b",
}

# Together.ai model IDs
_TOGETHER = {
    "fast":      "Qwen/Qwen2.5-7B-Instruct-Turbo",
    "primary":   "Qwen/Qwen3-32B",
    "reasoning": "Qwen/Qwen3-235B-A22B",
}

# Ollama local model IDs (only fast available by default)
_OLLAMA = {
    "fast":      "qwen2.5:7b",
    "primary":   "qwen2.5:7b",   # fallback to fast locally
    "reasoning": "qwen2.5:7b",
}

_MAP = {
    "openrouter": _OPENROUTER,
    "together":   _TOGETHER,
    "ollama":     _OLLAMA,
}

_models = _MAP.get(_PROVIDER, _OPENROUTER)


class GonkaModel:
    FAST      = _models["fast"]
    PRIMARY   = _models["primary"]
    REASONING = _models["reasoning"]
    TRANSLATE = _models["primary"]

    EXPRESSION_ANALYSIS = PRIMARY
    ANTIBOT_REALTIME    = FAST
    BOND_MATCHING       = REASONING
    TRANSLATION         = TRANSLATE
