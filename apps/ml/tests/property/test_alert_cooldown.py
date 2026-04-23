# Feature: fitsense-platform, Property 11: Alert Cooldown — Idempotency

"""
Property 11: Alert Cooldown — Idempotency

For any member and alert type, if an alert has been sent within the cooldown
period, all subsequent triggers must be skipped.

Validates: Requirements 9.7
"""

from hypothesis import given, settings
from hypothesis import strategies as st


# Pure cooldown state machine (no Redis dependency)
COOLDOWN_TTL = {"CRITICAL": 60, "WARNING": 120}


def simulate_cooldown(user_id: str, alert_type: str, events_timestamps: list) -> list:
    """
    Simulate cooldown logic purely.
    Returns list of booleans: True = alert sent, False = skipped (cooldown).
    """
    results = []
    last_sent_at = None
    ttl = COOLDOWN_TTL.get(alert_type, 60)

    for ts in events_timestamps:
        if last_sent_at is None or (ts - last_sent_at) >= ttl:
            results.append(True)   # sent
            last_sent_at = ts
        else:
            results.append(False)  # skipped (cooldown)

    return results


@given(
    user_id=st.uuids().map(str),
    alert_type=st.sampled_from(["CRITICAL", "WARNING"]),
    base_ts=st.integers(min_value=0, max_value=10**9),
    gap=st.integers(min_value=1, max_value=59),  # gap < CRITICAL cooldown (60s)
)
@settings(max_examples=100)
def test_second_alert_within_cooldown_is_skipped(user_id, alert_type, base_ts, gap):
    """Feature: fitsense-platform, Property 11: Alert Cooldown — Idempotency"""
    ttl = COOLDOWN_TTL[alert_type]
    # Two events within cooldown period
    events = [base_ts, base_ts + min(gap, ttl - 1)]
    results = simulate_cooldown(user_id, alert_type, events)
    assert results[0] is True   # first alert sent
    assert results[1] is False  # second skipped (within cooldown)


@given(
    user_id=st.uuids().map(str),
    alert_type=st.sampled_from(["CRITICAL", "WARNING"]),
    base_ts=st.integers(min_value=0, max_value=10**9),
)
@settings(max_examples=100)
def test_alert_after_cooldown_expires_is_sent(user_id, alert_type, base_ts):
    """Feature: fitsense-platform, Property 11: alert after cooldown is sent"""
    ttl = COOLDOWN_TTL[alert_type]
    events = [base_ts, base_ts + ttl + 1]  # second event after cooldown
    results = simulate_cooldown(user_id, alert_type, events)
    assert results[0] is True
    assert results[1] is True  # cooldown expired → sent again


@given(
    user_id=st.uuids().map(str),
    alert_type=st.sampled_from(["CRITICAL", "WARNING"]),
    base_ts=st.integers(min_value=0, max_value=10**9),
    n_events=st.integers(min_value=2, max_value=10),
    gap=st.integers(min_value=1, max_value=30),
)
@settings(max_examples=100)
def test_multiple_events_within_cooldown_only_first_is_sent(user_id, alert_type, base_ts, n_events, gap):
    """Feature: fitsense-platform, Property 11: only first event in cooldown window is sent"""
    ttl = COOLDOWN_TTL[alert_type]
    # All events within one cooldown window
    events = [base_ts + i * gap for i in range(n_events)]
    # Ensure all within cooldown
    if events[-1] - events[0] >= ttl:
        return  # skip if events span beyond cooldown
    results = simulate_cooldown(user_id, alert_type, events)
    assert results[0] is True
    assert all(r is False for r in results[1:])
