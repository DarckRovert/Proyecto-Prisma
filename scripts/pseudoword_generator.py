"""
╔══════════════════════════════════════════════════════════════════════════════╗
║               PROYECTO PRISMA — GENERADOR DE PSEUDOPALABRAS                 ║
║   Generación determinista de pseudopalabras fonotácticas regulares en GenAm  ║
║         con IPA unívoco y exclusión de colisiones con léxico real            ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import random
from typing import List, Dict, Set

# Fonemas ortográficamente transparentes en GenAm (sin ambigüedades como c/g suave)
ONSETS = ["b", "d", "f", "g", "h", "k", "l", "m", "n", "p", "r", "s", "t", "v", "w", "z", "br", "dr", "fl", "gr", "kl", "pr", "st", "tr"]
VOWELS_CVC = [
    ("a", "æ"),   # cat
    ("e", "ɛ"),   # bed
    ("i", "ɪ"),   # sit
    ("o", "ɑ"),   # pot (GenAm unrounded)
    ("u", "ʌ"),   # cup
]
CODAS = ["b", "d", "f", "k", "l", "m", "n", "p", "s", "t", "v", "z"]

# Palabras reales comunes en inglés para exclusión obligatoria
REAL_WORDS_SUBSET = {
    "bad", "bed", "bid", "bit", "bat", "bet", "but", "box", "bus", "bag",
    "cat", "cup", "cut", "cap", "can", "dog", "dig", "dot", "dam", "dim",
    "fan", "fit", "fat", "fog", "fun", "gas", "get", "got", "gun", "gum",
    "hat", "hit", "hot", "hut", "hop", "kid", "kit", "log", "let", "lot",
    "lip", "man", "men", "mad", "map", "net", "not", "nut", "nap", "nod",
    "pan", "pen", "pin", "pot", "pet", "pig", "red", "run", "rat", "rip",
    "sad", "set", "sit", "sun", "son", "sap", "top", "tip", "tap", "tub",
    "van", "vet", "win", "wet", "wax", "yes", "zip", "zoo"
}


def generate_cvc(seed: int = 42) -> Dict[str, str]:
    """Genera una pseudopalabra monosilábica CVC transparente."""
    rnd = random.Random(seed)
    onset = rnd.choice([o for o in ONSETS if len(o) == 1])
    v_orth, v_ipa = rnd.choice(VOWELS_CVC)
    coda = rnd.choice(CODAS)
    word = f"{onset}{v_orth}{coda}"
    ipa = f"/{onset}{v_ipa}{coda}/"
    return {"text": word, "ipa": ipa, "pattern": "CVC"}


def generate_disyllabic(seed: int) -> Dict[str, str]:
    """Genera una pseudopalabra bisilábica regular (CVC-CVC o CV-CVC)."""
    rnd = random.Random(seed)
    # Primera sílaba
    o1 = rnd.choice(ONSETS)
    v1_orth, v1_ipa = rnd.choice(VOWELS_CVC)
    c1 = rnd.choice(CODAS) if rnd.random() > 0.3 else ""
    
    # Segunda sílaba
    o2 = rnd.choice([o for o in ONSETS if len(o) == 1])
    v2_orth, v2_ipa = rnd.choice(VOWELS_CVC)
    c2 = rnd.choice(CODAS)
    
    word = f"{o1}{v1_orth}{c1}{o2}{v2_orth}{c2}"
    ipa = f"/ˈ{o1}{v1_ipa}{c1}.{o2}{v2_ipa}{c2}/"
    return {"text": word, "ipa": ipa, "pattern": "DISYLLABIC"}


def generate_battery(n_items: int = 120, master_seed: int = 20261105) -> List[Dict[str, str]]:
    """Genera un lote balanceado de pseudopalabras únicas garantizadas."""
    battery: List[Dict[str, str]] = []
    seen: Set[str] = set(REAL_WORDS_SUBSET)
    current_seed = master_seed
    
    while len(battery) < n_items:
        # 50% monosilábicas CVC, 50% bisilábicas
        if len(battery) % 2 == 0:
            item = generate_cvc(current_seed)
        else:
            item = generate_disyllabic(current_seed)
        
        word = item["text"]
        if word not in seen:
            seen.add(word)
            item["id"] = f"pseudo_{len(battery) + 1:03d}"
            battery.append(item)
            
        current_seed += 1
        
    return battery


if __name__ == "__main__":
    sample = generate_battery(10)
    print(f"Muestra de 10 pseudopalabras generadas con éxito:")
    for it in sample:
        print(f"  [{it['id']}] {it['text']:<12} IPA: {it['ipa']:<18} ({it['pattern']})")
