# Feature: fitsense-platform, Property 9: Deteksi Anomali CRITICAL

"""
Property 9: Deteksi Anomali CRITICAL

For any HR data point with value exceeding 95% of Max_HR,
the anomaly checker must detect it as CRITICAL.

Validates: Requirements 9.2, 9.7
"""

from hypothesis import given, settings, assume
from hypothesis import strategies as st
from models.hr_analyzer import is_critical_anomaly, determine_alert


@given(
    age=st.integers(min_value=10, max_value=80),
    hr_pct=st.floats(min_value=0.951, max_value=1.5, allow_nan=False, allow_infinity=False),
)
@settings(max_examples=100)
def test_hr_above_95_percent_is_always_critical(age, hr_pct):
    """Feature: fitsense-platform, Property 9: Deteksi Anomali CRITICAL"""
    max_hr = 220 - age
    hr = int(max_hr * hr_pct)
    assume(hr > 0 and max_hr > 0)
    # Ensure hr is strictly > 95% of max_hr after int truncation
    assume(hr / max_hr > 0.95)
    assert is_critical_anomaly(hr, max_hr) is True


@given(
    age=st.integers(min_value=10, max_value=80),
    hr_pct=st.floats(min_value=0.0, max_value=0.949, allow_nan=False, allow_infinity=False),
)
@settings(max_examples=100)
def test_hr_below_95_percent_is_never_critical(age, hr_pct):
    """Feature: fitsense-platform, Property 9: Deteksi Anomali CRITICAL"""
    max_hr = 220 - age
    hr = int(max_hr * hr_pct)
    assume(hr >= 0 and max_hr > 0)
    assert is_critical_anomaly(hr, max_hr) is False


@given(
    age=st.integers(min_value=10, max_value=80),
    hr_pct=st.floats(min_value=0.951, max_value=1.5, allow_nan=False, allow_infinity=False),
)
@settings(max_examples=100)
def test_determine_alert_returns_critical_for_high_hr(age, hr_pct):
    """Feature: fitsense-platform, Property 9: determine_alert returns CRITICAL"""
    max_hr = 220 - age
    hr = int(max_hr * hr_pct)
    assume(hr > 0 and max_hr > 0)
    assume(hr / max_hr > 0.95)
    alert_type, _ = determine_alert(hr, max_hr, 0)
    assert alert_type == "CRITICAL"
