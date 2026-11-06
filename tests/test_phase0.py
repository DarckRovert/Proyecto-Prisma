"""
Pruebas Unitarias de Fase 0 — Verificación de Filtros Léxicos y Pseudopalabras
"""

import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scripts.pseudoword_generator import generate_battery, generate_cvc, REAL_WORDS_SUBSET
from scripts.corpus_filter import (
    levenshtein_distance,
    normalized_similarity,
    is_cognate,
    evaluate_lexical_candidate
)


class TestPseudowordGenerator(unittest.TestCase):

    def test_battery_generation_count_and_uniqueness(self):
        battery = generate_battery(n_items=50, master_seed=12345)
        self.assertEqual(len(battery), 50)
        
        words = [b["text"] for b in battery]
        self.assertEqual(len(words), len(set(words)), "No debe haber duplicados en la batería")

    def test_battery_determinism(self):
        b1 = generate_battery(n_items=20, master_seed=999)
        b2 = generate_battery(n_items=20, master_seed=999)
        self.assertEqual(b1, b2, "La misma semilla debe producir exactamente la misma lista")

    def test_no_collision_with_real_words(self):
        battery = generate_battery(n_items=100, master_seed=42)
        for item in battery:
            self.assertNotIn(item["text"], REAL_WORDS_SUBSET)
            self.assertTrue(item["ipa"].startswith("/") and item["ipa"].endswith("/"))


class TestCorpusFilter(unittest.TestCase):

    def setUp(self):
        self.sample_spanish_lexicon = [
            "hospital", "animal", "actor", "familia", "accion", "accion", "casa", "perro", "yunque", "llave"
        ]

    def test_levenshtein_basics(self):
        self.assertEqual(levenshtein_distance("kitten", "sitting"), 3)
        self.assertEqual(levenshtein_distance("same", "same"), 0)
        self.assertEqual(levenshtein_distance("", "test"), 4)

    def test_cognate_detection_direct(self):
        self.assertTrue(is_cognate("hospital", self.sample_spanish_lexicon))
        self.assertTrue(is_cognate("animal", self.sample_spanish_lexicon))
        self.assertTrue(is_cognate("creation", self.sample_spanish_lexicon)) # sufijo -tion

    def test_non_cognate_passing(self):
        self.assertFalse(is_cognate("wrench", self.sample_spanish_lexicon))
        self.assertFalse(is_cognate("anvil", self.sample_spanish_lexicon))

    def test_evaluate_candidate_gates(self):
        # Caso 1: Aprobado (Concreto, frecuencia media, no cognado)
        cand_ok = evaluate_lexical_candidate(
            word="wrench",
            concreteness=4.85,
            zipf_freq=3.20,
            spanish_reference_lexicon=self.sample_spanish_lexicon
        )
        self.assertTrue(cand_ok["approved"])
        self.assertEqual(len(cand_ok["reasons"]), 0)

        # Caso 2: Rechazado por baja concreción (abstracto)
        cand_abstract = evaluate_lexical_candidate(
            word="freedom",
            concreteness=2.30,
            zipf_freq=3.50,
            spanish_reference_lexicon=self.sample_spanish_lexicon
        )
        self.assertFalse(cand_abstract["approved"])
        self.assertTrue(any("Concreción" in r for r in cand_abstract["reasons"]))

        # Caso 3: Rechazado por cognado
        cand_cognate = evaluate_lexical_candidate(
            word="actor",
            concreteness=4.70,
            zipf_freq=3.80,
            spanish_reference_lexicon=self.sample_spanish_lexicon
        )
        self.assertFalse(cand_cognate["approved"])
        self.assertTrue(any("Cognado" in r for r in cand_cognate["reasons"]))


if __name__ == "__main__":
    unittest.main()
