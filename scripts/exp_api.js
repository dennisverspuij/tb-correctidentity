var { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var guiState = {
    currentAccountId: "",
    currentDetectionIdentity: "",
    currentSafetyIdentity: "",
  };

/*
var perAccountSettings = {
    identityMechanism : 0,
    explicitIdentity : "",
    replyFromRecipient : false,
};


var perIdentitySettings = {
      detectable: true,
      detectionAliases: "",
      warningAliases: "",
};
 */

var settings = {
  accountSettings: {},
  identitySettings: {},
};

var exp = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    return {
      exp: {
        //////////////////////////////////////////////////////////////
        async migratePrefs() {
          // Services.wm.getMostRecentWindow("mail:3pane").alert("Hello !");
          let b=Services.prefs.getBranch("CorrectIdentity.");
          let prefs=b.getChildList("");
          // global settings
          guiState = {
              currentAccountId: b.getCharPref("selectedAccount", "").replace("server", "account"),
              currentDetectionIdentity: b.getCharPref("selectedIdentity", ""),
              currentSafetyIdentity: b.getCharPref("selectedSafetyIdentity", "")
            };
          prefs.forEach(pref=>{
            if (pref.startsWith("settings_server")) {
              var accountId = pref.replace("settings_server", "account");
              let a = (b.getPrefType(pref) == b.PREF_STRING) ? b.getCharPref(pref).split(/\x01/) : [];
              var perAccountSettings = {
                  identityMechanism:  parseInt(a[1], 10),
                  explicitIdentity: a[2],
                  replyFromRecipient: (a[3] == "true")
                };
              settings.accountSettings[accountId] = perAccountSettings;
            } else if (pref.startsWith("settings_id")) {
              var identityId =  pref.replace("settings_", "");
              let a = (b.getPrefType(pref) == b.PREF_STRING) ? b.getCharPref(pref).split(/\x01/, 3) : [];
              if (a.length >= 2) {
                var perIdentitySettings = {
                   detectable : (a[0] == "true"),
                   detectionAliases : a[1],
                   warningAliases : (a.length == 3)?a[2]:""
                };
                settings.identitySettings[identityId] = perIdentitySettings;
              }
            }
          });
          return {
            guiState : guiState,
            settings :settings
            };
        }
        //////////////////////////////////////////////////////////////
      }
    };
  }
};
