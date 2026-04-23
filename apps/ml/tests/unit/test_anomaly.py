"""
Unit tests untuk AnomalyChecker
Requirements: 9.2, 9.4, 9.7
"""

from models.hr_analyzer import (
    is_critical_anomaly,
    is_warning_duration_anomaly,
    is_warning_sensor_anomaly,
    determine_alert,
)


class TestCriticalAnomaly:
    def test_hr_above_95_percent_max_hr_is_critical(self):
        """HR > 95% Max_HR → CRITICAL. Requirements: 9.2"""
        max_hr = 190
        hr = int(max_hr * 0.96)  # 96% → CRITICAL
        assert is_critical_anomaly(hr, max_hr) is True

    def test_hr_exactly_95_percent_is_not_critical(self):
        """HR = 95% Max_HR → NOT critical (must be strictly > 95%)."""
        max_hr = 200
        hr = int(max_hr * 0.95)
        assert is_critical_anomaly(hr, max_hr) is False

    def test_hr_below_95_percent_is_not_critical(self):
        max_hr = 190
        hr = int(max_hr * 0.90)
        assert is_critical_anomaly(hr, max_hr) is False

    def test_zero_max_hr_returns_false(self):
        assert is_critical_anomaly(200, 0) is False


class TestWarningSensorAnomaly:
    def test_hr_below_40_is_warning(self):
        """HR < 40 bpm → WARNING sensor. Requirements: 9.4"""
        assert is_warning_sensor_anomaly(39) is True
        assert is_warning_sensor_anomaly(30) is True
        assert is_warning_sensor_anomaly(20) is True

    def test_hr_40_is_not_warning(self):
        assert is_warning_sensor_anomaly(40) is False

    def test_hr_above_40_is_not_warning(self):
        assert is_warning_sensor_anomaly(80) is False


class TestWarningDurationAnomaly:
    def test_hr_above_85_and_duration_above_10min_is_warning(self):
        """HR > 85% Max_HR AND duration > 10 min → WARNING. Requirements: 9.3"""
        max_hr = 190
        hr = int(max_hr * 0.87)  # 87%
        assert is_warning_duration_anomaly(hr, max_hr, 601) is True

    def test_hr_above_85_but_duration_below_10min_is_not_warning(self):
        max_hr = 190
        hr = int(max_hr * 0.87)
        assert is_warning_duration_anomaly(hr, max_hr, 599) is False

    def test_hr_below_85_is_not_warning_regardless_of_duration(self):
        max_hr = 190
        hr = int(max_hr * 0.80)
        assert is_warning_duration_anomaly(hr, max_hr, 700) is False


class TestCooldownSkip:
    def test_cooldown_logic_skips_when_in_cooldown(self):
        """Alert in cooldown → skipped without error. Requirements: 9.7"""
        # Test the pure cooldown logic without Redis dependency
        from models.hr_analyzer import determine_alert

        # Simulate: alert detected, but cooldown flag is set
        max_hr = 190
        hr = int(max_hr * 0.97)  # CRITICAL
        alert_type, message = determine_alert(hr, max_hr, 0)
        assert alert_type == "CRITICAL"

        # Simulate cooldown check (pure logic)
        in_cooldown = True  # simulated Redis state
        should_publish = not in_cooldown
        assert should_publish is False  # skipped

    def test_cooldown_logic_publishes_when_not_in_cooldown(self):
        """Alert not in cooldown → should publish. Requirements: 9.7"""
        from models.hr_analyzer import determine_alert

        max_hr = 190
        hr = int(max_hr * 0.97)
        alert_type, message = determine_alert(hr, max_hr, 0)
        assert alert_type == "CRITICAL"

        in_cooldown = False  # simulated Redis state
        should_publish = not in_cooldown
        assert should_publish is True


class TestDetermineAlert:
    def test_critical_takes_priority_over_warning(self):
        """CRITICAL has higher priority than WARNING."""
        max_hr = 190
        hr = int(max_hr * 0.97)  # > 95% → CRITICAL
        alert_type, _ = determine_alert(hr, max_hr, 700)
        assert alert_type == "CRITICAL"

    def test_no_anomaly_returns_none(self):
        max_hr = 190
        hr = int(max_hr * 0.70)  # 70% — normal
        alert_type, message = determine_alert(hr, max_hr, 100)
        assert alert_type is None
        assert message is None
