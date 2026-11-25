export type Recorder = { stop: () => void }

const RATE = 16000

export async function record(
  onChunk: (pcm: ArrayBuffer) => void,
  onLevel: (peak: number) => void,
): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })

  let ctx = new AudioContext({ sampleRate: RATE })
  let src: MediaStreamAudioSourceNode
  try {
    src = ctx.createMediaStreamSource(stream)
  } catch {
    await ctx.close()
    ctx = new AudioContext()
    src = ctx.createMediaStreamSource(stream)
  }

  await ctx.audioWorklet.addModule('/pcm-worklet.js')
  const node = new AudioWorkletNode(ctx, 'pcm')
  node.port.onmessage = e => {
    onChunk(e.data.pcm)
    onLevel(e.data.peak)
  }
  const mute = ctx.createGain()
  mute.gain.value = 0
  src.connect(node).connect(mute).connect(ctx.destination)
  if (ctx.state === 'suspended') await ctx.resume()

  return {
    stop() {
      node.port.onmessage = null
      src.disconnect()
      node.disconnect()
      stream.getTracks().forEach(t => t.stop())
      void ctx.close()
    },
  }
}
