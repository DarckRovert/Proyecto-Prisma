# Proyecto Prisma

Plataforma de investigación y software en Ciencias Cognitivas y Tecnologías del Aprendizaje (EdTech), orientada a acelerar la adquisición y retención a largo plazo de vocabulario y estructuras en nuevos idiomas (General American English).

---

## Fundamentos Científicos

1. **Recuperación Activa (*Testing Effect*):** Basado en los meta-análisis de Rowland (2014, *Psychol Bull*, PMID 25150680) y Adesope et al. (2017), imponiendo ciclos de recuperación forzada con retroalimentación inmediata correctiva.
2. **Modelo de Memoria FSRS-7:** Integración del modelo probabilístico *Free Spaced Repetition Scheduler* (FSRS-7) a través de `ts-fsrs` v6, con calibración dinámica de estabilidad y dificultad.
3. **Dual-Coding y Control de Sesgo Metacognitivo:** Implementación de anclajes visuales y fonéticos sincrónicos con evaluación del Juicio de Aprendizaje (JOL) para mitigar la sobreconfianza ilusoria (Carpenter & Olson 2012, *JEP:LMC*, PMID 21787105).
4. **Sincronización Audiovisual Sub-Frame:** Alineación temporal en hardware clock (`AudioContext.currentTime`) compensando `baseLatency` y `outputLatency` hacia fotogramas de Canvas 2D.
5. **Filtrado Léxico Computacional:** Selección de vocabulario mediante compuertas de concreción ($\ge 4.0$, Brysbaert et al. 2014), frecuencia Zipf ($2.5 - 4.2$, SUBTLEX-US) y eliminación algorítmica de cognados con el español por distancia Levenshtein.

---

## Arquitectura y Stack Tecnológico

- **Frontend:** TypeScript, Vite, Canvas 2D con aceleración gráfica por hardware.
- **Audio Core:** Web Audio API nativo con `AudioWorkletNode` para síntesis de ruido rosa (filtro Paul Kellet -3 dB/oct) y osciladores estéreo en fase para pulsos binaurales beta a 20 Hz.
- **Persistencia Local:** IndexedDB mediante Dexie.js (arquitectura 100% offline-first soberana).
- **Algoritmo SRS:** `ts-fsrs` v6 (FSRS-7) con calificación objetiva automática derivada de percentiles de latencia de respuesta ($P_{25}$ y $P_{75}$).
- **Telemetría:** Exportación atómica a JSON para modelado lineal mixto (GLMM) en Python.

---

## Instalación y Ejecución Local

### Prerrequisitos
- Node.js $\ge 24.0.0$ (probado en Node v26)
- Python 3.11+

### Pasos
```bash
# 1. Clonar repositorio
git clone https://github.com/DarckRovert/proyecto-prisma.git
cd proyecto-prisma

# 2. Instalar dependencias
npm install

# 3. Iniciar entorno de desarrollo
npm run dev
# Abrir en el navegador: http://localhost:3000/
```

### Pruebas Soberanas (Costo $0.00)
Toda la suite de pruebas se ejecuta de forma local sin depender de minutos de pago en la nube:
```cmd
run_tests.bat
```

---

## Estructura del Proyecto

```
├── data/               # Baterías de pseudopalabras y datasets léxicos
├── docs/               # Protocolo de pre-registro científico formal
├── public/             # AudioWorklets y recursos estáticos
├── scripts/            # Generadores fonotácticos, filtros y análisis estadístico
├── src/
│   ├── audio-engine.ts # Motor Web Audio API de alta precisión
│   ├── visual-renderer.ts # Renderizador Canvas sincronizado
│   ├── db.ts           # Capa de base de datos Dexie (IndexedDB)
│   ├── fsrs-engine.ts  # Adaptador FSRS-7 y calificación objetiva
│   ├── session-engine.ts # Orquestador del ciclo de sesión e interleaving
│   ├── main.ts         # Controlador de la interfaz de usuario
│   └── types.ts        # Definiciones de tipos TypeScript
└── tests/              # Pruebas unitarias de Python y scripts soberanos
```

---

## Pre-registro y Licencia

El diseño de los experimentos 1, 2 y 3 se encuentra congelado en [`docs/PREREGISTRATION.md`](docs/PREREGISTRATION.md).  
Licencia: MIT.
