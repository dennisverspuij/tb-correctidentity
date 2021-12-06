Thunderbird Add-on "Correct Identity"
=====================================

This add-on works with Thunderbird versions > 67.

It's a **perfect alternative** to

- the [original Correct Identity](https://github.com/dennisverspuij/tb-correctidentity)
- [Flexible Identity](https://github.com/snakelizzard/flexible_identity)

which don't work anymore because Thunderbird switched to new Plugin API
framework called [WebExtension](https://webextension-api.thunderbird.net/).

The add-on comes in 5 different languages. Here is a screenshot of the settings
window:

![Settings window](images/settings.png)


Installation
------------

This add-on is **not** yet available at the [official Thunderbird add-on store](https://addons.thunderbird.net/).

Steps for installation:

1. Download this repository
2. In the repository folder, execute `./make_xpi.sh` to create an .xpi file
3. Open Thunderbird, go to /Add-ons/, and click /Install add-on from file/
4. Choose the .xpi file in the repository folder

The add-on can now be configured in the add-on manager tab.


Development & Contributing
--------------------------

1. Fork this repo and download it with `git pull`
2. Call `./make_xpi.sh` in the repo
3. In Thunderbird, Menu /Extras/ → /Development Tools/ → /Debug Add-ons/
4. /Load temporary Add-on/ and select the .xpi file
5. Then you can press /Reload/
6. …
7. Send us a pull request!

Note that you have to generate a .xpi file *with the same name* whenever you change the source code. You can use a file watcher like inotify to automate this.

In Menu /Extras/ → /Development Tools/ you'll also find a dev console and more debugging tools.


Trivia
------

Before this fork:

[Here is the old version](https://addons.thunderbird.net/de/thunderbird/addon/correct-identity/)
of Correct Identity which doesn't work on Thunderbird versions > 67.
