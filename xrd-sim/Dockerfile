FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# pymatgen pulls numpy/scipy/spglib and is the only heavy dependency here.
RUN pip install --no-cache-dir pymatgen "fastapi>=0.115,<1" "uvicorn>=0.32,<1"

COPY main.py .

RUN useradd --system --uid 10001 --create-home xrd && chown -R xrd:xrd /app
USER xrd

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status==200 else 1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "warning"]
