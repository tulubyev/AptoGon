"""
Tests for fine-tuning pipeline and integration components.
"""

import asyncio
import json
import sys
import unittest

sys.path.insert(0, "/home/claude/hsi_gonka")

from gonka.finetune_pipeline import HSIDatasetBuilder, FineTuneJobConfig, GonkaTrainer


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_human_session(seed: int = 0) -> dict:
    import math, random
    rng = random.Random(seed)
    return {
        "session_id": f"sess-{seed}",  # will be stripped (not in PII list, but let's keep it)
        "pattern": {
            "velocity_mean": 0.3 + rng.gauss(0, 0.05),
            "velocity_std":  0.25 + rng.gauss(0, 0.03),
            "pause_entropy": 2.1 + rng.gauss(0, 0.2),
            "correction_count": rng.randint(1, 8),
            "pressure_variance": 0.02 + rng.gauss(0, 0.005),
            "rhythm_irregularity": 0.45 + rng.gauss(0, 0.05),
            "total_duration_ms": rng.randint(2000, 8000),
            "point_count": rng.randint(15, 40),
        },
        "confidence": 0.88 + rng.gauss(0, 0.05),
        # PII that should be stripped
        "ip": "192.168.1.1",
        "device_id": "device-abc",
        "did": "did:key:abcdef123456",
    }


def make_bot_session(seed: int = 100) -> dict:
    import random
    rng = random.Random(seed)
    return {
        "pattern": {
            "velocity_mean": 0.5,
            "velocity_std":  0.0001 + rng.gauss(0, 0.00001),   # near zero
            "pause_entropy": 0.001,
            "correction_count": 0,
            "pressure_variance": 0.0,
            "rhythm_irregularity": 0.001,
            "total_duration_ms": 1000,
            "point_count": 20,
        },
        "confidence": 0.99,
        "ip_address": "10.0.0.1",          # PII — must be stripped
        "device_fingerprint": "fp-xyz",    # PII — must be stripped
    }


def make_translation_record(seed: int = 0) -> dict:
    samples = [
        ("ru", "Это важное сообщение", "en", "This is an important message"),
        ("fa", "دوستم آزاد شد", "en", "My friend was freed"),
        ("ar", "السلام عليكم", "en", "Peace be upon you"),
        ("zh", "我们需要自由", "en", "We need freedom"),
    ]
    src_lang, src_text, tgt_lang, tgt_text = samples[seed % len(samples)]
    return {
        "source_text": src_text,
        "source_lang": src_lang,
        "target_lang": tgt_lang,
        "reference_translation": tgt_text,
        "is_sensitive": seed % 2 == 0,
        "email": "should-be-stripped@test.com",  # PII
    }


# ── Dataset Builder Tests ─────────────────────────────────────────────────────

class TestHSIDatasetBuilder(unittest.TestCase):

    def setUp(self):
        self.builder = HSIDatasetBuilder()

    def test_expression_dataset_creates_examples(self):
        human = [make_human_session(i) for i in range(10)]
        bots  = [make_bot_session(i)  for i in range(10)]

        examples, stats = self.builder.build_expression_dataset(human, bots)

        self.assertEqual(stats.total_examples, 20)
        self.assertEqual(stats.human_examples, 10)
        self.assertEqual(stats.bot_examples, 10)

    def test_pii_stripped_from_all_examples(self):
        human = [make_human_session(i) for i in range(5)]
        bots  = [make_bot_session(i)   for i in range(5)]

        examples, stats = self.builder.build_expression_dataset(human, bots)

        self.assertGreater(stats.pii_fields_removed, 0,
            "Should have removed PII fields")

        for ex in examples:
            content = ex.user + ex.assistant + ex.system
            # None of these strings should appear in training examples
            self.assertNotIn("192.168", content, "IP should be stripped")
            self.assertNotIn("device-abc", content, "device_id should be stripped")
            self.assertNotIn("did:key:", content, "DID should be stripped")
            self.assertNotIn("@test.com", content, "email should be stripped")

    def test_motor_difficulty_examples_double_weighted(self):
        motor_sessions = [make_human_session(i) for i in range(5)]
        examples, stats = self.builder.build_expression_dataset(
            [], [], motor_sessions=motor_sessions
        )

        motor_examples = [e for e in examples if e.metadata.get("label") == "human_motor"]
        self.assertEqual(len(motor_examples), 5)

        for ex in motor_examples:
            self.assertEqual(ex.metadata["weight"], 2.5,
                "Motor difficulty examples must have extra weight")

    def test_human_examples_labeled_correctly(self):
        human = [make_human_session(i) for i in range(3)]
        examples, _ = self.builder.build_expression_dataset(human, [])

        for ex in examples:
            data = json.loads(ex.assistant)
            self.assertTrue(data["is_human"])
            self.assertGreater(data["confidence"], 0.5)

    def test_bot_examples_labeled_correctly(self):
        bots = [make_bot_session(i) for i in range(3)]
        examples, _ = self.builder.build_expression_dataset([], bots)

        for ex in examples:
            data = json.loads(ex.assistant)
            self.assertFalse(data["is_human"])
            self.assertGreater(data["confidence"], 0.5)

    def test_all_examples_valid_jsonl(self):
        human = [make_human_session(i) for i in range(5)]
        bots  = [make_bot_session(i)   for i in range(5)]
        examples, _ = self.builder.build_expression_dataset(human, bots)

        for ex in examples:
            line = ex.to_jsonl()
            parsed = json.loads(line)
            self.assertIn("messages", parsed)
            self.assertEqual(len(parsed["messages"]), 3)
            self.assertEqual(parsed["messages"][0]["role"], "system")
            self.assertEqual(parsed["messages"][1]["role"], "user")
            self.assertEqual(parsed["messages"][2]["role"], "assistant")

    def test_translation_dataset(self):
        records = [make_translation_record(i) for i in range(8)]
        examples, stats = self.builder.build_translation_dataset(records)

        self.assertGreater(stats.total_examples, 0)
        self.assertGreater(len(stats.languages), 1,
            "Should detect multiple languages")

        # PII stripped
        for ex in examples:
            self.assertNotIn("@test.com", ex.user + ex.assistant,
                "Email should be stripped from translation data")

    def test_antibot_dataset(self):
        import random
        rng = random.Random(42)

        human_sessions = [
            {
                "behavior_stats": {
                    "interval_cv": 0.6 + rng.gauss(0, 0.1),
                    "action_diversity": 0.4 + rng.gauss(0, 0.05),
                    "has_sleep_gap": True,
                    "active_hours_count": rng.randint(8, 16),
                },
                "bot_prob": 0.05,
            }
            for _ in range(5)
        ]
        bot_sessions = [
            {
                "behavior_stats": {
                    "interval_cv": 0.001,
                    "action_diversity": 0.01,
                    "has_sleep_gap": False,
                    "active_hours_count": 24,
                },
                "bot_prob": 0.97,
                "signals": ["uniform_timing", "no_sleep"],
                "ip": "192.168.0.1",  # PII
            }
            for _ in range(5)
        ]

        examples, stats = self.builder.build_antibot_dataset(human_sessions, bot_sessions)
        self.assertEqual(stats.total_examples, 10)

        for ex in examples:
            self.assertNotIn("192.168", ex.user + ex.assistant)


# ── FineTuneJobConfig Tests ───────────────────────────────────────────────────

class TestFineTuneJobConfig(unittest.TestCase):

    def test_default_config_valid(self):
        config = FineTuneJobConfig(
            model_name="hsi-human-detector-v2",
            base_model="Qwen/Qwen3-32B",
            method="lora",
            dataset_ipfs_cid="QmTestCID123",
            dataset_hash="abc" * 20 + "ab",
        )
        self.assertEqual(config.lora_rank, 16)
        self.assertEqual(config.min_nodes, 4)
        self.assertEqual(config.max_fnr, 0.001)
        self.assertIn("EU", config.preferred_regions)
        self.assertIn("AF", config.preferred_regions,
            "Africa must be in preferred regions — manifesto: geography ≠ voice")

    def test_detector_config_strict_fnr(self):
        """hsi-human-detector must have strictest FNR: 0.1% = 0.001"""
        config = FineTuneJobConfig(
            model_name="hsi-human-detector-v1",
            base_model="Qwen/Qwen3-32B",
            method="lora",
            dataset_ipfs_cid="QmABC",
            dataset_hash="x" * 64,
            max_fnr=0.001,  # 0.1% from manifest
        )
        self.assertEqual(config.max_fnr, 0.001)

    def test_antibot_config_fast_model(self):
        """Antibot model should use 7B for speed."""
        config = FineTuneJobConfig(
            model_name="hsi-antibot-rt-v1",
            base_model="Qwen/Qwen2.5-7B-Instruct",
            method="lora",
            dataset_ipfs_cid="QmABC",
            dataset_hash="x" * 64,
            lora_rank=8,   # smaller rank for speed
        )
        self.assertIn("7B", config.base_model)
        self.assertEqual(config.lora_rank, 8)


# ── GonkaTrainer Tests (mock) ─────────────────────────────────────────────────

class TestGonkaTrainer(unittest.TestCase):

    def test_create_job_offline(self):
        """Trainer should handle offline mode gracefully."""
        trainer = GonkaTrainer(
            api_key="gk-test",
            base_url="https://does-not-exist.invalid/v1",
        )
        config = FineTuneJobConfig(
            model_name="hsi-test-v1",
            base_model="Qwen/Qwen2.5-7B-Instruct",
            method="lora",
            dataset_ipfs_cid="QmTest",
            dataset_hash="a" * 64,
        )
        # Should not raise even though broker is unreachable
        job = asyncio.run(trainer.create_job(config))
        self.assertIsNotNone(job.job_id)
        self.assertIsNotNone(job.status)

    def test_evaluate_model_quality_gates(self):
        """Quality gates must enforce FNR < 0.1%."""
        trainer = GonkaTrainer(api_key="gk-test")
        eval_result = asyncio.run(trainer.evaluate_model(
            model_cid="ipfs://QmModel",
            eval_dataset_path="eval.jsonl",
            quality_gates={"max_fnr": 0.001, "max_fpr": 0.05},
        ))

        self.assertIn("metrics", eval_result)
        self.assertIn("quality_gates", eval_result)
        self.assertLess(eval_result["metrics"]["fnr"], 0.001,
            "FNR must be < 0.1% per HSI manifest")
        self.assertTrue(eval_result["quality_gates"]["motor_passed"],
            "Motor disability users must never be blocked")
        self.assertTrue(eval_result["overall_passed"])


# ── Runner ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    for cls in [TestHSIDatasetBuilder, TestFineTuneJobConfig, TestGonkaTrainer]:
        suite.addTests(loader.loadTestsFromTestCase(cls))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print(f"\n{'='*50}")
    print(f"Tests: {result.testsRun}  Failures: {len(result.failures)}  "
          f"Errors: {len(result.errors)}")
    print(f"{'✓ ALL PASSED' if result.wasSuccessful() else '✗ FAILURES'}")
    print(f"{'='*50}")
    sys.exit(0 if result.wasSuccessful() else 1)
