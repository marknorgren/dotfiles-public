FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG DENO_VERSION=2.7.14
# Keep this in sync with bin/devcontainer-stack.
ARG JUST_VERSION=1.51.0

ENV DEBIAN_FRONTEND=noninteractive
ENV DENO_INSTALL=/usr/local
ENV MISE_INSTALL_PATH=/usr/local/bin/mise

COPY packages/apt.txt /tmp/dotfiles-apt.txt

RUN rm -f /etc/apt/sources.list.d/yarn.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    gitleaks \
    shellcheck \
    sudo \
    $(grep -Ev '^\s*(#|$)' /tmp/dotfiles-apt.txt) \
  && rm -rf /var/lib/apt/lists/*

RUN case "$(uname -m)" in \
      x86_64) just_target="x86_64-unknown-linux-musl"; just_sha="c8f085ca3e885723c341d06243fc291b5abfdc8bbe3b2c076b117de490387b59" ;; \
      aarch64|arm64) just_target="aarch64-unknown-linux-musl"; just_sha="ed7ec466b77709198fd4afed253dba0270203ba5eb1c006bee2b0139090284f5" ;; \
      *) echo "unsupported architecture for just: $(uname -m)" >&2; exit 1 ;; \
    esac \
  && curl -fsSLO "https://github.com/casey/just/releases/download/${JUST_VERSION}/just-${JUST_VERSION}-${just_target}.tar.gz" \
  && echo "${just_sha}  just-${JUST_VERSION}-${just_target}.tar.gz" | sha256sum -c - \
  && tar -xzf "just-${JUST_VERSION}-${just_target}.tar.gz" just \
  && install -m 0755 just /usr/local/bin/just \
  && rm -f just "just-${JUST_VERSION}-${just_target}.tar.gz"

RUN curl -fsSL https://deno.land/install.sh | sh -s "v${DENO_VERSION}"
RUN curl -fsSL https://starship.rs/install.sh | sh -s -- -y -b /usr/local/bin
RUN curl -fsSL https://mise.run | sh
