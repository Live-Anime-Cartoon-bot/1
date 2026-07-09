FROM python:3.11-slim

# ── System dependencies ───────────────────────────────────────────────────────
# ffmpeg/ffprobe  : HLS recording, remuxing, screenshots, compression
# chromium        : stream extraction via playwright (/reclink command)
# curl            : watermark image fetch, debug tooling
# gcc / g++ / libffi / libssl : compile native Python extensions (pycryptodome, curl_cffi)
# The remaining libs are X11/Wayland runtime deps required by Chromium headless.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        chromium \
        curl \
        gcc \
        g++ \
        libffi-dev \
        libssl-dev \
        libnss3 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libdrm2 \
        libxkbcommon0 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxrandr2 \
        libgbm1 \
        libasound2 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

# ── Python dependencies ───────────────────────────────────────────────────────
WORKDIR /app
COPY bot/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# ── Playwright — use system Chromium, skip the 300 MB bundled download ────────
# PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH tells playwright to launch /usr/bin/chromium
# instead of its own bundled binary.  We still run install-deps so playwright
# can verify all shared-library requirements are met.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
RUN playwright install-deps chromium

# ── Bot source ────────────────────────────────────────────────────────────────
COPY bot/ ./

# ── Persistent data directories (mount volumes here in production) ────────────
# /app/assets/data  : encrypted JioTV credentials, session state
# /app/downloads    : in-progress recordings, completed files before upload
RUN mkdir -p /app/assets/data /app/downloads

# ── Runtime user (non-root for security hardening) ───────────────────────────
RUN groupadd -r botuser && useradd -r -g botuser -d /app botuser \
    && chown -R botuser:botuser /app
USER botuser

# ── Environment ───────────────────────────────────────────────────────────────
# Override at runtime via: docker run --env-file .env  OR  -e KEY=value
# See bot/.env.example for all required variables.

# ── Run ───────────────────────────────────────────────────────────────────────
CMD ["python", "run.py"]
