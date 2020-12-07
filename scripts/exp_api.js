var { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { MailUtils } = ChromeUtils.import("resource:///modules/MailUtils.jsm");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");

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

var getIdentityForHeaderHookInstalled = false;

class Listener extends ExtensionCommon.EventEmitter {
  constructor() {
    super();
  }

  add(callback) {
    this.on("replyHintCaptured", callback);
  }

  remove(callback) {
    this.off("replyHintCaptured", callback);
  }
}

var listener = new Listener();

function myOverlay(hdr, type, hint = "") {
  var accountId = "";

  // from original getIdentityForHeader
  // begin
  let server = null;
  let folder = hdr.folder;
  if (folder) {
    server = folder.server;
    // modified from original here, we ignore customIdentity
  }

  if (!server) {
    let accountKey = hdr.accountKey;
    if (accountKey) {
      let account = MailServices.accounts.getAccount(accountKey);
      if (account) {
        server = account.incomingServer;
      }
    }
  }

  let hintForIdentity = "";
  if (type == Ci.nsIMsgCompType.ReplyToList) {
    hintForIdentity = hint;
  } else if (
    type == Ci.nsIMsgCompType.Template ||
    type == Ci.nsIMsgCompType.EditTemplate ||
    type == Ci.nsIMsgCompType.EditAsNew
  ) {
    hintForIdentity = hdr.author;
  } else {
    hintForIdentity = hdr.recipients + "," + hdr.ccList;  // + "," + hint; modified from original
  }
  // end

  if (server) {
    account = MailServices.accounts.FindAccountForServer(server);
    accountId = account.key;
  }

  // call original function
  // we do not modify the result here, simply call original function
  // modification is done later in the ComposeWindow
  [identity, matchingHint] = MailUtils.origGetIdentityForHeader(hdr, type, hint);

  if (identity) {
    origIdentityId = identity.key;
  }

  if (type) {
    // ignore undefined compose types
    listener.emit("replyHintCaptured", hintForIdentity, origIdentityId, type, hdr.subject);
  }

  return [identity, matchingHint];
}

var exp = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    context.callOnClose(this);
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
        },
        //////////////////////////////////////////////////////////////
        async installGetIdentityForHeaderHook() {
          if (!getIdentityForHeaderHookInstalled) {
            MailUtils.origGetIdentityForHeader = MailUtils.getIdentityForHeader;
            MailUtils.getIdentityForHeader = myOverlay;
            getIdentityForHeaderHookInstalled = true;
          }
        },
        //////////////////////////////////////////////////////////////
        onReplyHintCaptured: new ExtensionCommon.EventManager({
          context,
          name: "exp.onReplyHintCaptured",
          register(fire) {
            function callback(event, hint, origIdentityId, composeType, subject) {
              return fire.async(hint, origIdentityId, composeType, subject);
            }

            listener.add(callback);
            return function() {
              listener.remove(callback);
            };
          },
        }).api()
        //////////////////////////////////////////////////////////////
      }
    };
  }
  close() {
    // cleanup installed hooks
    if (getIdentityForHeaderHookInstalled) {
      MailUtils.getIdentityForHeader = MailUtils.origGetIdentityForHeader;
      MailUtils.origGetIdentityForHeader = undefined;

      getIdentityForHeaderHookInstalled = false;
    }
  }
};
