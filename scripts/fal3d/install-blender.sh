#!/usr/bin/env bash
# Installs official Blender (LTS, Linux x64) into ~/.cache/blender, on demand. Never part of a shared image.
#   bash scripts/fal3d/install-blender.sh      # last line of stdout: a wrapper that runs Blender headless
#   BLENDER_VERSION=4.2.23 bash scripts/fal3d/install-blender.sh
# .bb-env-setup.sh calls this only when FLT_BLENDER=1.
#
# The Modal image lacks libSM, libICE and libGL, which Blender links even in background mode. Rather than apt-installing
# them into the machine (root-only), the script downloads the .debs into the cache and unpacks them there; the wrapper
# points LD_LIBRARY_PATH at them. No system files change.
set -euo pipefail

VERSION="${BLENDER_VERSION:-4.5.14}"
SERIES="${VERSION%.*}"
DEST="${BLENDER_CACHE:-$HOME/.cache/blender}"
DIR="$DEST/blender-$VERSION-linux-x64"
LIBS="$DEST/libs/root"
WRAPPER="$DEST/blender-headless"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "flt: Blender install is for Linux (Modal) only; not running on $(uname -s)." >&2
  exit 1
fi

if [[ ! -x "$DIR/blender" ]]; then
  mkdir -p "$DEST"
  url="https://download.blender.org/release/Blender$SERIES/blender-$VERSION-linux-x64.tar.xz"
  echo "flt: downloading Blender $VERSION (about 360 MB)" >&2
  curl -fSL --retry 3 -o "$DEST/blender-$VERSION.tar.xz" "$url"
  tar -xJf "$DEST/blender-$VERSION.tar.xz" -C "$DEST"
  rm -f "$DEST/blender-$VERSION.tar.xz"
fi

# Shared libraries the image does not ship, unpacked (not installed) from Debian.
if [[ ! -e "$LIBS/usr/lib/x86_64-linux-gnu/libGL.so.1" ]]; then
  tmp="$(mktemp -d)"
  apt_opts=(-o "Dir::State::Lists=$tmp/lists" -o "Dir::Cache=$tmp/cache" -o Debug::NoLocking=1)
  mkdir -p "$tmp/lists/partial" "$tmp/cache/archives/partial" "$LIBS"
  (cd "$tmp" && apt-get "${apt_opts[@]}" update >/dev/null 2>&1 && apt-get "${apt_opts[@]}" download libsm6 libice6 libgl1 libglvnd0 libglx0 >/dev/null 2>&1)
  for deb in "$tmp"/*.deb; do dpkg -x "$deb" "$LIBS"; done
  rm -rf "$tmp"
fi

cat > "$WRAPPER" <<WRAP
#!/usr/bin/env bash
export LD_LIBRARY_PATH="$LIBS/usr/lib/x86_64-linux-gnu\${LD_LIBRARY_PATH:+:\$LD_LIBRARY_PATH}"
exec "$DIR/blender" "\$@"
WRAP
chmod +x "$WRAPPER"

echo "$WRAPPER"
