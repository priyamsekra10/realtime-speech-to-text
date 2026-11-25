import asyncio
import json
import sys
import time
import uuid
import wave

import websockets


async def main(path, engine="whisper", host="localhost:8000"):
    w = wave.open(path)
    assert (w.getframerate(), w.getnchannels(), w.getsampwidth()) == (16000, 1, 2), "need 16 kHz mono 16-bit wav"
    pcm = w.readframes(w.getnframes())
    url = f"ws://{host}/ws/transcribe?engine={engine}&client_id={uuid.uuid4()}"

    async with websockets.connect(url) as ws:
        print(await ws.recv())
        t0 = time.time()

        async def talk():
            for i in range(0, len(pcm), 3200):
                await ws.send(pcm[i : i + 3200])
                await asyncio.sleep(0.1)
            await ws.send(json.dumps({"type": "stop"}))

        task = asyncio.create_task(talk())
        async for raw in ws:
            m = json.loads(raw)
            print(f"{time.time() - t0:6.2f}s  {m['type']:8}{m.get('text') or m}")
            if m["type"] in ("done", "error"):
                break
        task.cancel()


asyncio.run(main(*sys.argv[1:]))
