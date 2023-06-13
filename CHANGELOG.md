# v2.3.2:
- use async / await where possible
- some lint warnings addressed (comma, semicolon placement)

# v2.3.1:
- fix issue with popup dialog on wrong display with multi-monitor setup
- fix issue after closing addon configuration tab
- add eslint.rc
- change German locales to use spelling "E-Mail"
- Thunderbird version 115 support
- remove no longer needed experiment APIs (still one remains)
- convert "var" to "let" where appropiate
- use template literals instead of string concatenation
- use "messenger" instead of "browser" as root for extension APIs
- remove configuration migration from version 1 addon
- allow changing sender identity during adding of recipients even if 
  sender identity was already changed by the addon when a "reply-to" 
  window was opened

# v2.2.1:
- add configuration shortcut icon to toolbar
- advanced SMTP header field configuration
- remove found identity from To and cc

# v2.1.1:
- min. version setting 91.3.1 is not valid, so chose 91.0
- some minor bugs fixed

# v2.1.0:
- support Thunderbird 102 (max. version setting 91.\* > 102.\*)
- use new API "relatedMessageId" to identify e.g. the message we reply-to.
  This is used to find the original recipients. Before, we used some heuristic
  correlation via subject content, which especially failed with UTF-8
  characters in the subject.
- some dialogs improved
- more language translations

# v2.0.1:
- initial version for Thunderbird >67 support
