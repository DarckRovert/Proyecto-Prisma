"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                PROYECTO PRISMA — FILTRO DE CORPUS LÉXICO                     ║
║   Compuertas científicas para selección de vocabulario inglés:               ║
║   1. Concreción (Brysbaert >= 4.0)                                           ║
║   2. Frecuencia Zipf (SUBTLEX-US 2.5 a 4.2)                                  ║
║   3. Detección y eliminación algorítmica de cognados Español-Inglés          ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

from typing import List, Dict, Optional


def levenshtein_distance(s1: str, s2: str) -> int:
    """Calcula la distancia de edición básica entre dos cadenas."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)

    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


def normalized_similarity(en_word: str, es_word: str) -> float:
    """Retorna similitud ortográfica normalizada entre 0.0 y 1.0."""
    max_len = max(len(en_word), len(es_word))
    if max_len == 0:
        return 1.0
    dist = levenshtein_distance(en_word.lower(), es_word.lower())
    return 1.0 - (dist / max_len)


# Sufijos cognados característicos Español-Inglés
COGNATE_SUFFIX_PAIRS = [
    ("tion", "cion"),
    ("tion", "ción"),
    ("ty", "dad"),
    ("al", "al"),
    ("ic", "ico"),
    ("ous", "oso"),
    ("ble", "ble"),
    ("ment", "mento"),
]


def is_obvious_cognate_morphology(en_word: str) -> bool:
    """Detecta si la palabra posee terminaciones morfológicas cognadas directas."""
    w = en_word.lower()
    for en_sfx, _ in COGNATE_SUFFIX_PAIRS:
        if w.endswith(en_sfx) and len(w) > len(en_sfx) + 2:
            return True
    return False


def is_cognate(en_word: str, spanish_lexicon: List[str], threshold: float = 0.65) -> bool:
    """
    Evalúa si un vocablo inglés es un cognado potencial con el léxico español.
    Retorna True si supera el umbral de similitud o posee morfología transparente.
    """
    if is_obvious_cognate_morphology(en_word):
        return True

    en_clean = en_word.lower()
    for es_word in spanish_lexicon:
        # Optimización: solo comparar palabras de longitud similar
        if abs(len(en_clean) - len(es_word)) <= 3:
            sim = normalized_similarity(en_clean, es_word)
            if sim >= threshold:
                return True
    return False


def evaluate_lexical_candidate(
    word: str,
    concreteness: float,
    zipf_freq: float,
    spanish_reference_lexicon: List[str],
    min_concreteness: float = 4.0,
    min_zipf: float = 2.5,
    max_zipf: float = 4.2,
) -> Dict[str, any]:
    """
    Aplica las 3 compuertas de Prisma para aprobar o rechazar un término.
    """
    passed_concreteness = concreteness >= min_concreteness
    passed_frequency = min_zipf <= zipf_freq <= max_zipf
    is_cog = is_cognate(word, spanish_reference_lexicon)
    
    passed_all = passed_concreteness and passed_frequency and not is_cog
    
    reasons = []
    if not passed_concreteness:
        reasons.append(f"Concreción insuficiente ({concreteness:.2f} < {min_concreteness})")
    if not passed_frequency:
        reasons.append(f"Frecuencia Zipf fuera de rango ({zipf_freq:.2f} not in [{min_zipf}, {max_zipf}])")
    if is_cog:
        reasons.append("Cognado detectado con español")
        
    return {
        "word": word,
        "concreteness": concreteness,
        "zipf": zipf_freq,
        "is_cognate": is_cog,
        "approved": passed_all,
        "reasons": reasons
    }
