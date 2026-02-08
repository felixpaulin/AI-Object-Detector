import asyncio
import websockets
import time

async def handler(websocket):
    print("ESP32 simulator connected")
    async for message in websocket:
        print(f"[{time.strftime('%H:%M:%S')}] ESP32 received:", message)

async def main():
    print("ESP32 simulator running on ws://localhost:8765")
    async with websockets.serve(handler, "localhost", 8765):
        await asyncio.Future()  # keep running forever

asyncio.run(main())
