"""
Pruebas Unitarias de Fase 3 — Verificación del Pipeline de Telemetría Piloto
"""

import unittest
import json
import os
import tempfile
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scripts.analyze_pilot_telemetry import analyze_telemetry_file


class TestPhase3TelemetryAnalysis(unittest.TestCase):

    def setUp(self):
        self.mock_payload = {
            "exportTimestamp": "2026-11-05T22:00:00Z",
            "schemaVersion": 1,
            "totalSessions": 1,
            "totalInteractions": 4,
            "sessions": [{"id": "s1", "totalTrials": 4}],
            "cards": [{"cardId": "c1"}, {"cardId": "c2"}],
            "logs": [
                {
                    "id": "log1",
                    "sessionId": "s1",
                    "stimulusId": "pseudo_001",
                    "conditionAssigned": "prisma_active",
                    "recallLatencyMs": 950,
                    "recallAccuracy": True,
                    "jolRating": 4
                },
                {
                    "id": "log2",
                    "sessionId": "s1",
                    "stimulusId": "pseudo_002",
                    "conditionAssigned": "passive_restudy",
                    "recallLatencyMs": 1500,
                    "recallAccuracy": True,
                    "jolRating": 3
                },
                {
                    "id": "log3",
                    "sessionId": "s1",
                    "stimulusId": "pseudo_003",
                    "conditionAssigned": "prisma_active",
                    "recallLatencyMs": 2400,
                    "recallAccuracy": False,
                    "jolRating": 5  # Declaró alta seguridad y falló -> Sobreconfianza
                },
                {
                    "id": "log4",
                    "sessionId": "s1",
                    "stimulusId": "pseudo_004",
                    "conditionAssigned": "prisma_active",
                    "recallLatencyMs": 720,
                    "recallAccuracy": True,
                    "jolRating": 4
                }
            ]
        }

        self.temp_file = tempfile.NamedTemporaryFile("w", delete=False, suffix=".json", encoding="utf-8")
        json.dump(self.mock_payload, self.temp_file)
        self.temp_file.close()

    def tearDown(self):
        if os.path.exists(self.temp_file.name):
            os.remove(self.temp_file.name)

    def test_telemetry_analysis_metrics(self):
        res = analyze_telemetry_file(self.temp_file.name)
        self.assertEqual(res["status"], "ok")
        self.assertEqual(res["total_sessions"], 1)
        self.assertEqual(res["active_trials_count"], 3)
        self.assertEqual(res["passive_trials_count"], 1)

        # Acierto en condición activa: 2 de 3 aciertos = 66.7%
        self.assertAlmostEqual(res["accuracy_rate"], 0.667, places=2)

        # Latencias activas: [720, 950, 2400]
        # Media = (720 + 950 + 2400) / 3 = 1356.7 ms
        self.assertEqual(res["latency_metrics_ms"]["median_p50"], 950)
        self.assertAlmostEqual(res["latency_metrics_ms"]["mean"], 1356.7, places=1)

        # Duración calibrada recomendada para control
        self.assertEqual(res["recommended_control_restudy_duration_ms"], 1357)

        # Sobreconfianza detectada (falló 1 de 3 de las que creía seguras con JOL >= 4)
        self.assertTrue(res["metacognition"]["overconfidence_detected"])


if __name__ == "__main__":
    unittest.main()
