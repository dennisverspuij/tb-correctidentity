var accountsAndIdentities = {
  accounts: {}, // key:id, values: prettyName, index, defaultIdentityId, type
  identities: {}, // key:id, values: email, accountId, prettyName, prettyNameDebug
};

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

var initSettingsDone = {
  guiState : false,
  settings : false,
  accountsAndIdentities : false
}

//capture last recorded state of compose tab to detect changes to "identityId" or to "to"
var composeTabStatus = {}; // key:tabId values: initialIdentityId, allRecipientsList, changedByUs,
//                             identitySetByUser, origRecipientsList

var dialogResults = {}; // key:windowId

// FIXME: are there somewhere global constants available?
// used for interfacing to dialog.js
const BUTTON_OK = 1;
const BUTTON_CANCEL = 2;

var onSettingsChanged;  // a callback from option.js

function notifySettingsChanged() {
  if (onSettingsChanged !== undefined) {
    if (initSettingsDone.guiState && initSettingsDone.settings && initSettingsDone.accountsAndIdentities) {
      onSettingsChanged({
        msgType: "GET_SETTINGS_REP",
        settings: settings,
        accountsAndIdentities: accountsAndIdentities,
        guiState: guiState,
      });
    }
  }
}

// check that all fields are present and valid(e.g. for upgrades)
function checkSettings(inSettings) {
  if (inSettings === undefined) {
    inSettings = {};
  }

  if (inSettings.accountSettings === undefined) {
    inSettings.accountSettings = {};
  }

  // remove non-existing accounts
  for (let idx in inSettings.accountSettings) {
    if (!(idx in accountsAndIdentities.accounts)) {
      // unknown accountId
      console.log("deleting accountSettings for ", idx);
      delete inSettings.accountSettings[idx];
      continue;
    }
  }

  // add missing entries for accounts
  for (let  idx in accountsAndIdentities.accounts) {
    if (!(idx in  inSettings.accountSettings)) {
      console.log("adding default accountSettings for ", idx);
      inSettings.accountSettings[idx] = {};  // will be filled below with defaults
    }
  }

  // fill missing values with defaults
  for (let idx in inSettings.accountSettings) {
    var as = inSettings.accountSettings[idx];
    if (as.identityMechanism === undefined) {
      as.identityMechanism = 0;
    }
    if (as.explicitIdentity === undefined) {
      as.explicitIdentity = accountsAndIdentities.accounts[idx].defaultIdentityId;
    }
    if (as.replyFromRecipient === undefined) {
      as.replyFromRecipient = true;
    }
  }

  if (inSettings.identitySettings === undefined) {
    inSettings.identitySettings = {};
  }

  // remove non-existing identities
  for (let idx in inSettings.identitySettings) {
    if (!(idx in accountsAndIdentities.identities)) {
      // unknown identityId
      console.log("deleting identitySettings for ", idx);
      delete inSettings.identitySettings[idx];
      continue;
    }
  }

  // add missing entries for identities
  for (let  idx in accountsAndIdentities.identities) {
    if (!(idx in  inSettings.identitySettings)) {
      console.log("adding default identitySettings for ", idx);
      inSettings.identitySettings[idx] = {};  // will be filled below with defaults
    }
  }

  // fill missing values with defaults
  for (let idx in inSettings.identitySettings) {
    var is = inSettings.identitySettings[idx];
    if (is.detectable === undefined) {
      is.detectable = true;
    }
    if (is.detectionAliases === undefined) {
      is.detectionAliases = "";
    }
    if (is.warningAliases === undefined) {
      is.warningAliases = "";
    }
  }
  return inSettings;
}

// check that all fields are present and valid(e.g. for upgrades)
function checkGuiState(inGuiState) {
  if (!(inGuiState.currentAccountId &&
      accountsAndIdentities.accounts[inGuiState.currentAccountId])) {
    // something undefined, so use default
    inGuiState.currentAccountId = Object.keys(accountsAndIdentities.accounts)[0];
  }

  if (!(inGuiState.currentDetectionIdentity &&
      accountsAndIdentities.identities[inGuiState.currentDetectionIdentity])) {
    // something undefined, so use default
    inGuiState.currentDetectionIdentity = Object.keys(accountsAndIdentities.identities)[0];
  }

  if (!(inGuiState.currentSafetyIdentity &&
      accountsAndIdentities.identities[inGuiState.currentSafetyIdentity])) {
    // something undefined,, so use default
    inGuiState.currentSafetyIdentity = Object.keys(accountsAndIdentities.identities)[0];
  }

  return inGuiState;
}

// migrate settings from "user.pref" (Correct Identity version 1.xx.xx)
function migrateSettings() {
  // call experiment API to access old prefs
  return browser.exp.migratePrefs().then((result) => {
    guiState = checkGuiState(result.guiState);
    settings = checkSettings(result.settings);
  }, error => {
    console.log("migrateSettings Error", error);
  }
  );
}

//read settings from storage
function initSettings() {
  // get all accounts and identities from thunderbird
  messenger.accounts.list().then(
    (arrayMailAccounts) => {
      // console.log("arrayMailAccounts:", arrayMailAccounts);
      let iIndex = 0;
      for (var i in arrayMailAccounts) {
        // determine default identity of this account
        var defaultIdentity = arrayMailAccounts[i].identities[0];
        var defaultIdentityId;

        if (defaultIdentity === undefined) {
          defaultIdentityId = "";
        } else {
          defaultIdentityId = defaultIdentity.id;
        }

        accountsAndIdentities.accounts[arrayMailAccounts[i].id] = {
          prettyName: arrayMailAccounts[i].name,
          defaultIdentityId: defaultIdentityId,
          type: arrayMailAccounts[i].type,
          index: iIndex++,
        };

        for (var j in arrayMailAccounts[i].identities) {
          // append account name in italics and in gray as in compose window
          var prettyName = arrayMailAccounts[i].identities[j].name +
                           " <"+ arrayMailAccounts[i].identities[j].email + ">";
          var prettyNameDebug = arrayMailAccounts[i].identities[j].email +
                                " (account: " + arrayMailAccounts[i].name + ")";
          accountsAndIdentities.identities[arrayMailAccounts[i].identities[j].id] = {
            email: arrayMailAccounts[i].identities[j].email,
            prettyName: prettyName,
            prettyNameDebug : prettyNameDebug,
            accountId: arrayMailAccounts[i].id,
          };
        }
      }

      // replace undefined defaultIdentityId with first known identity
      for (let idx in accountsAndIdentities.accounts) {
        if (accountsAndIdentities.accounts[idx].defaultIdentityId === "") {
          accountsAndIdentities.accounts[idx].defaultIdentityId = Object.keys(accountsAndIdentities.identities)[0];
        }
      }

      initSettingsDone.accountsAndIdentities = true;
      // console.log("accountsAndIdentities:", accountsAndIdentities);

      // get stored settings
      browser.storage.sync.get("guiState").then(
        (result) => {
          if (result.guiState !== undefined) {
            guiState = checkGuiState(result.guiState);
          } else {
            // defaults
            guiState.currentAccountId = Object.keys(
              accountsAndIdentities.accounts
            )[0];
            guiState.currentDetectionIdentity = Object.keys(
              accountsAndIdentities.identities
            )[0];
            guiState.currentSafetyIdentity = Object.keys(
              accountsAndIdentities.identities
            )[0];
          }
          initSettingsDone.guiState = true;
        },
        (error) => console.log("Error: storage get guiState failed ", error)
      );
      browser.storage.sync.get("settings").then(
        (result) => {
          // checkSettings (also adds defaults if undefined)
          settings = checkSettings(result.settings);
          // should we save, if changed?

          if (settings.migrate === undefined) {
            // not yet called, call it once
            migrateSettings().then( () => {
              settings.migrate = true;
              console.log("settings migrated");
              browser.storage.sync.set({ guiState, settings });
              initSettingsDone.settings = true;
              notifySettingsChanged();
            });
          } else {
            initSettingsDone.settings = true;
            notifySettingsChanged();
          }
        },
        (error) => console.log("Error: storage get settings failed ", error)
      );
    },
    (error) => {
      console.error("Error failureCallback: " + error);
    }
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function windowExists(winId) {
  var exists = false;
  await browser.windows.get(winId).then(
    (window) => {
      exists = true;
    },
    () => {
      exists = false;
    }
  );
  return exists;
}

// does not exit until window closed
// returns true, if "OK" pressed
async function firePopup(title, text, buttons) {
  // build script which fires alert
  var winId = "";
  var result = false;
  await browser.windows
    .create({
      type: "popup",
      width: 400,
      height: 300,
      url:
        "dialog.html?buttons=" +
        encodeURIComponent(buttons) +
        "&title=" +
        encodeURIComponent(title) +
        "&string=" +
        encodeURIComponent(text),
    })
    .then((window) => {
      winId = window.id;
    });
  // wait until window closed
  while (true) {
    // check if window is still open
    var exists = await windowExists(winId);
    if (!exists) {
      break;
    }
    await sleep(1000);
  }
  if (dialogResults[winId] !== undefined) {
    result = (dialogResults[winId] & BUTTON_OK) !== 0;
  }
  return result;
}

function patternSearch(haystack, needles, warnIdentityId, warnText) {
  for (let i in needles) {
    let needle = needles[i];
    // check search terms
    if (needle.match(/^\s*$/)) {
      continue; // skip empty lines
    }
    let isRegex = needle.match(/^\s*\/(.*)\/\s*$/)
    if (isRegex) {
      // maybe we have a RegExp
      try {
        const regex = new RegExp(isRegex[1], 'i');
        if (haystack.match(regex)) {
          return true;
        }
      } catch (err) {
        // called non-blocking
        firePopup(
          "Error in RegExp",
          "Ignoring invalid regular expression:\n\n" +
            "identity:  " +
            accountsAndIdentities.identities[warnIdentityId].email +
            "\n" +
            "regexp:  " +
            needle.replace(/\\/g, "\\\\") +
            "\n\n" +
            "Please adjust in the Correct Identity " + warnText + " settings!",
          BUTTON_OK
        );
      }
    } else if (haystack.toLowerCase().indexOf(needle) >= 0) {
      return true;
    }
  }
  return false;
}

// Compute identity based on allRecipientsList, explicitIdentity,
// replyFromRecipient, and detectionAliases.
function getIdentity(identityId, allRecipientsList, origRecipientsList) {
  var newIdentityId = identityId;
  var aliasedId = "";
  var explicitId = "";
  var replyId = "";

  console.log("getIdentity called with identityId:", identityId,
    " allRecipientsList:", JSON.stringify(allRecipientsList), " origRecipientsList:", origRecipientsList);

  console.log(identityId, ":", accountsAndIdentities.identities[identityId].prettyNameDebug);

  var accountId = accountsAndIdentities.identities[identityId].accountId;

  var perAccountSettings = settings.accountSettings[accountId];

  if (perAccountSettings !== undefined) {
    switch (perAccountSettings.identityMechanism) {
    case 1:
      explicitId = perAccountSettings.explicitIdentity;
      break;
      // Room for more options in the future
    }

    if (perAccountSettings.replyFromRecipient) {
      // check if we have a reply hint
      if (origRecipientsList) {
        for (var origRecipients of origRecipientsList) {
          var replyHint = origRecipients.toLowerCase();
          var identityEmail = accountsAndIdentities.identities[identityId].email.toLowerCase();
          console.log('this is identityEmail: ' + identityEmail);
          if (identityEmail.indexOf("@") === -1 || replyHint.indexOf(identityEmail) === -1) {
            // the current identity email (=sender) is not in the replyHint
            // so check if we find a matching identity
            for (let idxIdentity in settings.identitySettings) {
              let perIdentitySettings = settings.identitySettings[idxIdentity];
              var curIdentityEmail = accountsAndIdentities.identities[idxIdentity].email.toLowerCase();
              if (perIdentitySettings.detectable) {
                if ((curIdentityEmail.indexOf("@") >= 0) && (replyHint.indexOf(curIdentityEmail) >= 0)) {
                  // we found an identity that was mentioned in the hint
                  replyId = idxIdentity;
                  break;
                }
              }
            }
          }
          if (replyId !== "") {
            break;
          }
        }
      }

      // check for alias matches
      var recipientsString = allRecipientsList.join(" ");
      if (origRecipientsList) {
        // if we have a origRecipients, search also for origRecipients
        for (var origRecipient of origRecipientsList) {
          recipientsString = recipientsString + " " + origRecipient;
        }
      }
      for (let idxIdentity in settings.identitySettings) {
        let perIdentitySettings = settings.identitySettings[idxIdentity];
        if (perIdentitySettings.detectable) {
          let detectionAliases = perIdentitySettings.detectionAliases.split(/\n+/);
          var isMatch = patternSearch(recipientsString, detectionAliases, idxIdentity, "Detection"); // TODO: i18n
          if (isMatch) {
            aliasedId = idxIdentity;
          }
        }
      }
    }
  }

  // prioritized selection of resulting identity
  if (replyId !== "") {
    // return the matched identity from the replyHint
    console.log("matched identity from the replyHint");
    newIdentityId = replyId;
  } else if (explicitId !== "") {
    // an explicit identity was defined
    console.log("using explicit identity");
    newIdentityId = explicitId;
  } else if (aliasedId !== "") {
    // we have a match from the alias list
    console.log("match from the alias list");
    newIdentityId = aliasedId;
  } else {
    console.log("using default identity");
  }

  console.log("getIdentity returns newIdentityId:", newIdentityId);
  console.log(newIdentityId, ":", accountsAndIdentities.identities[newIdentityId].prettyNameDebug);

  return newIdentityId;
}

// returns true if ok-to-send
async function sendConfirm(tabId, identityId, recipients) {
  var perIdentitySettings = settings.identitySettings[identityId];
  if (perIdentitySettings === undefined) {
    // nothing configured
    return true;
  }
  let warningAliases = perIdentitySettings.warningAliases.split(/\n+/);
  let warnRecipients = "";

  for (var idxRecipient in recipients) {
    var recipient = recipients[idxRecipient];
    var isMatch = patternSearch(recipient, warningAliases, identityId, "Safety"); // TODO: i18n
    if (isMatch) {
      warnRecipients += "\n" + recipient;
    }
  }

  return warnRecipients === "" ? true : firePopup(
    "Warning", // TODO: i18n
    browser.i18n.getMessage("warning", [
      accountsAndIdentities.identities[identityId].email,
      warnRecipients,
    ]),
    BUTTON_OK | BUTTON_CANCEL
  );
}

function testGetFull(msgId) {
   messenger.messages.getFull(msgId).then((msgPart) => {
      console.log("getFull(msgId): MessagePart.headers", msgPart.headers);
  });
}

function checkComposeTab(tab) {
  messenger.compose.getComposeDetails(tab.id).then((gcd) => {
    var changed = false;
    var allRecipientsList = [];
    var toRecipientsList = [];
    var ccRecipientsList = [];
    var entry = composeTabStatus[tab.id];
    var initialIdentityId = "";
    var relatedMessageId = "";
    var currentIdentityId = gcd.identityId;
    var gcdAllRecipientsList = gcd.to.concat(gcd.cc, gcd.bcc);  // we handle "to", "cc" and "bcc" fields
    if (entry) {
      if (entry.identitySetByUser) {
        // user has manually modified identity, so do not change it
        return;
      }

      // get current values
      initialIdentityId = entry.initialIdentityId;
      allRecipientsList = entry.allRecipientsList;
      relatedMessageId  = entry.relatedMessageId;

      // check if recipients have changed
      if (JSON.stringify(allRecipientsList) != JSON.stringify(gcdAllRecipientsList)) {
        allRecipientsList = gcdAllRecipientsList;
        changed = true;
      }
    } else {
      // new tab detected
      initialIdentityId = gcd.identityId;
      allRecipientsList = gcdAllRecipientsList;
      relatedMessageId = gcd.relatedMessageId;
      toRecipientsList = gcd.to;
      ccRecipientsList = gcd.cc;
      changed = true;
    }


    // store status in global object
    composeTabStatus[tab.id] = {
      initialIdentityId : initialIdentityId,
      allRecipientsList : allRecipientsList,
      toRecipientsList  : toRecipientsList,
      ccRecipientsList  : ccRecipientsList,
      relatedMessageId  : relatedMessageId,
    };

    if (changed) {
      var origRecipientsList = [];
      if (relatedMessageId) {
        testGetFull(relatedMessageId);
        messenger.messages.get(relatedMessageId).then((msgHdr) => {
          origRecipientsList = msgHdr.recipients;
          handleComposeTabChanged(tab.id, tab.windowId, initialIdentityId, currentIdentityId, allRecipientsList, origRecipientsList);
        });
      } else {
        handleComposeTabChanged(tab.id, tab.windowId, initialIdentityId, currentIdentityId, allRecipientsList, origRecipientsList);
      }
    }
  }, () => {/* errors are ignored */});
}

function searchAndRemoveFromRecipientList(recipientsList, email) {
  for (var recipientIdx = 0;  recipientIdx < recipientsList.length; recipientIdx++) {
    if (recipientsList[recipientIdx].includes(email)) {
      // remove from list
      recipientsList.splice(recipientIdx,1);
      return true;
    }
  }
  return false;
}

function handleComposeTabChanged(tabId, windowId, initialIdentityId, currentIdentityId, allRecipientsList, origRecipientsList) {
  var newIdentityId = getIdentity(initialIdentityId, allRecipientsList, origRecipientsList);
  if (newIdentityId !== currentIdentityId) {
    // change identityId
    composeTabStatus[tabId].changedByUs = true;
    var details = {
      identityId : newIdentityId,
    };

    // Check if newIdentityId was in "to", "cc" or "cc". Remove it from there
    messenger.identities.get(newIdentityId).then((newIdentity) => {
      var newIdentityEmail = newIdentity.email;
      if (searchAndRemoveFromRecipientList(composeTabStatus[tabId].toRecipientsList, newIdentityEmail)) {
        // found in "to"
        details.to = composeTabStatus[tabId].toRecipientsList;
      } else if (searchAndRemoveFromRecipientList(composeTabStatus[tabId].ccRecipientsList, newIdentityEmail)) {
        // found in "cc"
        details.cc = composeTabStatus[tabId].ccRecipientsList;
      }

      // changing identity makes focus jump to "to"
      // so save focus before changing identity
      browser.exp.saveCurrentFocus(windowId);

      messenger.compose.setComposeDetails(tabId, details);

      // ... and restore focus
      browser.exp.restoreCurrentFocus(windowId);
    }, () => {/* errors are ignored */});
  }
}

function onIdentityChangedListener(tab, identityId) {
  if (composeTabStatus[tab.id].changedByUs) {
    composeTabStatus[tab.id].changedByUs = false;
  } else {
    composeTabStatus[tab.id].identitySetByUser = true;
  }
}

//we need to wait for confirmations -> async function
async function onBeforeSendListener(tab, details) {
  var result = await sendConfirm(tab.id, details.identityId, details.to.concat(details.cc, details.bcc));

  return {
    cancel: !result,
  };
}

function handleMessage(request, sender, sendResponse) {
  if (request.msgType === "REGISTER_ON_SETTINGS_CHANGED_HANDLER") {

    onSettingsChanged = sendResponse;
    notifySettingsChanged();
    // sendResponse({
    //  msgType: "GET_SETTINGS_REP",
    //  settings: settings,
    //  accountsAndIdentities: accountsAndIdentities,
    //  guiState: guiState,
    // });
  } else if (request.msgType === "SET_SETTINGS_REQ") {
    guiState = request.guiState;
    settings = request.settings;
    browser.storage.sync.set({ guiState, settings });
  } else if (request.msgType === "CLOSE_WINDOW") {
    dialogResults[request.windowId] = request.result;
    browser.windows.remove(request.windowId);
  } else if (request.msgType === "NEW_COMPOSE_TAB_READY") {
    onComposeTabReady(sender.tab);
  } else {
    console.log("UNDEFINED_MSG_TYPE:", request.msgType);
    console.log("sender:", sender);
    sendResponse({ msgType: "UNDEFINED_MSG_TYPE" });
  }
}

/*
 * composeTypes:
 * from nsIMsgFolder.idl
 * New                      = 0;
 * Reply                    = 1;
 * ReplyAll                 = 2;
 * ForwardAsAttachment      = 3;
 * ForwardInline            = 4;
 * NewsPost                 = 5;
 * ReplyToSender            = 6;
 * ReplyToGroup             = 7;
 * ReplyToSenderAndGroup    = 8;
 * Draft                    = 9;
 * Template                 = 10;  // New message from template.
 * MailToUrl                = 11;
 * ReplyWithTemplate        = 12;
 * ReplyToList              = 13;
 */

function onRecipientsChanged(tabId) {
  browser.tabs.get(tabId).then( tab => {
    checkComposeTab(tab);
  });
}

function onComposeTabReady(tab) {
  browser.exp.installOnRecipientsChangedHook(tab.id, tab.windowId);
  checkComposeTab(tab);
}

initSettings();

browser.exp.installGetIdentityForHeaderHook();
browser.exp.onRecipientsChanged.addListener(onRecipientsChanged);

browser.runtime.onMessage.addListener(handleMessage);

messenger.compose.onIdentityChanged.addListener(onIdentityChangedListener);
messenger.compose.onBeforeSend.addListener(onBeforeSendListener);
messenger.composeScripts.register({ js : [{file: "scripts/compose.js"}] });

// to test empty storage uncomment next line once
// browser.storage.sync.clear();
