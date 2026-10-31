#!/bin/sh
# Downloads alphaTab 1.8.4 from npm and copies the files Setcards uses into lib/.
# Run once before serving the app locally; the Pages workflow runs it on every deploy.
set -e
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
(cd "$tmp" && npm pack --silent @coderline/alphatab@1.8.4 >/dev/null && tar -xzf coderline-alphatab-1.8.4.tgz)
dist="$tmp/package/dist"
mkdir -p lib/font lib/soundfont
cp "$dist/alphaTab.min.js" lib/
# alphaTab clicks the metronome on drum key 33, which the drum kit has no sound for. Key 37 (Side Stick) is a short
# click that the kit covers, so the metronome uses it. Stops with an error if alphaTab's code is not as expected.
node -e "const fs=require('fs');const f='lib/alphaTab.min.js';const s=fs.readFileSync(f,'utf8');const from='static MetronomeKey=33;';if(s.split(from).length!==2){console.error('alphaTab MetronomeKey not found once');process.exit(1)}fs.writeFileSync(f,s.replace(from,'static MetronomeKey=37;'))"
cp "$dist/font/Bravura.woff2" "$dist/font/Bravura.woff" "$dist/font/Bravura.otf" "$dist/font/Bravura-OFL.txt" lib/font/
cp "$dist/soundfont/sonivox.sf2" "$dist/soundfont/LICENSE" lib/soundfont/
cp "$tmp/package/LICENSE" lib/LICENSE
rm -rf "$tmp"
echo "alphaTab copied into lib/"
