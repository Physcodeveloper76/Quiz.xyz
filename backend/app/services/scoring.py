import math

def calculate_score(is_correct: bool, elapsed_ms: float, duration_ms: float, max_points: int = 1000) -> int:
    """
    Computes points earned based on response speed.
    Formula: S = floor(B * (1 - t / T))
    - If incorrect, late, or negative elapsed, returns 0.
    """
    if not is_correct:
        return 0
    if elapsed_ms < 0 or duration_ms <= 0:
        return 0
    # Deadline is exclusive: elapsed >= duration is late
    if elapsed_ms >= duration_ms:
        return 0
    remaining_fraction = 1.0 - (elapsed_ms / duration_ms)
    return max(0, math.floor(max_points * remaining_fraction))
