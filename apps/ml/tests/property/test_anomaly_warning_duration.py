# Feature: fitsense-platform, Property 10: Deteksi Anomali WARNING — Durasi Zona

"""
Property 10: Deteksi Anomali WARNING — Durasi Zona

For any HR data point with value exceeding 85% of Max_HR and duration
in zone > 10 minutes, ML_Service must detect it as WARNING.

Validates: Requirements 9.3, 9.7
"""

from hypothesis import given, settings, assume
from hypothesis import strategies as st
from models.hr_analyzer import is_warning_duration_anomaly, determine_alert


@given(
    age=st.integers(min_value=10, max_value=80),
    hr_pct=st.floats(min_value=0.851, max_value=0.949, allow_nan=False, allow_infinity=False),
    duration=st.integers(min_value=601, max_value=3600),
)
@settings(max_examples=100)
def test_hr_above_85_and_duration_above_10min_is_always_warning(age, hr_pct, duration):
    """Feature: fitsense-platform, Property 10: Deteksi Anomali WARNING — Durasi Zona"""
    max_hr = 220 - age
    hr = int(max_hr * hr_pct)
    assume(hr > 0 and max_hr > 0)
    assume(hr / max_hr > 0.85)
    assert is_warning_duration_anomaly(hr, max_hr, duration) is True


@given(
    age=st.integers(min_value=10, max_value=80),
    hr_pct=st.floats(min_value=0.851, max_value=0.949, allow_nan=False, allow_infinity=False),
    duration=st.integers(min_value=0, max_value=599),
)
@settings(max_examples=100)
def test_hr_above_85_but_short_duration_is_not_warning(age, hr_pct, duration):
    """Feature: fitsense-platform, Property 10: short duration not WARNING"""
    max_hr = 220 - age
    hr = int(max_hr * hr_pct)
    assume(hr > 0 and max_hr > 0)
    assert is_warning_duration_anomaly(hr, max_hr, duration) is False


@given(
    age=st.integers(min_value=10, max_value=80),
    hr_pct=st.floats(min_value=0.0, max_value=0.849, allow_nan=False, allow_infinity=False),
    duration=st.integers(min_value=601, max_value=3600),
)
@settings(max_examples=100)
def test_hr_below_85_is_never_warning_duration(age, hr_pct, duration):
    """Feature: fitsense-platform, Property 10: HR below 85% never WARNING duration"""
    max_hr = 220 - age
    hr = int(max_hr * hr_pct)
    assume(hr >= 0 and max_hr > 0)
    assert is_warning_duration_anomaly(hr, max_hr, duration) is False
