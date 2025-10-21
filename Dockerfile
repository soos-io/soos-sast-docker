FROM node:22-slim AS base

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-venv \
        python3-pip \
        pipx \
        curl \
        build-essential \
        wget \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system soos && useradd --system --create-home --gid soos soos
RUN mkdir -p /home/soos/wrk && chown -R soos:soos /home/soos/wrk && chmod -R 770 /home/soos/wrk
RUN mkdir -p /home/soos/out && chown -R soos:soos /home/soos/out && chmod -R 770 /home/soos/out

USER soos
WORKDIR /home/soos

RUN pipx ensurepath

RUN curl -s https://api.github.com/repos/gitleaks/gitleaks/releases/latest \
    | grep "browser_download_url.*linux_x64\.tar\.gz" \
    | cut -d '"' -f 4 \
    | wget -qi - -O gitleaks.tar.gz \
    && tar -xzf gitleaks.tar.gz && rm gitleaks.tar.gz
RUN curl -fsSL https://raw.githubusercontent.com/opengrep/opengrep/main/install.sh | bash
RUN python3 -m pipx install sonar-tools
RUN python3 -m pipx install semgrep

COPY --chown=soos:soos ./src/ ./src/
COPY ./tsconfig.json ./
COPY ./package.json ./
COPY ./package-lock.json ./
RUN npm ci && npm run build && rm -rf ./src

ENTRYPOINT ["node", "--no-deprecation", "dist/index.js"]