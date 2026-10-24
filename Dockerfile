FROM node:20-bookworm-slim

# ca-certificates: HTTPS downloads by setup and Tectonic; fontconfig: font lookup for XeLaTeX.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates fontconfig \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Download Tectonic (Linux build) and the browser libraries.
COPY package.json ./
COPY scripts ./scripts
RUN node scripts/setup.js

# Pre-download LaTeX formats and common packages into the image, so the first
# compile on the server takes seconds instead of several minutes.
RUN mkdir /tmp/warmup \
 && cp scripts/warmup.tex scripts/warmup.bib /tmp/warmup/ \
 && cd /tmp/warmup \
 && /app/bin/tectonic -X compile warmup.tex \
 && rm -rf /tmp/warmup

COPY . .

ENV NODE_ENV=production HOST=0.0.0.0 PORT=10000
EXPOSE 10000
CMD ["node", "server.js"]
