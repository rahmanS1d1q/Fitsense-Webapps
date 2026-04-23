"""
Unit tests untuk SessionAnalyzer
Requirements: 12.8
"""

from models.hr_analyzer import generate_recommendations


class TestSessionAnalyzer:
    def test_no_sessions_returns_empty_recommendations(self):
        """Data < 1 sesi historis → tidak simpan rekomendasi. Requirements: 12.8"""
        result = generate_recommendations([])
        assert result == []

    def test_single_session_no_peak_zone_no_recommendation(self):
        sessions = [{"avg_hr": 120, "hr_zone": "cardio", "duration_minutes": 30}]
        result = generate_recommendations(sessions)
        # No peak zone, no decrease, no fat_burn < 20 min
        assert not any(r["rule"] == "reduce_intensity" for r in result)

    def test_three_peak_sessions_recommends_reduce_intensity(self):
        """Last 3 sessions in peak → reduce intensity. Requirements: 12.2"""
        sessions = [
            {"avg_hr": 180, "hr_zone": "peak", "duration_minutes": 45},
            {"avg_hr": 175, "hr_zone": "peak", "duration_minutes": 40},
            {"avg_hr": 178, "hr_zone": "peak", "duration_minutes": 42},
        ]
        result = generate_recommendations(sessions)
        assert any(r["rule"] == "reduce_intensity" for r in result)

    def test_decreasing_avg_hr_recommends_increase_intensity(self):
        """avg HR decreasing → increase intensity. Requirements: 12.3"""
        sessions = [
            {"avg_hr": 100, "hr_zone": "cardio", "duration_minutes": 30},  # recent (lower)
            {"avg_hr": 140, "hr_zone": "aerobic", "duration_minutes": 35},  # older (higher)
        ]
        result = generate_recommendations(sessions)
        assert any(r["rule"] == "increase_intensity" for r in result)

    def test_fat_burn_less_than_20min_recommends_extend(self):
        """fat_burn duration < 20 min → extend fat burn. Requirements: 12.4"""
        sessions = [{"avg_hr": 110, "hr_zone": "fat_burn", "duration_minutes": 15}]
        result = generate_recommendations(sessions)
        assert any(r["rule"] == "extend_fat_burn" for r in result)

    def test_fat_burn_20min_or_more_no_extend_recommendation(self):
        sessions = [{"avg_hr": 110, "hr_zone": "fat_burn", "duration_minutes": 25}]
        result = generate_recommendations(sessions)
        assert not any(r["rule"] == "extend_fat_burn" for r in result)
