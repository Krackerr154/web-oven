from fastapi import FastAPI

app = FastAPI(title="XRD Compute Engine", version="1.0.0")

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
