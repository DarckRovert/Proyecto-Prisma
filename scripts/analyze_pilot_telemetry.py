"""
╔══════════════════════════════════════════════════════════════════════════════╗
║             PROYECTO PRISMA — ANALIZADOR DE TELEMETRÍA PILOTO                ║
║   Procesa el JSON exportado de IndexedDB, valida consistencia de datos,      ║
║   calcula latencias empíricas (P25, P50, P75) y calibra el grupo control     ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import json
import sys
import os
import math
from typing import Dict, List, Any


def analyze_telemetry_file(file_path: str) -> Dict[str, Any]:
    """Carga y analiza el archivo de exportación de telemetría de Prisma."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Archivo no encontrado: {file_path}")

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    logs: List[Dict[str, Any]] = data.get("logs", [])
    sessions: List[Dict[str, Any]] = data.get("sessions", [])
    cards: List[Dict[str, Any]] = data.get("cards", [])

    if not logs:
        return {
            "status": "empty",
            "message": "El archivo no contiene registros de interacción (logs)."
        }

    # Separar por condición experimental
    active_logs = [l for l in logs if l.get("conditionAssigned") == "prisma_active"]
    passive_logs = [l for l in logs if l.get("conditionAssigned") == "passive_restudy"]

    active_latencies = sorted([l["recallLatencyMs"] for l in active_logs if "recallLatencyMs" in l])
    active_accuracies = [l["recallAccuracy"] for l in active_logs if "recallAccuracy" in l]

    # Cálculo de percentiles para la condición activa
    n_act = len(active_latencies)
    p25 = active_latencies[int(n_act * 0.25)] if n_act > 0 else 0
    p50 = active_latencies[int(n_act * 0.50)] if n_act > 0 else 0
    p75 = active_latencies[int(n_act * 0.75)] if n_act > 0 else 0
    mean_lat = sum(active_latencies) / n_act if n_act > 0 else 0

    acc_rate = (sum(1 for a in active_accuracies if a) / len(active_accuracies)) if active_accuracies else 0.0

    # Metacognición: Análisis JOL vs. Acierto
    jol_acc_pairs = [(l.get("jolRating", 3), l.get("recallAccuracy", False)) for l in active_logs if "jolRating" in l]
    jol_high_acc = [acc for jol, acc in jol_acc_pairs if jol >= 4]
    jol_low_acc = [acc for jol, acc in jol_acc_pairs if jol <= 2]

    overconfidence_signal = False
    if jol_high_acc:
        high_jol_failure_rate = sum(1 for a in jol_high_acc if not a) / len(jol_high_acc)
        # Si falló > 25% de las que creía "seguras" (JOL >= 4), hay sobreconfianza
        if high_jol_failure_rate > 0.25:
            overconfidence_signal = True

    return {
        "status": "ok",
        "total_sessions": len(sessions),
        "total_cards": len(cards),
        "total_logs": len(logs),
        "active_trials_count": len(active_logs),
        "passive_trials_count": len(passive_logs),
        "latency_metrics_ms": {
            "mean": round(mean_lat, 1),
            "median_p50": p50,
            "p25": p25,
            "p75": p75
        },
        "accuracy_rate": round(acc_rate, 3),
        "recommended_control_restudy_duration_ms": max(800, min(3000, round(mean_lat))),
        "metacognition": {
            "overconfidence_detected": overconfidence_signal,
            "high_jol_count": len(jol_high_acc),
            "low_jol_count": len(jol_low_acc)
        }
    }


def print_report(res: Dict[str, Any]):
    """Imprime reporte técnico en consola."""
    print("=" * 70)
    print("           PROYECTO PRISMA — REPORTE DE TELEMETRÍA PILOTO")
    print("=" * 70)
    if res.get("status") != "ok":
        print(f"Error: {res.get('message')}")
        return

    print(f"• Total Sesiones Registradas:      {res['total_sessions']}")
    print(f"• Total Tarjetas FSRS Activas:     {res['total_cards']}")
    print(f"• Total Interacciones:             {res['total_logs']}")
    print(f"    - Condición Prisma Activo:     {res['active_trials_count']}")
    print(f"    - Condición Re-estudio Pasivo: {res['passive_trials_count']}")
    print("-" * 70)
    lat = res["latency_metrics_ms"]
    print(f"• Métricas de Latencia en Recuperación Activa:")
    print(f"    - Media:                       {lat['mean']} ms")
    print(f"    - Mediana (P50):               {lat['median_p50']} ms")
    print(f"    - Percentil 25 (Fluidez alta): {lat['p25']} ms")
    print(f"    - Percentil 75 (Vacilación):   {lat['p75']} ms")
    print(f"• Tasa de Acierto Global:          {res['accuracy_rate'] * 100:.1f} %")
    print(f"• Duración Calibrada para Control: {res['recommended_control_restudy_duration_ms']} ms")
    print(f"• Señal de Sobreconfianza JOL:     {'DETECTADA (E3)' if res['metacognition']['overconfidence_detected'] else 'Normal / Calibrada'}")
    print("=" * 70)


if __name__ == "__main__":
    target_file = sys.argv[1] if len(sys.argv) > 1 else "data/sample_pilot_telemetry.json"
    if os.path.exists(target_file):
        report = analyze_telemetry_file(target_file)
        print_report(report)
    else:
        print(f"Uso: python scripts/analyze_pilot_telemetry.py <ruta_archivo_telemetria.json>")
