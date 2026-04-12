FROM python:3.11-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

# Install Playwright system dependencies (Chromium, fonts, libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget gnupg curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Chromium with all required OS deps
RUN playwright install --with-deps chromium

COPY . .
RUN mkdir -p /app/output

EXPOSE 4100

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "4100"]
