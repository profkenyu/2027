#!/bin/zsh
unsetopt BG_NICE
cd -- "${0:A:h}" || exit 1
voyage_root="$PWD"
voyage_chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [[ ! -x "$voyage_chrome" ]]; then
  /usr/bin/osascript -e 'display dialog "Google Chrome을 설치한 뒤 다시 실행해 주세요." buttons {"확인"} default button 1'
  exit 1
fi
voyage_profile="$HOME/Library/Application Support/BeyondTheKnown/voyage"
mkdir -p "$voyage_profile" || exit 1
voyage_url=$(/usr/bin/osascript -l JavaScript -e 'ObjC.import("Foundation"); function run(argv) { return $.NSURL.fileURLWithPath(argv[0]).absoluteString.js; }' "$voyage_root/index.html") || exit 1
print '로버 탐사 실행 중 · 종료: Command + Q'
print '이 창을 닫지 마세요. 전시 중 화면 절전을 방지합니다.'
"$voyage_chrome" --user-data-dir="$voyage_profile" --no-first-run --no-default-browser-check --kiosk "$voyage_url" &
voyage_pid=$!
/usr/bin/caffeinate -di -w "$voyage_pid"
wait "$voyage_pid"
