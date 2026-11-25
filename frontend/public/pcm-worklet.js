const RATE = 16000
const CHUNK = RATE / 10

class Pcm extends AudioWorkletProcessor {
  constructor() {
    super()
    this.step = sampleRate / RATE
    this.pos = 0
    this.out = new Int16Array(CHUNK)
    this.n = 0
    this.peak = 0
  }

  process(inputs) {
    const ch = inputs[0][0]
    if (!ch) return true
    while (this.pos < ch.length) {
      const i = Math.floor(this.pos)
      const a = ch[i]
      const b = ch[Math.min(i + 1, ch.length - 1)]
      const v = Math.max(-1, Math.min(1, a + (b - a) * (this.pos - i)))
      this.out[this.n++] = v * 32767
      this.peak = Math.max(this.peak, Math.abs(v))
      if (this.n === CHUNK) {
        const pcm = this.out.slice().buffer
        this.port.postMessage({ pcm, peak: this.peak }, [pcm])
        this.n = 0
        this.peak = 0
      }
      this.pos += this.step
    }
    this.pos -= ch.length
    return true
  }
}

registerProcessor('pcm', Pcm)
