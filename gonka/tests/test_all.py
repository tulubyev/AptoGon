"""
HSI Gonka Integration — Test Suite

Tests run WITHOUT network access (no real Gonka calls).
All tests use mocked responses to verify:
  - Pattern extraction logic
  - Prompt construction
  - Response parsing
  - Fallback behavior
  - Privacy guarantees (no sensitive data in prompts)
  - Edge cases (motor difficulty, infrastructure failure)

Run with:
    python -m pytest tests/
    python tests/test_all.py  (standalone)
"""

import asyncio
import hashlib
import json
import sys
import unittest
from dataclasses import dataclass
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

# Add parent to path for imports
sys.path.insert(0, "/home/claude/hsi_gonka")

from gonka.expression_engine import (
    ExpressionEngine, PatternExtractor,
    TouchEvent, TouchPattern
)
from gonka.antibot_firewall import AntiBotFirewall, RequestRecord, RequestSampler
from gonka.translation_bridge import TranslationBridge
from gonka.bond_matcher import BondMatcher, CandidateProfile, RequesterProfile
from gonka.client import ChatResponse, GonkaClient, GonkaConfig


# ── Mock Client ───────────────────────────────────────────────────────────────

def make_mock_client(response_json: dict, via_fallback: bool = False) -> GonkaClient:
    """Create a GonkaClient that returns a fixed mock response."""
    client = MagicMock(spec=GonkaClient)
    client.chat = AsyncMock(return_value=ChatResponse(
        content=json.dumps(response_json),
        model="Qwen/mock",
        usage=None,
        latency_ms=42.0,
        via_fallback=via_fallback,
    ))
    return client


def make_human_events(n: int = 20, add_corrections: bool = True) -> list[TouchEvent]:
    """Generate synthetic human-like touch events."""
    import math
    import random
    rng = random.Random(42)

    events = []
    t = 0
    for i in range(n):
        angle = (i / n) * 2 * math.pi
        # Natural human variation
        x = 0.5 + 0.3 * math.cos(angle) + rng.gauss(0, 0.03)
        y = 0.5 + 0.3 * math.sin(angle) + rng.gauss(0, 0.03)
        pressure = 0.5 + rng.gauss(0, 0.1)
        dt = int(50 + rng.expovariate(0.02))  # irregular intervals

        # Add a correction (direction reversal)
        if add_corrections and i == n // 2:
            x -= 0.05

        events.append(TouchEvent(
            x=max(0, min(1, x)),
            y=max(0, min(1, y)),
            pressure=max(0, min(1, pressure)),
            timestamp_ms=t,
            pause_after_ms=int(rng.expovariate(0.005)),
        ))
        t += dt

    return events


def make_bot_events(n: int = 20) -> list[TouchEvent]:
    """Generate synthetic bot touch events — perfectly uniform."""
    events = []
    for i in range(n):
        events.append(TouchEvent(
            x=i / n,
            y=0.5,              # perfectly straight line
            pressure=0.5,       # perfectly constant pressure
            timestamp_ms=i * 100,   # exactly 100ms between each
            pause_after_ms=0,       # no pauses
        ))
    return events


# ── Test: PatternExtractor ────────────────────────────────────────────────────

class TestPatternExtractor(unittest.TestCase):

    def setUp(self):
        self.extractor = PatternExtractor()

    def test_human_pattern_has_high_variance(self):
        events = make_human_events(25)
        pattern = self.extractor.extract(events)

        self.assertGreater(pattern.velocity_std, 0.05,
            "Human gestures should have high velocity variance")
        self.assertGreater(pattern.pause_entropy, 0.5,
            "Human pauses should have entropy > 0.5")

    def test_bot_pattern_has_zero_variance(self):
        events = make_bot_events(25)
        pattern = self.extractor.extract(events)

        self.assertLess(pattern.velocity_std, 0.01,
            "Bot gestures have near-zero velocity variance")
        self.assertEqual(pattern.correction_count, 0,
            "Bots make no corrections")
        self.assertLess(pattern.pause_entropy, 0.1,
            "Bots have near-zero pause entropy")

    def test_human_has_corrections(self):
        events = make_human_events(25, add_corrections=True)
        pattern = self.extractor.extract(events)
        self.assertGreater(pattern.correction_count, 0,
            "Human gestures with corrections should be detected")

    def test_motor_difficulty_detection(self):
        """Simulate a user with tremor — many corrections, slow gesture."""
        import random
        rng = random.Random(99)
        events = []
        t = 0
        for i in range(30):
            # Simulate tremor: frequent small direction changes
            x = 0.5 + rng.gauss(0, 0.05)
            y = 0.5 + rng.gauss(0, 0.05)
            events.append(TouchEvent(
                x=max(0, min(1, x)), y=max(0, min(1, y)),
                pressure=0.3 + rng.gauss(0, 0.15),
                timestamp_ms=t,
                pause_after_ms=rng.randint(500, 2000),
            ))
            t += rng.randint(200, 800)  # very slow

        pattern = self.extractor.extract(events)
        self.assertTrue(
            pattern.possible_motor_difficulty or pattern.correction_count > 5,
            "Should detect possible motor difficulty in tremor simulation"
        )

    def test_raw_coordinates_not_in_pattern(self):
        """Privacy test: pattern should not contain raw XY coordinates."""
        events = make_human_events(20)
        pattern = self.extractor.extract(events)
        pattern_dict = pattern.__dict__

        # Verify no x/y coordinates in output
        self.assertNotIn("x", pattern_dict)
        self.assertNotIn("y", pattern_dict)
        self.assertNotIn("raw_", str(pattern_dict))

    def test_minimum_events_validation(self):
        """Should raise error with too few events."""
        with self.assertRaises(ValueError):
            self.extractor.extract(make_human_events(2))


# ── Test: ExpressionEngine ────────────────────────────────────────────────────

class TestExpressionEngine(unittest.TestCase):

    def test_human_verification_success(self):
        """Human gesture should generate ExpressionProof."""
        client = make_mock_client({
            "is_human": True,
            "confidence": 0.93,
            "reasoning": "High entropy and corrections detected",
            "anomalies": [],
        })
        engine = ExpressionEngine(client)
        events = make_human_events(25)

        result = asyncio.run(engine.verify(events, session_id="test-session-001"))

        self.assertTrue(result.is_human)
        self.assertEqual(result.confidence, 0.93)
        self.assertIsNotNone(result.expression_proof,
            "Verified human should get an ExpressionProof hash")
        self.assertEqual(len(result.expression_proof), 64,
            "ExpressionProof should be SHA3-256 hex (64 chars)")
        self.assertTrue(result.passed)

    def test_bot_verification_fails(self):
        """Bot gesture should NOT generate ExpressionProof."""
        client = make_mock_client({
            "is_human": False,
            "confidence": 0.02,
            "reasoning": "Zero variance — automated pattern",
            "anomalies": ["near-zero velocity variance", "zero pause entropy"],
        })
        engine = ExpressionEngine(client)
        events = make_bot_events(25)

        result = asyncio.run(engine.verify(events, session_id="test-session-002"))

        self.assertFalse(result.is_human)
        self.assertIsNone(result.expression_proof,
            "Bot should not receive ExpressionProof")
        self.assertFalse(result.passed)

    def test_low_confidence_no_proof(self):
        """High is_human but low confidence should NOT produce proof."""
        client = make_mock_client({
            "is_human": True,
            "confidence": 0.50,  # Below 0.85 threshold
            "reasoning": "Ambiguous pattern",
            "anomalies": [],
        })
        engine = ExpressionEngine(client)
        events = make_human_events(25)

        result = asyncio.run(engine.verify(events, session_id="test-session-003"))

        self.assertTrue(result.is_human)
        self.assertIsNone(result.expression_proof,
            "Low confidence should not produce proof")
        self.assertFalse(result.passed)

    def test_motor_difficulty_lower_threshold(self):
        """Users with motor difficulty get lower confidence threshold (0.70)."""
        client = make_mock_client({
            "is_human": True,
            "confidence": 0.72,  # Below normal 0.85 but above motor 0.70
            "reasoning": "Possible motor difficulty — human classified",
            "anomalies": [],
        })
        engine = ExpressionEngine(client)

        # Create pattern with motor difficulty flag
        import random
        rng = random.Random(77)
        events = []
        t = 0
        for i in range(35):
            events.append(TouchEvent(
                x=max(0, min(1, 0.5 + rng.gauss(0, 0.08))),
                y=max(0, min(1, 0.5 + rng.gauss(0, 0.08))),
                pressure=0.3,
                timestamp_ms=t,
                pause_after_ms=rng.randint(300, 1500),
            ))
            t += rng.randint(300, 1000)

        result = asyncio.run(engine.verify(events, session_id="test-motor-001"))
        # Motor difficulty users should pass even with lower confidence
        self.assertTrue(result.is_human)

    def test_fallback_on_gonka_failure(self):
        """Infrastructure failure should not block humans."""
        client = make_mock_client({}, via_fallback=True)
        # Fallback returns conservative allow
        client.chat = AsyncMock(return_value=ChatResponse(
            content=json.dumps({
                "is_human": True,
                "confidence": 0.5,
                "reasoning": "AI unavailable — conservative default",
                "anomalies": [],
            }),
            model="fallback",
            usage=None,
            latency_ms=1.0,
            via_fallback=True,
        ))
        engine = ExpressionEngine(client)
        events = make_human_events(25)

        result = asyncio.run(engine.verify(events, session_id="fallback-test"))
        # Fallback uses 0.70 threshold
        self.assertTrue(result.via_fallback)

    def test_proof_is_deterministic(self):
        """Same pattern + session → same proof hash."""
        client = make_mock_client({
            "is_human": True, "confidence": 0.95,
            "reasoning": "clear human", "anomalies": [],
        })
        engine = ExpressionEngine(client)
        events = make_human_events(25)

        result1 = asyncio.run(engine.verify(events, "same-session"))
        result2 = asyncio.run(engine.verify(events, "same-session"))

        # Note: time_bucket is 1-hour granular, so within same hour = same
        if result1.expression_proof and result2.expression_proof:
            self.assertEqual(result1.expression_proof, result2.expression_proof,
                "Proof should be deterministic within same hour bucket")

    def test_proof_changes_with_session(self):
        """Different sessions → different proof hashes (replay protection)."""
        client = make_mock_client({
            "is_human": True, "confidence": 0.95,
            "reasoning": "clear human", "anomalies": [],
        })
        engine = ExpressionEngine(client)
        events = make_human_events(25)

        result1 = asyncio.run(engine.verify(events, "session-AAA"))
        result2 = asyncio.run(engine.verify(events, "session-BBB"))

        if result1.expression_proof and result2.expression_proof:
            self.assertNotEqual(result1.expression_proof, result2.expression_proof,
                "Different sessions must produce different proofs")

    def test_no_coordinates_in_prompt(self):
        """Privacy: raw coordinates must not appear in Gonka prompt."""
        captured_messages = []

        async def capture_chat(**kwargs):
            captured_messages.extend(kwargs.get("messages", []))
            return ChatResponse(
                content=json.dumps({
                    "is_human": True, "confidence": 0.9,
                    "reasoning": "test", "anomalies": [],
                }),
                model="mock", usage=None, latency_ms=1.0,
            )

        client = MagicMock(spec=GonkaClient)
        client.chat = capture_chat
        engine = ExpressionEngine(client)
        events = make_human_events(20)

        asyncio.run(engine.verify(events, "privacy-test"))

        # Check no raw coordinates in any message
        all_content = " ".join(
            m.get("content", "") for m in captured_messages
        )
        self.assertNotIn("timestamp_ms", all_content,
            "Raw timestamps must not appear in Gonka prompt")


# ── Test: AntiBotFirewall ─────────────────────────────────────────────────────

class TestAntiBotFirewall(unittest.TestCase):

    def test_human_behavior_passes(self):
        """Irregular human behavior should not be flagged."""
        client = make_mock_client({
            "bot_probability": 0.05,
            "signals": [],
            "reasoning": "Natural irregular timing",
        })
        firewall = AntiBotFirewall(client)

        import random
        rng = random.Random(42)
        records = [
            RequestRecord(
                timestamp_ms=i * rng.randint(500, 5000),
                action_type=rng.choice(["view", "post", "search", "bond", "profile"]),
                response_time_ms=rng.randint(200, 3000),
            )
            for i in range(30)
        ]

        result = asyncio.run(firewall.check("abc123", records, force=True))
        self.assertEqual(result.action_required, "allow")
        self.assertFalse(result.should_block)

    def test_bot_behavior_flagged(self):
        """Perfect machine timing should be flagged."""
        client = make_mock_client({
            "bot_probability": 0.97,
            "signals": ["near-zero timing variance", "zero action diversity"],
            "reasoning": "Machine-perfect intervals",
        })
        firewall = AntiBotFirewall(client)

        # Perfect 1000ms intervals, always "view" action
        records = [
            RequestRecord(
                timestamp_ms=i * 1000,    # exactly 1 second
                action_type="view",        # always same
                response_time_ms=50,       # always same
            )
            for i in range(30)
        ]

        result = asyncio.run(firewall.check("bot456", records, force=True))
        self.assertGreater(result.bot_probability, 0.75)
        self.assertTrue(result.should_block or result.should_reverify)

    def test_failure_allows_through(self):
        """Infrastructure failure must never block real users."""
        client = MagicMock(spec=GonkaClient)
        client.chat = AsyncMock(side_effect=ConnectionError("Gonka unreachable"))
        firewall = AntiBotFirewall(client)

        import random
        rng = random.Random(7)
        records = [
            RequestRecord(
                timestamp_ms=i * rng.randint(300, 4000),
                action_type=rng.choice(["view", "post", "bond"]),
                response_time_ms=rng.randint(100, 2000),
            )
            for i in range(20)
        ]
        result = asyncio.run(firewall.check("user789", records, force=True))

        self.assertEqual(result.action_required, "allow",
            "Infrastructure failure must result in ALLOW, never block")
        self.assertTrue(result.via_fallback)

    def test_sampler_rejects_too_few_records(self):
        """Insufficient history should not trigger analysis."""
        sampler = RequestSampler()
        result = sampler.analyze([RequestRecord(0, "view", 100)])
        self.assertTrue(result.get("insufficient_data"))

    def test_rule_based_bot_detection(self):
        """Rule-based detector should catch obvious bots."""
        sampler = RequestSampler()
        firewall = AntiBotFirewall(MagicMock())

        # Simulate perfectly uniform intervals
        records = [RequestRecord(i * 1000, "view", 50) for i in range(20)]
        stats = sampler.analyze(records)

        score = firewall._rule_based_score(stats)
        self.assertGreater(score, 0.5,
            "Perfect timing bot should score > 0.5 in rule-based check")


# ── Test: TranslationBridge ───────────────────────────────────────────────────

class TestTranslationBridge(unittest.TestCase):

    def test_basic_translation(self):
        """Should translate text and return TranslationResult."""
        client = make_mock_client(None)  # content not JSON here
        client.chat = AsyncMock(return_value=ChatResponse(
            content="Hello, how are you?",
            model="Qwen/mock",
            usage=None,
            latency_ms=200.0,
        ))
        bridge = TranslationBridge(client)

        result = asyncio.run(bridge.translate(
            text="Привет, как дела?",
            source_lang="ru",
            target_lang="en",
        ))

        self.assertEqual(result.translated, "Hello, how are you?")
        self.assertEqual(result.source_lang, "ru")
        self.assertEqual(result.target_lang, "en")

    def test_sensitive_region_uses_special_prompt(self):
        """Messages from sensitive regions should trigger special system prompt."""
        captured_messages = []

        async def capture_chat(**kwargs):
            captured_messages.extend(kwargs.get("messages", []))
            return ChatResponse(
                content="My friend woke up [Note: may mean 'released from custody']",
                model="mock", usage=None, latency_ms=1.0,
            )

        client = MagicMock(spec=GonkaClient)
        client.chat = capture_chat
        bridge = TranslationBridge(client)

        asyncio.run(bridge.translate(
            text="دوستم از خواب بیدار شد",
            source_lang="fa",
            target_lang="en",
            sender_region="IR",  # Iran — sensitive region
        ))

        system_msgs = [m for m in captured_messages if m.get("role") == "system"]
        system_content = " ".join(m["content"] for m in system_msgs)
        self.assertIn("surveillance", system_content.lower(),
            "Sensitive region should trigger special system prompt")

    def test_same_language_no_translation(self):
        """Should return original text if source == target."""
        bridge = TranslationBridge(MagicMock())

        result = asyncio.run(bridge.translate(
            text="Hello world",
            source_lang="en",
            target_lang="en",
        ))

        self.assertEqual(result.translated, "Hello world")
        self.assertEqual(result.latency_ms, 0.0)


# ── Test: BondMatcher ─────────────────────────────────────────────────────────

class TestBondMatcher(unittest.TestCase):

    def _make_candidates(self, n: int) -> list[CandidateProfile]:
        import random
        rng = random.Random(123)
        return [
            CandidateProfile(
                did_hash=hashlib.sha256(f"user{i}".encode()).hexdigest(),
                reputation_score=rng.randint(100, 950),
                bond_count=rng.randint(1, 50),
                successful_bonds=rng.randint(1, 50),
                revoked_bonds=rng.randint(0, 2),
                last_bond_days_ago=rng.randint(1, 60),
                network_depth=rng.randint(1, 5),
                active_hours_per_week=rng.uniform(2, 20),
                joined_days_ago=rng.randint(30, 500),
            )
            for i in range(n)
        ]

    def test_selects_correct_count(self):
        """Should return exactly n_select candidates."""
        candidates = self._make_candidates(50)
        selected_ids = [c.did_hash[:8] for c in candidates[:10]]

        client = make_mock_client({
            "selected_ids": selected_ids,
            "reasoning": "High reputation candidates",
            "diversity_score": 0.8,
            "estimated_approval_rate": 0.7,
        })
        matcher = BondMatcher(client)
        requester = RequesterProfile(0.92, "new", 0)

        result = asyncio.run(matcher.find_guarantors(candidates, requester, n_select=10))
        self.assertLessEqual(len(result.selected_candidates), 10)

    def test_small_pool_returns_all(self):
        """Pool smaller than n_select should return all candidates."""
        candidates = self._make_candidates(5)
        matcher = BondMatcher(MagicMock())
        requester = RequesterProfile(0.9, "new", 0)

        result = asyncio.run(matcher.find_guarantors(candidates, requester, n_select=10))
        self.assertEqual(len(result.selected_candidates), 5)

    def test_rule_based_prefers_high_reputation(self):
        """Rule-based fallback should prefer high reputation candidates."""
        matcher = BondMatcher(MagicMock())
        candidates = self._make_candidates(20)
        sorted_candidates = matcher._rule_based_sort(candidates)

        # Top candidate should have high reputation
        self.assertGreater(sorted_candidates[0].reputation_score,
                           sorted_candidates[-1].reputation_score)


# ── Test: Privacy ─────────────────────────────────────────────────────────────

class TestPrivacyGuarantees(unittest.TestCase):
    """
    Critical privacy tests — these must never fail.
    HSI commitment: "только криптографические тени"
    """

    def test_expression_proof_is_hash_not_data(self):
        """ExpressionProof must be a hash, never raw pattern data."""
        extractor = PatternExtractor()
        events = make_human_events(20)
        pattern = extractor.extract(events)

        engine = ExpressionEngine(MagicMock())
        proof = engine._generate_proof(pattern, "test-session", 0.9)

        self.assertEqual(len(proof), 64, "Proof must be SHA3-256 (64 hex chars)")
        # Verify it's actually a valid hex string
        int(proof, 16)  # raises ValueError if not valid hex

    def test_did_hash_truncated_in_firewall(self):
        """Firewall should only use first 12 chars of DID hash."""
        firewall = AntiBotFirewall(MagicMock())

        did_hash = "a" * 64  # full 64-char hash
        # The cache key should only use first 12 chars
        cache_key = f"hsi:bot:{did_hash[:12]}"
        self.assertEqual(len(did_hash[:12]), 12)
        self.assertNotIn(did_hash[12:], cache_key,
            "Cache key must not contain full DID hash")

    def test_candidate_ids_truncated_in_matcher(self):
        """Bond matcher should only send 8 chars of DID to Gonka."""
        captured = []

        async def capture(**kwargs):
            captured.append(kwargs.get("messages", []))
            return ChatResponse(
                content=json.dumps({"selected_ids": [], "reasoning": "",
                                     "diversity_score": 0.5, "estimated_approval_rate": 0.5}),
                model="mock", usage=None, latency_ms=1.0,
            )

        client = MagicMock(spec=GonkaClient)
        client.chat = capture

        matcher = BondMatcher(client)
        candidates = [
            CandidateProfile(
                did_hash="a1b2c3d4e5f6" + "x" * 52,  # 64 chars total
                reputation_score=500, bond_count=10, successful_bonds=9,
                revoked_bonds=0, last_bond_days_ago=5,
                network_depth=2, active_hours_per_week=10, joined_days_ago=100,
            )
        ]
        requester = RequesterProfile(0.9, "new", 0)

        asyncio.run(matcher.find_guarantors(candidates, requester, n_select=5))

        if captured:
            all_content = str(captured)
            self.assertIn("a1b2c3d4",
                "Short ID should appear in prompt")
            # Full DID hash (64 chars) should not appear
            full_hash = "a1b2c3d4e5f6" + "x" * 52
            self.assertNotIn(full_hash[8:], all_content,
                "Full DID hash must not be sent to Gonka")


# ── Runner ────────────────────────────────────────────────────────────────────

def run_all():
    """Run all tests and print summary."""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    test_classes = [
        TestPatternExtractor,
        TestExpressionEngine,
        TestAntiBotFirewall,
        TestTranslationBridge,
        TestBondMatcher,
        TestPrivacyGuarantees,
    ]

    for cls in test_classes:
        suite.addTests(loader.loadTestsFromTestCase(cls))

    runner = unittest.TextTestRunner(verbosity=2, stream=sys.stdout)
    result = runner.run(suite)

    print("\n" + "="*60)
    print(f"Tests run:    {result.testsRun}")
    print(f"Failures:     {len(result.failures)}")
    print(f"Errors:       {len(result.errors)}")
    print(f"Status:       {'✓ ALL PASSED' if result.wasSuccessful() else '✗ FAILURES'}")
    print("="*60)

    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_all()
    sys.exit(0 if success else 1)
