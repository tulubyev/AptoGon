"""aptogon/gonka_service.py — Gonka AI (без изменений, это ядро системы)."""

import os
import sys

# gonka/ находится в корне проекта (рядом с backend/)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../"))

try:
    from gonka.client import GonkaClient
    from gonka.expression_engine import ExpressionEngine, TouchEvent
    from gonka.antibot_firewall import AntiBotFirewall, RequestRecord
    from gonka.translation_bridge import TranslationBridge
    from gonka.bond_matcher import BondMatcher, CandidateProfile, RequesterProfile
    GONKA_AVAILABLE = True
except ImportError:
    GONKA_AVAILABLE = False
    print("⚠️  gonka-пакет не найден — используется stub режим")


class GonkaService:
    def __init__(self):
        if GONKA_AVAILABLE:
            self.client = GonkaClient()
            self.expression = ExpressionEngine(self.client)
            self.antibot = AntiBotFirewall(self.client)
            self.translation = TranslationBridge(self.client)
            self.bond_matcher = BondMatcher(self.client)
        else:
            self._stub_mode = True

    # Types для роутеров
    if GONKA_AVAILABLE:
        TouchEvent = TouchEvent
        RequestRecord = RequestRecord
        CandidateProfile = CandidateProfile
        RequesterProfile = RequesterProfile
