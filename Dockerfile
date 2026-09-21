FROM node:22-bookworm

ARG DEBIAN_FRONTEND=noninteractive

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    SUPABASE_TELEMETRY_DISABLED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        openssh-client \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p "$PLAYWRIGHT_BROWSERS_PATH" /workspace \
    && npx --yes playwright@1.56.0 install --with-deps chromium \
    && chmod -R a+rX "$PLAYWRIGHT_BROWSERS_PATH" \
    && chown node:node /workspace \
    && npm cache clean --force \
    && rm -rf /root/.npm /var/lib/apt/lists/*

WORKDIR /workspace

USER node

EXPOSE 3000

CMD ["bash"]
