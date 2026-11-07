F1 for LG webOS - installing with the Homebrew Channel
=====================================================

An unofficial app for watching F1 TV on LG TVs (webOS 5 / 2020 models and newer).
You need your own F1 TV account (F1 TV Pro for live sessions).
Not affiliated with Formula 1 or LG.


WHAT YOU NEED
-------------
- An LG TV with the Homebrew Channel installed.
  Not installed yet? See https://www.webosbrew.org (rooting is done with https://rootmy.tv
  on supported firmware).


OPTION 1: INSTALL FROM THE HOMEBREW CHANNEL (recommended, gets updates)
------------------------------------------------------------------------
1. On the TV, open the Homebrew Channel.
2. Open Settings (the gear icon).
3. Choose "Add repository" and type this address exactly:

   https://github.com/Meius/F1-for-LG-webOS/releases/latest/download/apps.json

4. Go back to the app list. "F1 for LG webOS" is now in it.
5. Select it and choose "Install".
6. Open "F1 for LG webOS" from the TV's app list and sign in with your F1 TV account.

Updates: new versions appear in the Homebrew Channel; select the app and choose "Update".


OPTION 2: INSTALL THE .IPK FILE BY HAND
---------------------------------------
1. Download the newest io.github.meius.f1tv_<version>_all.ipk from:
   https://github.com/Meius/F1-for-LG-webOS/releases
2. Install it with one of:
   a) webOS Dev Manager on your computer (https://github.com/webosbrew/dev-manager-desktop):
      connect to the TV, choose "Install app" and pick the .ipk.
   b) SSH (rooted TV; the Homebrew Channel's SSH server must be on, default password "alpine"):
        scp io.github.meius.f1tv_<version>_all.ipk root@<TV-IP>:/tmp/
        ssh root@<TV-IP>
        luna-send -n 1 luna://com.webos.appInstallService/dev/install '{"id":"io.github.meius.f1tv","ipkUrl":"/tmp/io.github.meius.f1tv_<version>_all.ipk","subscribe":false}'


USING THE APP
-------------
Menus and rows:   Arrows move the white/red frame, OK opens the selected item,
                  Back goes to the previous page (on the start page it closes the app).
Watching:         OK = pause / play, Left / Right = 10 s back / forward,
                  Up / Down = show the player's buttons and move between them.
Cookie question:  "Accept" is selected for you; press OK (or use the arrows to choose).
"Watch live / from start" menu: "Watch live" is selected for you; press OK.
The Magic Remote's pointer works too; moving it hides the frame.


TROUBLESHOOTING
---------------
- Login shows "NoSuchKey": close the app completely and open it again.
  (F1 has no login page in some languages; the app asks for the English one.)
- The arrow keys do nothing: this TV does not open the web debugging port the app uses.
  F1 TV still works with the pointer.
- A live stream keeps loading: wait 15-20 seconds after "Watch live". A weak Wi-Fi
  connection gives a low picture quality.
- Uninstall: in the Homebrew Channel select the app and choose "Uninstall",
  or remove it from the TV's app list like any other app.

Source code, issues and new versions: https://github.com/Meius/F1-for-LG-webOS
