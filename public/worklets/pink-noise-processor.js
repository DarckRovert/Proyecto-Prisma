/**
 * PinkNoiseProcessor — AudioWorkletNode implementation
 * Generador de ruido rosa procedural estacionario basado en el algoritmo de Paul Kellet (-3 dB/octave).
 * Corre aislado en el hilo de renderizado de audio para cero interrupción por el Event Loop.
 */
class PinkNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Coeficientes de filtro IIR (Voss-Kellet)
    this.b0 = 0.0;
    this.b1 = 0.0;
    this.b2 = 0.0;
    this.b3 = 0.0;
    this.b4 = 0.0;
    this.b5 = 0.0;
    this.b6 = 0.0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const channelLeft = output[0];
    const channelRight = output.length > 1 ? output[1] : null;

    for (let i = 0; i < channelLeft.length; i++) {
      const white = Math.random() * 2.0 - 1.0;

      this.b0 = 0.99886 * this.b0 + white * 0.0555179;
      this.b1 = 0.99332 * this.b1 + white * 0.0750759;
      this.b2 = 0.96900 * this.b2 + white * 0.153852;
      this.b3 = 0.86650 * this.b3 + white * 0.3104856;
      this.b4 = 0.55000 * this.b4 + white * 0.5329522;
      this.b5 = -0.76160 * this.b5 - white * 0.016898;
      
      const pink = (this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + white * 0.5362) * 0.08;
      this.b6 = white * 0.115926;

      channelLeft[i] = pink;
      if (channelRight) {
        channelRight[i] = pink;
      }
    }

    return true;
  }
}

registerProcessor('pink-noise-processor', PinkNoiseProcessor);
