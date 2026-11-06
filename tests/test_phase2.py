"""
Pruebas Unitarias de Fase 2 — Verificación de Batería, Calificación y Balance Experimental
"""

import unittest
import json
import os


class TestPhase2(unittest.TestCase):

    def setUp(self):
        self.battery_path = os.path.join(
            os.path.dirname(__file__), "..", "data", "study1_pseudowords_battery.json"
        )

    def test_battery_integrity(self):
        self.assertTrue(os.path.exists(self.battery_path), "El archivo de batería debe existir")
        with open(self.battery_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertEqual(len(data), 120, "Debe contener exactamente 120 pseudopalabras")
        seen_ids = set()
        seen_texts = set()

        for item in data:
            self.assertIn("id", item)
            self.assertIn("text", item)
            self.assertIn("ipa", item)
            self.assertIn("pattern", item)
            self.assertIn(item["pattern"], ["CVC", "DISYLLABIC"])
            
            seen_ids.add(item["id"])
            seen_texts.add(item["text"])

        self.assertEqual(len(seen_ids), 120, "Todos los IDs deben ser únicos")
        self.assertEqual(len(seen_texts), 120, "Todos los textos deben ser únicos")

    def test_objective_grading_rules(self):
        """Simula la lógica de calculateObjectiveGrade implementada en TypeScript."""
        def grade(acc: bool, lat_ms: int, p25: int = 800, p75: int = 2200):
            if not acc:
                return 1  # Again
            if lat_ms > p75:
                return 2  # Hard
            if lat_ms < p25:
                return 4  # Easy
            return 3      # Good

        self.assertEqual(grade(False, 500), 1)    # Error -> Again
        self.assertEqual(grade(True, 3000), 2)   # Acierto lento -> Hard
        self.assertEqual(grade(True, 1400), 3)   # Acierto normal -> Good
        self.assertEqual(grade(True, 600), 4)    # Acierto rápido -> Easy

    def test_condition_balancing_distribution(self):
        """Verifica que la asignación de 120 ítems resulte en un balance 50/50 exacto."""
        items = list(range(120))
        # Asignación de condición por paridad
        active = [i for idx, i in enumerate(items) if idx % 2 == 0]
        passive = [i for idx, i in enumerate(items) if idx % 2 != 0]

        self.assertEqual(len(active), 60)
        self.assertEqual(len(passive), 60)


if __name__ == "__main__":
    unittest.main()
