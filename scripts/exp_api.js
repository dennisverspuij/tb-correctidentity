var { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { MailUtils } = ChromeUtils.import("resource:///modules/MailUtils.jsm");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");

var guiState = {
  currentAccountId: "",
  currentDetectionIdentity: "",
  currentSafetyIdentity: "",
};

var settings = {
  accountSettings: {},  // key: accountId; values: identityMechanism, explicitIdentity, replyFromRecipient
  identitySettings: {}, // key: identityId; values: detectable, detectionAliases, warningAliases
  // migrate   ... property will be dynamically added if old prefs were migrated
};

var composeWindowFocus = {};  // key: windowId; store element of compose window which has current focus
var onRecipientsChangeHookInstalled = {};  // key: windowId; value: bool

var getIdentityForHeaderHookInstalled = false;

class OnRecipientsChangedListener extends ExtensionCommon.EventEmitter {
  constructor() {
    super();
  }

  add(callback) {
    this.on("recipientsChanged", callback);
  }

  remove(callback) {
    this.off("recipientsChanged", callback);
  }
}

var onRecipientsChangedListener = new OnRecipientsChangedListener();

function myGetIdentityForHeader(hdr, type, hint = "") {
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

  // call original function
  // we do not modify the result here, simply call original function
  // modification is done later in the ComposeWindow
  var identity;
  var matchingHint;
  [identity, matchingHint] = MailUtils.origGetIdentityForHeader(hdr, type, hint);
  var origIdentityId;
  if (identity) {
    origIdentityId = identity.key;
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
            MailUtils.getIdentityForHeader = myGetIdentityForHeader;
            getIdentityForHeaderHookInstalled = true;
          }
        },
        //////////////////////////////////////////////////////////////
        async installOnRecipientsChangedHook(tabId, windowId) {
          if (!onRecipientsChangeHookInstalled[windowId]) {
            onRecipientsChangeHookInstalled[windowId] = true;
            var win = Services.wm.getOuterWindowWithId(windowId);
            // store old function in window object
            win.origOnRecipientsChanged = win.onRecipientsChanged;
            win.onRecipientsChanged = ( automatic => {
              // emit event to background script
              if (!automatic) {
                onRecipientsChangedListener.emit("recipientsChanged", tabId);
              }

              // call original function, we need the window from the outer function
              win.origOnRecipientsChanged(automatic);
            });
          }
        },
        //////////////////////////////////////////////////////////////
        onRecipientsChanged: new ExtensionCommon.EventManager({
          context,
          name: "exp.onRecipientsChanged",
          register(fire) {
            function callback(event, tabId) {
              return fire.async(tabId);
            }

            onRecipientsChangedListener.add(callback);
            return function() {
              onRecipientsChangedListener.remove(callback);
            };
          },
        }).api(),
        //////////////////////////////////////////////////////////////
        async saveCurrentFocus(windowId) {
          var win = Services.wm.getOuterWindowWithId(windowId);
          composeWindowFocus[windowId] = win.document.activeElement;
        },
        //////////////////////////////////////////////////////////////
        async restoreCurrentFocus(windowId) {
          composeWindowFocus[windowId].focus();
        },
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
