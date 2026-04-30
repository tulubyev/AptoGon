# HSI Gonka Integration Package
# Decentralized AI layer for Human Sapience Internet
#
# Usage:
#   from gonka import GonkaClient
#   client = GonkaClient(api_key="your_key")

from .client import GonkaClient
from .expression_engine import ExpressionEngine, TouchEvent, TouchPattern, ExpressionResult
from .antibot_firewall import AntiBotFirewall, BehaviorProfile, BotCheckResult
from .translation_bridge import TranslationBridge, TranslationResult
from .bond_matcher import BondMatcher, CandidateProfile, BondMatchResult
from .models import GonkaModel

__version__ = "0.1.0"
__all__ = [
    "GonkaClient",
    "ExpressionEngine", "TouchEvent", "TouchPattern", "ExpressionResult",
    "AntiBotFirewall", "BehaviorProfile", "BotCheckResult",
    "TranslationBridge", "TranslationResult",
    "BondMatcher", "CandidateProfile", "BondMatchResult",
    "GonkaModel",
]
