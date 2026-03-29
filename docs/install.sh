#!/bin/sh
set -e

REPO="dukex/crewbit"
INSTALL_DIR="${CREWBIT_INSTALL_DIR:-/usr/local/bin}"

detect_platform() {
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  arch=$(uname -m)

  case "$arch" in
    x86_64)        arch="x64" ;;
    aarch64|arm64) arch="arm64" ;;
    *) printf "error: unsupported architecture: %s\n" "$arch" >&2; exit 1 ;;
  esac

  case "$os" in
    darwin|linux) ;;
    *) printf "error: unsupported OS: %s\n" "$os" >&2; exit 1 ;;
  esac

  printf "%s-%s" "$os" "$arch"
}

latest_version() {
  curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' \
    | sed 's/.*"tag_name": *"\(.*\)".*/\1/'
}

main() {
  platform=$(detect_platform)
  version=$(latest_version)
  url="https://github.com/${REPO}/releases/download/${version}/crewbit-${platform}"
  tmp=$(mktemp)

  printf "Installing crewbit %s (%s)...\n" "$version" "$platform"

  curl -fsSL "$url" -o "$tmp"
  chmod +x "$tmp"

  if [ -w "$INSTALL_DIR" ]; then
    mv "$tmp" "${INSTALL_DIR}/crewbit"
  else
    sudo mv "$tmp" "${INSTALL_DIR}/crewbit"
  fi

  printf "\nDone! crewbit installed to %s/crewbit\n" "$INSTALL_DIR"
  printf "Run: crewbit ./your-agent.yaml\n"
}

main
