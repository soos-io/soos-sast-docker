FROM node:22-slim AS base

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-venv \
        python3-pip \
        pipx \
        curl \
        git \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN pipx ensurepath

RUN python3 -m pipx install sonar-tools
RUN python3 -m pipx install semgrep

RUN groupadd --system soos && useradd --system --create-home --gid soos soos

RUN mkdir -p /home/soos/wrk && chown -R soos:soos /home/soos/wrk && chmod -R 770 /home/soos/wrk

WORKDIR /home/soos/app

COPY --chown=soos:soos ./src/ ./src/
COPY ./tsconfig.json ./
COPY ./package.json ./
COPY ./package-lock.json ./
RUN npm ci && npm run build

USER soos

ENTRYPOINT ["node", "--no-deprecation", "dist/index.js"]