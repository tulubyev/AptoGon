"""
Gonka model constants for HSI integration.

Choose based on latency vs accuracy tradeoff:
  - FAST      → real-time firewall checks (< 200ms target)
  - PRIMARY   → expression analysis, translation (< 3s)
  - REASONING → bond matching, complex decisions (< 10s)
"""


class GonkaModel:
    # Fast inference — for real-time tasks
    FAST = "Qwen/Qwen2.5-7B-Instruct"

    # Primary workhorse — balanced accuracy/speed
    PRIMARY = "Qwen/Qwen3-32B-FP8"

    # Deep reasoning — for complex matching & analysis
    REASONING = "Qwen3-235B-A22B-Thinking-2507"

    # Multilingual specialist
    TRANSLATE = "Qwen/Qwen3-32B-FP8"

    # Aliases for clarity at call sites
    EXPRESSION_ANALYSIS = PRIMARY
    ANTIBOT_REALTIME = FAST
    BOND_MATCHING = REASONING
    TRANSLATION = TRANSLATE
