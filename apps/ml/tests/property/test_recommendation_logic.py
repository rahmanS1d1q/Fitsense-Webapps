# Feature: fitsense-platform, Property 15: Rekomendasi ML — Konsistensi Logika

"""
Property 15: Rekomendasi ML — Konsistensi Logika

For any session history with specific HR patterns, ML_Service must generate
recommendations consistent with the defined rules.

Validates: Requirements 12.2, 12.3, 12.4
"""

from hypothesis import given, settings, assume
from hypothesis import strategies as st
from models.hr_analyzer import generate_recommendations


session_strategy = st.fixed_dictionaries({
    "avg_hr": st.integers(min_value=60, max_value=200),
    "hr_zone": st.sampled_from(["rest", "fat_burn", "cardio", "aerobic", "peak"]),
    "duration_minutes": st.integers(min_value=5, max_value=120),
})


@given(
    sessions=st.lists(session_strategy, min_size=3, max_size=5),
)
@settings(max_examples=100)
def test_three_peak_sessions_always_recommends_reduce_intensity(sessions):
    """Feature: fitsense-platform, Property 15: 3 peak sessions → reduce intensity"""
    # Force first 3 sessions to be peak zone
    for i in range(3):
        sessions[i] = {**sessions[i], "hr_zone": "peak"}

    result = generate_recommendations(sessions)
    assert any(r["rule"] == "reduce_intensity" for r in result)


@given(
    recent_hr=st.integers(min_value=60, max_value=130),
    older_hr=st.integers(min_value=131, max_value=200),
)
@settings(max_examples=100)
def test_decreasing_hr_always_recommends_increase_intensity(recent_hr, older_hr):
    """Feature: fitsense-platform, Property 15: decreasing HR → increase intensity"""
    assume(recent_hr < older_hr)
    sessions = [
        {"avg_hr": recent_hr, "hr_zone": "cardio", "duration_minutes": 30},
        {"avg_hr": older_hr, "hr_zone": "aerobic", "duration_minutes": 35},
    ]
    result = generate_recommendations(sessions)
    assert any(r["rule"] == "increase_intensity" for r in result)


@given(
    duration=st.integers(min_value=1, max_value=19),
)
@settings(max_examples=100)
def test_fat_burn_less_than_20min_always_recommends_extend(duration):
    """Feature: fitsense-platform, Property 15: fat_burn < 20 min → extend"""
    sessions = [{"avg_hr": 110, "hr_zone": "fat_burn", "duration_minutes": duration}]
    result = generate_recommendations(sessions)
    assert any(r["rule"] == "extend_fat_burn" for r in result)


@given(
    duration=st.integers(min_value=20, max_value=120),
)
@settings(max_examples=100)
def test_fat_burn_20min_or_more_never_recommends_extend(duration):
    """Feature: fitsense-platform, Property 15: fat_burn >= 20 min → no extend"""
    sessions = [{"avg_hr": 110, "hr_zone": "fat_burn", "duration_minutes": duration}]
    result = generate_recommendations(sessions)
    assert not any(r["rule"] == "extend_fat_burn" for r in result)


@given(
    sessions=st.lists(session_strategy, min_size=0, max_size=0),
)
@settings(max_examples=100)
def test_empty_sessions_returns_no_recommendations(sessions):
    """Feature: fitsense-platform, Property 15: empty sessions → no recommendations"""
    result = generate_recommendations(sessions)
    assert result == []
