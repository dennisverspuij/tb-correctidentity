var accountsAndIdentities = {
  accounts: {}, // key:id, values: prettyName, index, defaultIdentityId, type
  identities: {}, // key:id, values: email, accountId
};

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
  // migrate   ... property will be dynamically added if old prefs were migrated
};

//capture last recorded state of compose tab to detect changes to "identityId" or to "to"
var composeTabStatus = {}; // key:tabId values:identityId, recipientsList, changedByUs, identitySetByUser, remainingPollsForAcceptingReplyHint

var dialogResults = {}; // key:windowId

/*
replyHint = {
    hint : hint,
    origIdentityId : origIdentityId,
    composeType : composeType,
    subject : subject
};
*/
var replyHints = [];

// FIXME: are there somewhere global constants available?
// used for interfacing to dialog.js
const BUTTON_OK = 1;
const BUTTON_CANCEL = 2;

// check that all fields are present and valid(e.g. for upgrades)
function checkSettings(inSettings) {
  for (let idx in inSettings.accountSettings) {
    if (!(idx in accountsAndIdentities.accounts)) {
      // unknown accountId
      console.log("deleting accountSettings for ", idx);
      delete inSettings.accountSettings[idx];
      continue;
    }
    var as = inSettings.accountSettings[idx];
    if (as.identityMechanism === undefined) {
      as.identityMechanism = 0;
    }
    if (as.explicitIdentity === undefined) {
      as.explicitIdentity = "";
    }
    if (as.replyFromRecipient === undefined) {
      as.replyFromRecipient = false;
    }
  }
  for (let idx in inSettings.identitySettings) {
    if (!(idx in accountsAndIdentities.identities)) {
      // unknown identityId
      console.log("deleting identitySettings for ", idx);
      delete inSettings.identitySettings[idx];
      continue;
    }
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
  // get all accounts and identitites from thunderbird
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
                           " &lt;"+ arrayMailAccounts[i].identities[j].email + "&gt; " +
                           "<span style=\"color:#808080\"><i>" +
                           arrayMailAccounts[i].name +
                           "</i></span>";
          accountsAndIdentities.identities[arrayMailAccounts[i].identities[j].id] = {
            email: arrayMailAccounts[i].identities[j].email,
            prettyName: prettyName,
            accountId: arrayMailAccounts[i].id,
          };
        }
      }
      // console.log("accountsAndIdentities:", accountsAndIdentities);

      // get stored settings
      browser.storage.sync.get("guiState").then(
        (result) => {
          if (result.guiState !== undefined) {
            guiState = result.guiState;
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
        },
        (error) => console.log("Error: storage get guiState failed ", error)
      );
      browser.storage.sync.get("settings").then(
        (result) => {
          if (result.settings !== undefined) {
            settings = checkSettings(result.settings);
          } else {
            // defaults
            // leave empty at the moment
          }
          if (settings.migrate === undefined) {
            // not yet called, call it once
            migrateSettings().then( () => {
              settings.migrate = true;
              console.log("settings migrated");
              browser.storage.sync.set({ guiState, settings });
            });
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
  var isMatch = false;
  for (var idx in needles) {
    if (needles[idx] !== "") {
      // checking alias
      var match = /^\/(.*)\/$/.exec(needles[idx]);
      if (match) {
        // maybe: we have a RegExp
        try {
          if (haystack.match(new RegExp(RegExp.$1, "i"))) {
            isMatch = true;
            break;
          }
        } catch (err) {
          // called non blocking
          firePopup(
            "Error in RegExp",
            "Ignoring invalid regular expression:<br><br>" +
              "identity:  " +
              accountsAndIdentities.identities[warnIdentityId].email +
              "<br>" +
              "regexp:  " +
              needles[idx].replace(/\\/g, "\\\\") +
              "<br><br>" +
              "Please adjust in the Correct Identity " + warnText + " settings!",
            BUTTON_OK
          );
          needles[idx] = ""; // Skip this alias
        }
      } else {
        if (haystack.indexOf(needles[idx]) >= 0) {
          isMatch = true;
          break;
        }
      }
    }
  }
  return isMatch;
}

function getIdentity(identityId, recipientsList, replyHint) {
  var changed = false;
  var newIdentityId = "";
  var aliasedId = "";
  var explicitId = "";
  var replyId = "";

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
      if (replyHint !== "") {
        replyHint = replyHint.toLowerCase();
        var identityEmail = accountsAndIdentities.identities[identityId].email.toLowerCase();
        if (!((identityEmail.indexOf("@") != -1) && (replyHint.indexOf(identityEmail) >= 0))) {
          // the current identity email (=sender) is not in the replyHint
          // so check if we find a match matching identity
          for (let idxIdentity in settings.identitySettings) {
            let perIdentitySettings = settings.identitySettings[idxIdentity];
            var curIdentityEmail = accountsAndIdentities.identities[idxIdentity].email.toLowerCase();
            if (perIdentitySettings.detectable) {
              if ((curIdentityEmail.indexOf("@") != -1) && (replyHint.indexOf(curIdentityEmail) >= 0)) {
                // we found an identity that was mentioned in the hint
                replyId = idxIdentity;
              }
            }
          }
        }
      }

      // check for alias matches
      var recipientsString = recipientsList.join(" ").toLowerCase();
      if (replyHint !== "") {
        // if we have a replyHint, search also for replyHint
        recipientsString = recipientsString + " " + replyHint;
      }
      for (let idxIdentity in settings.identitySettings) {
        let perIdentitySettings = settings.identitySettings[idxIdentity];
        if (perIdentitySettings.detectable) {
          let detectionAliases = perIdentitySettings.detectionAliases.split(/\n+/);
          var isMatch = patternSearch(recipientsString, detectionAliases, idxIdentity, "Detection");
          if (isMatch) {
            aliasedId = idxIdentity;
          }
        }
      }
    }
  }

  // prioritized selection of resulting identity
  if (replyId !== "") {
    // return the matched identity  from the replyHint
    newIdentityId = replyId;
    changed = true;
  } else if (aliasedId !== "") {
    // we have a match from the alias list
    newIdentityId = aliasedId;
    changed = true;
  } else if (explicitId !== "") {
    // an explicit identity was defined
    newIdentityId = explicitId;
    changed = true;
  }

  return {
    changed: changed,
    newIdentityId: newIdentityId,
  };
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
    var isMatch = patternSearch(recipient, warningAliases, identityId, "Safety");
    if (isMatch) {
      warnRecipients += "<br>" + recipient;
    }
  }

  return warnRecipients === "" ? true : firePopup(
    "Warning",
    browser.i18n.getMessage("warning", [
      accountsAndIdentities.identities[identityId].email,
      warnRecipients,
    ]),
    BUTTON_OK | BUTTON_CANCEL
  );
}

function checkComposeTab(tab) {
  messenger.compose.getComposeDetails(tab.id).then((gcd) => {
    var replyHint = "";
    var changed = false;
    var recipientsList = [];
    var entry = composeTabStatus[tab.id];
    var remainingPollsForAcceptingReplyHint = -1;
    var identityId = "";
    var gcdRecipientsList = gcd.to.concat(gcd.cc, gcd.bcc);  // we handle "to", "cc" and "bcc" fields
    if (entry) {
      if (entry.identitySetByUser) {
        // user has manually modified identity, so do not change it
        return;
      }

      // get current values and check for changes
      remainingPollsForAcceptingReplyHint = entry.remainingPollsForAcceptingReplyHint;
      identityId = entry.identityId;
      recipientsList = entry.recipientsList;

      // check if identityId has changed
      if (JSON.stringify(identityId) != JSON.stringify(gcd.identityId)) {
        identityId = gcd.identityId;
        changed = true;
      }

      // check if recipients have changed
      if (JSON.stringify(recipientsList) != JSON.stringify(gcdRecipientsList)) {
        recipientsList = gcdRecipientsList;
        changed = true;
      }
    } else {
      // new tab detected
      remainingPollsForAcceptingReplyHint = 2;  // check 2 times in total
      identityId = gcd.identityId;
      recipientsList = gcdRecipientsList;
      changed = true;
    }

    // Check if we have received a matching replyHint from the experiments API.
    // Give one poll cycle for the replyHint to be received via onReplyHintCaptured event
    // later arriving events may belong to other compose windows.
    if (remainingPollsForAcceptingReplyHint > 0) {
      remainingPollsForAcceptingReplyHint--;
      for (var i in replyHints) {
        if (gcd.subject.includes(replyHints[i].subject) && (gcd.identityId === replyHints[i].origIdentityId)) {
          // matching reply hint found
          replyHint = replyHints[i].hint;
          replyHints.splice(i, 1);  // remove from array, so only reported once
          remainingPollsForAcceptingReplyHint = 0;
          changed = true;
          break;
        }
      }
    }

    // store status in global object
    composeTabStatus[tab.id] = {
      identityId: identityId,
      recipientsList: recipientsList,
      // replyHint is not stored, we only handle it once after opening the compose window
      remainingPollsForAcceptingReplyHint : remainingPollsForAcceptingReplyHint,
    };

    if (changed) {
      handleComposeTabChanged(tab.id, tab.windowId, identityId, recipientsList, replyHint);
    }
  }, () => {/* errors are ignored */});
}

function handleComposeTabChanged(tabId, windowId, identityId, recipientsList, replyHint) {
  var result = getIdentity(identityId, recipientsList, replyHint);
  if (result.changed) {
    // change identityId
    composeTabStatus[tabId].changedByUs = true;
    var details = {
      identityId : result.newIdentityId,
    };

    // changing identity makes focus jump to "to"
    // so save focus before changing identity
    browser.exp.saveCurrentFocus(windowId);

    messenger.compose.setComposeDetails(tabId, details);

    // ... and restore focus
    browser.exp.restoreCurrentFocus(windowId);
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
  if (request.msgType === "GET_SETTINGS_REQ") {
    sendResponse({
      msgType: "GET_SETTINGS_REP",
      settings: settings,
      accountsAndIdentities: accountsAndIdentities,
      guiState: guiState,
    });
  } else if (request.msgType === "SET_SETTINGS_REQ") {
    guiState = request.guiState;
    settings = request.settings;
    browser.storage.sync.set({ guiState, settings });
  } else if (request.msgType === "CLOSE_WINDOW") {
    dialogResults[request.windowId] = request.result;
    browser.windows.remove(request.windowId);
  } else {
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


function onReplyHintCaptured(hint, origIdentityId, composeType, subject) {
  var replyHint = {
    hint : hint,
    origIdentityId : origIdentityId,
    composeType : composeType,
    subject : subject
  };
  replyHints.push(replyHint);
}

function onRecipientsChanged(tabId) {
  browser.tabs.get(tabId).then( tab => {
    checkComposeTab(tab);
  });
}

function onTabCreated(tab) {
  messenger.compose.getComposeDetails(tab.id).then((gcd) => {
    // composeDetails exist -> we are a compose window
    browser.exp.installOnRecipientsChangedHook(tab.id, tab.windowId);
    checkComposeTab(tab);
  }, () => {/* errors are ignored */});
}


initSettings();

browser.exp.installGetIdentityForHeaderHook();
browser.exp.onReplyHintCaptured.addListener(onReplyHintCaptured);
browser.exp.onRecipientsChanged.addListener(onRecipientsChanged);

browser.tabs.onCreated.addListener(onTabCreated);

browser.runtime.onMessage.addListener(handleMessage);

messenger.compose.onIdentityChanged.addListener(onIdentityChangedListener);
messenger.compose.onBeforeSend.addListener(onBeforeSendListener);

// to test empty storage uncomment next line once
// browser.storage.sync.clear();
