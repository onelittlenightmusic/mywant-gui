# mywant-gui — the public dashboard, as a container.
#
# Serves the embedded React app and proxies /api and /health to a MyWant
# server (MYWANT_BACKEND). No canvas: that is the mywant-guiex extension, which
# this image does not carry. Built for linux/amd64 and linux/arm64 by
# .github/workflows/image.yml and published as ghcr.io/<owner>/mywant-gui-public.
# See "Run with Docker" in the README for the compose file that pairs it with
# the MyWant server.

# ---- The web app (Vite → web/dist) ----------------------------------------
# Its output is the same on every platform, so it builds once, natively.
FROM --platform=$BUILDPLATFORM node:22-slim AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- Go build --------------------------------------------------------------
# Cross-compiled on the build platform (CGO off), so arm64 needs no emulation.
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS builder
ARG TARGETOS
ARG TARGETARCH
ARG VERSION=dev
WORKDIR /src
# Modules first for caching: go.mod replaces mywant-gui/web with ./web.
COPY go.mod go.sum ./
COPY web/go.mod ./web/
RUN go mod download
COPY . .
COPY --from=web /src/web/dist ./web/dist
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build \
        -trimpath -ldflags="-s -w -X main.version=${VERSION}" \
        -o /out/mywant-gui ./cmd/mywant-gui

# ---- Runtime ---------------------------------------------------------------
FROM alpine:3.20
RUN apk add --no-cache ca-certificates \
    && adduser -D -u 10001 app
COPY --from=builder /out/mywant-gui /usr/local/bin/mywant-gui
USER app

# Where to proxy /api and /health — the compose service name by default.
# MYWANT_AUTH_PASSWORD (user "mywant", or MYWANT_AUTH_USER) turns on Basic auth;
# set it before the port is reachable from anywhere but this machine.
ENV MYWANT_BACKEND=http://backend:8080
EXPOSE 8080

CMD ["mywant-gui", "start", "--host", "0.0.0.0", "--port", "8080"]
