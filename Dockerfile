FROM node:22-slim AS base

ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=C.UTF-8
ENV LANGUAGE=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV PYTHONUTF8=1

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-venv \
        python3-pip \
        pipx \
        curl \
        wget \
        git \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system soos && useradd --system --create-home --gid soos soos
RUN mkdir -p /home/soos/wrk && chown -R soos:soos /home/soos/wrk && chmod -R 770 /home/soos/wrk
RUN mkdir -p /home/soos/out && chown -R soos:soos /home/soos/out && chmod -R 770 /home/soos/out

USER soos
WORKDIR /home/soos

RUN pipx ensurepath

# Gitleaks
RUN curl -s https://api.github.com/repos/gitleaks/gitleaks/releases/latest \
    | grep "browser_download_url.*linux_x64\.tar\.gz" \
    | cut -d '"' -f 4 \
    | wget -qi - -O gitleaks.tar.gz \
    && tar -xzf gitleaks.tar.gz && rm gitleaks.tar.gz

# Semgrep
RUN python3 -m pipx install semgrep

# SonarQube
RUN python3 -m pipx install sonar-tools

# Opengrep
RUN curl -fsSL https://raw.githubusercontent.com/opengrep/opengrep/main/install.sh | bash
RUN git clone https://github.com/opengrep/opengrep-rules.git /home/soos/opengrep-rules
WORKDIR /home/soos/opengrep-rules
RUN rm -rf .git .github .pre-commit-config.yaml && find . -type f -not -iname "*.yaml" -delete
WORKDIR /home/soos

# SOOS
COPY --chown=soos:soos ./src/ ./src/
COPY ./tsconfig.json ./
COPY ./package.json ./
COPY ./package-lock.json ./
RUN npm ci && npm run build && rm -rf ./src

ENTRYPOINT ["node", "--no-deprecation", "dist/index.js"]