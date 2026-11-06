# Documento de Pre-registro Científico — Proyecto Prisma

**Fecha de Congelamiento:** 2026-11-05T21:55:00-05:00  
**Estado:** PROTOCOLO CONGELADO (Pre-data collection)  
**Investigador Principal:** Rodrigo Alejandro Vega Rojas (ORCID: [0009-0002-4337-7767](https://orcid.org/0009-0002-4337-7767))  
**Marco Regulatorio:** Ley 29733 y D.S. 016-2024-JUS (Perú) — Datos de salud excluidos, anonimización por hash.

---

## 1. Justificación y Marco Teórico
Proyecto Prisma investiga la adquisición de vocabulario y estructuras en L2 mediante estimulación audiovisual sincrónica acoplada a recuperación activa forzada (*testing effect*) y modelos modernos de memoria de repetición espaciada (FSRS-7).

La literatura empírica previa establece:
1. **Testing Effect:** Rowland (2014, PMID 25150680) y Adesope et al. (2017) demuestran que la recuperación activa supera a la re-exposición pasiva ($g \approx 0.50$), amplificándose a intervalos $\ge 24\text{ h}$.
2. **Dual-Coding y Sesgo Metacognitivo:** Carpenter & Olson (2012, PMID 21787105) demuestran que las imágenes inducen sobreconfianza ilusoria de aprendizaje; la ventaja de la imagen sobre la traducción solo emerge cuando se fuerza la práctica de recuperación.
3. **FSRS:** El benchmark `srs-benchmark` (10 000 colecciones) demuestra que FSRS-7 minimiza el Log Loss a $\sim 0.337$ frente a algoritmos heurísticos tradicionales.

---

## 2. Programa Experimental

### 2.1 Estudio 1: Ciclo Prisma vs. Re-estudio Pasivo de Tiempo Igualado
- **Pregunta:** ¿El ciclo de exposición audiovisual sincronizada seguido de recuperación activa obligatoria produce una retención a 7 días superior a la re-exposición audiovisual pasiva de igual duración temporal?
- **Diseño:** Intra-sujeto N=1 con $\ge 120$ pseudopalabras fonotácticamente regulares en GenAm.
- **Condición A (Prisma Activo):** Exposición AV ($2500\text{ ms}$) $\rightarrow$ buffer fonológico ($800\text{ ms}$) $\rightarrow$ test de recuperación diferida (lag 2–4 ítems) con feedback correctivo inmediato ($200\text{ ms}$).
- **Condición B (Control Pasivo Tiempo-Igualado):** Exposición AV ($2500\text{ ms}$) $\rightarrow$ buffer fonológico ($800\text{ ms}$) $\rightarrow$ re-exposición pasiva idéntica cuya duración equivale exactamente a la media de tiempo de respuesta de la Condición A medida en la fase piloto.
- **Asignación:** Aleatoria por ítem mediante generador PRNG con semilla fija registrada; el sujeto no conoce la condición del ítem hasta el momento del test/re-estudio.
- **Variables Dependientes:**
  - Tasa de recuerdo libre correcto a las 24 horas y a los 7 días.
  - Latencia de recuperación (milisegundos desde la presentación del estímulo hasta la primera interacción).
  - Juicio de Aprendizaje (JOL, escala Likert 1–5).
- **Análisis Estadístico:**
  $$\text{logit}(P(\text{Acierto}_{ij})) = \beta_0 + \beta_1 \cdot \text{Condición}_j + u_{0i} + e_{ij}$$
  Modelo mixto logístico con efectos aleatorios por ítem ($u_{0i}$).
- **Criterio de Rechazo de $H_0$:** $\beta_1 > 0$ con $p < 0.05$ (unilateral a favor de Condición A).

### 2.2 Estudio 2: Sincronía Temporal Audiovisual
- **Pregunta:** ¿Una ventana de sincronía audiovisual estricta ($\text{SOA} = 0\text{ ms}$, $|\Delta t| < 20\text{ ms}$) mejora la retención léxica frente a una presentación desincronizada fuera de la ventana de integración temporal ($\text{SOA} = +400\text{ ms}$)?
- **Sujeto:** Sujeto externo ciego (Profesor de inglés o colaborador externo sin conocimiento de la hipótesis).
- **Condiciones:**
  - Condición Sincronizada: Offset temporal audio-imagen corregido por latencia de hardware ($< 20\text{ ms}$).
  - Condición Asincrónica: Audio diferido $+400\text{ ms}$ respecto al fotograma de Canvas.

### 2.3 Estudio 3: Audio Ambiental de Enfoque
- **Pregunta:** ¿La presencia de ruido rosa continuo estacionario o estimulación binaural beta (20 Hz) aplicada en pre-sesión afecta la tasa de retención frente al silencio acústico?
- **Sujeto:** Sujeto externo ciego (mismo o similar a Estudio 2). Auriculares estéreo verificados mediante test de canal L/R antes de iniciar.
- **Condiciones:** Silencio vs. Ruido Rosa (-18 dB LUFS) vs. Tono Binaural Beta 20 Hz pre-sesión.

---

## 3. Criterios de Exclusión de Datos
1. Ensayos con interrupción externa evidente (latencia de respuesta $> 15\text{ segundos}$).
2. Ensayos donde el delta de sincronización estimado por software supere los $\pm 40\text{ ms}$ debido a caídas de fotogramas del sistema operativo.
3. Ensayos donde el usuario reporte haber visto previamente la pseudopalabra o haber asociado un cognado no previsto en el pre-test.

---

## 4. Compromiso de Transparencia y Decisión
Si en el **Estudio 1** la hipótesis nula no es rechazada ($p \ge 0.05$ o $\beta_1 \le 0$), se publicará el reporte negativo en el repositorio y se congelará el desarrollo de interfaces comerciales hasta reformular el mecanismo de codificación.
