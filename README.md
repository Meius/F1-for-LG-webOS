# F1 for LG webOS

An unofficial app for watching F1 TV on LG TVs (webOS), for the many TVs where F1 TV is not in the LG Content Store.
It opens F1 TV's own web player full screen and makes it usable from the sofa:

- **Remote-control navigation.** Arrow keys move a visible focus frame between menus, rows and videos; OK selects.
  No need to use the Magic Remote's pointer.
- **In the player:** OK = pause / play, Left / Right = 10 s back / forward, Up / Down = show the player's controls and
  move between them. The controls hide again after a few seconds.
- **Login fix.** F1's login has no page for some languages: on a TV set to Swedish it fails with
  `NoSuchKey ... davinci/id/1.0.2/sv/login.html`. The app asks for the English login, which works everywhere.

You need your own [F1 TV](https://f1tv.formula1.com) account; live races need F1 TV Pro where it is sold.

> Not affiliated with, endorsed by or connected to Formula 1, the FIA or LG. F1, FORMULA 1 and F1 TV are trademarks of
> Formula One Licensing B.V. This app only opens F1 TV's public website; it does not change, copy or bypass anything
> of F1 TV's (no DRM is touched: video plays through the TV's own Widevine support, as in any browser).

## Requirements

- An LG TV with **webOS 5 or newer** (2020 models and later).
- The [Homebrew Channel](https://www.webosbrew.org) (rooted TV), or Developer Mode with the
  [webOS Dev Manager](https://github.com/webosbrew/dev-manager-desktop).
- For the remote-control navigation: the TV's web debugging port (9998), which webOS opens for developer-installed
  apps. Without it, F1 TV still opens and is used with the pointer.

Tested on an LG OLED55C34LA (webOS 23, firmware 43.21.71).

## Install

Step-by-step instructions are also in [readme.txt](readme.txt).

### From the Homebrew Channel (recommended, gets updates)

1. On the TV: **Homebrew Channel → Settings → Add repository**, and enter
   ```
   https://github.com/Meius/F1-for-LG-webOS/releases/latest/download/apps.json
   ```
2. Select **F1 for LG webOS** in the app list and choose **Install**.
3. Open **F1 for LG webOS** from the TV's app list and sign in.

### By hand

1. Download the `.ipk` from [Releases](../../releases).
2. Install it with one of:
   - **webOS Dev Manager** (PC/Mac): *Install app* and choose the `.ipk`.
   - **Command line** (webOS CLI): `ares-install io.github.meius.f1tv_1.1.3_all.ipk`
   - **SSH** (rooted TV):
     ```sh
     luna-send -n 1 luna://com.webos.appInstallService/dev/install \
       '{"id":"io.github.meius.f1tv","ipkUrl":"/tmp/io.github.meius.f1tv_1.1.3_all.ipk","subscribe":false}'
     ```
3. Open **F1 for LG webOS** from the app list and sign in.

## Using it

| Where | Key | Does |
|---|---|---|
| Menus and rows | Arrows | Move the focus frame |
| | OK | Open / select |
| | Back | Previous page (on the start page: close the app) |
| Watching a video | OK | Pause / play |
| | Left / Right | 10 s back / forward |
| | Up / Down | Show the controls and move between them |

Moving the Magic Remote's pointer hides the frame; the arrows bring it back.

## How it works

- `app/` is a small web app that starts the helper service and then opens `https://f1tv.formula1.com`.
- `service/` is a Node.js webOS service. It connects to the app's page through the TV's local web debugging port
  (Chrome DevTools Protocol on `127.0.0.1:9998`) and, on every page F1 TV loads:
  - adds `nav.js` (the remote-control navigation),
  - sets the page language to English (`Accept-Language` and locale) so F1's login works. The TV's own
    browser identity is kept.
- The service keeps itself running while the app is open and stops two minutes after it closes. It only connects to
  `127.0.0.1` and only to pages of this app or `formula1.com`. Log: `/tmp/io.github.meius.f1tv.log`.
- `service/ws-lite.js` is a tiny WebSocket client, because TVs ship old Node versions without one.

## Build

Needs Python 3 only.

```sh
python tools/build.py                   # -> dist/io.github.meius.f1tv_<version>_all.ipk
python tools/build.py --icons my-icons  # use your own icon.png (80x80), largeIcon.png (130x130), logo.png (loading screen, 880x560)
python tools/build.py --repo Meius/F1-for-LG-webOS  # also apps.json + manifest for the Homebrew Channel
```

## Releasing a new version

1. Bump `version` in both `app/appinfo.json` and `service/package.json`.
2. Run `python tools/build.py --repo Meius/F1-for-LG-webOS`.
3. On GitHub, create a release tagged `v<version>` (for example `v1.1.3`) and attach the three files from `dist/`:
   the `.ipk`, `apps.json` and `io.github.meius.f1tv.manifest.json`. Homebrew Channel users then get the update.

## Troubleshooting

- **Login shows `NoSuchKey`:** the helper service did not start. Close the app completely and open it again; check
  `/tmp/io.github.meius.f1tv.log` over SSH.
- **Arrows do nothing:** the debugging port is not open on this TV (log says `debug port 9998 not reachable`).
  Use the pointer.
- **Stream keeps loading:** wait 15–20 s after *Watch live*; F1's player starts slowly on TVs.
  Picture quality follows your connection; a weak Wi-Fi gives a low resolution.

## License

[MIT](LICENSE)
