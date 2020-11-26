// TODO: replyFromRecipient handling

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
};

//capture last recorded state of compose tab to detect changes to "identity" or to "to"
var composeTabStatus = {}; // key:tabId values:identity, to, changedByUs, identitySetByUser

var dialogResults = {}; // key:windowId

// FIXME: are there somewhere global constants available?
const BUTTON_OK = 1;
const BUTTON_CANCEL = 2;

//check that all fields are present (e.g. for upgrades)
function checkSettings(inSettings) {
  for (let idx in inSettings.accountSettings) {
    as = inSettings.accountSettings[idx];
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
    is = inSettings.identitySettings[idx];
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

//read settings from storage
function initSettings() {
  // get all accounts and identitites from thunderbird
  messenger.accounts.list().then(
    (arrayMailAccounts) => {
      let iIndex = 0;
      for (var i in arrayMailAccounts) {
        // determine default identity of this account
        defaultIdentity = arrayMailAccounts[i].identities[0];
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
          accountsAndIdentities.identities[
            arrayMailAccounts[i].identities[j].id
          ] = {
            email: arrayMailAccounts[i].identities[j].email,
            accountId: arrayMailAccounts[i].id,
          };
        }
      }

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
        (error) => console.log(`Error: storage get guiState failed ${error}`)
      );
      browser.storage.sync.get("settings").then(
        (result) => {
          if (result.settings !== undefined) {
            settings = checkSettings(result.settings);
          } else {
            // defaults
            // leave empty at the moment
          }
        },
        (error) => console.log(`Error: storage get settings failed ${error}`)
      );
    },
    (error) => {
      console.error("Error failureCallback: " + error);
    }
  );
}
function window_closer(e) {}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function windowExists(winId) {
  var exists = false;
  await browser.windows.get(winId).then(
    (window) => {
      exists = true;
    },
    function () {
      exists = false;
    }
  );
  return exists;
}

// does not exit until window closed
// returns true, if "OK" pressed
async function firePopup(tabId, title, text, buttons) {
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

function getIdentity(tabId, identityId, toList) {
  var changed = false;
  var newIdentityId = "";
  var aliasedId = "";
  var explicitId = "";
  accountId = accountsAndIdentities.identities[identityId].accountId;

  perAccountSettings = settings.accountSettings[accountId];

  if (perAccountSettings !== undefined) {
    switch (perAccountSettings.identityMechanism) {
      case 1:
        explicitId = perAccountSettings.explicitIdentity;
        break;
      // Room for more options in the future
    }
  }

  recipientsString = toList.join(" ").toLowerCase();
  for (var idxIdentity in settings.identitySettings) {
    perIdentitySettings = settings.identitySettings[idxIdentity];
    if (perIdentitySettings.detectable) {
      // could check hints here? from old code? lowercase?

      let detectionAliases = perIdentitySettings.detectionAliases.split(/\n+/);
      for (var idxAlias in detectionAliases) {
        if (detectionAliases[idxAlias] !== "") {
          // checking alias
          match = /^\/(.*)\/$/.exec(detectionAliases[idxAlias]);
          if (match) {
            // maybe: we have a RegExp
            try {
              if (recipientsString.match(new RegExp(RegExp.$1, "i"))) {
                aliasedId = idxIdentity;
              }
            } catch (err) {
              // called non blocking
              firePopup(
                tabId,
                "Error in RegExp",
                "Ignoring invalid regular expression:<br><br>" +
                  "identity:  " +
                  accountsAndIdentities.identities[idxIdentity].email +
                  "<br>" +
                  "regexp:  " +
                  detectionAliases[idxAlias].replace(/\\/g, "\\\\") +
                  "<br><br>" +
                  "Please adjust in the Correct Identity Detection settings!",
                BUTTON_OK
              );
            }
          } else {
            if (recipientsString.indexOf(detectionAliases[idxAlias]) >= 0) {
              aliasedId = idxIdentity;
            }
          }
        }
      }
    }
  }

  if (aliasedId !== "") {
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
  perIdentitySettings = settings.identitySettings[identityId];
  if (perIdentitySettings === undefined) {
    // nothing configured
    return true;
  }
  let warningAliases = perIdentitySettings.warningAliases.split(/\n+/);
  let warnRecipients = "";

  for (var idxRecipient in recipients) {
    recipient = recipients[idxRecipient];
    for (var idxWarningAlias in warningAliases) {
      alias = warningAliases[idxWarningAlias];
      if (alias !== "") {
        if (/^\/(.*)\/$/.exec(alias)) {
          try {
            if (recipient.match(new RegExp(RegExp.$1, "i"))) {
              warnRecipients += "<br>- " + recipient;
            }
          } catch (err) {
            await firePopup(
              tabId,
              "Error in RegExp",
              "Ignoring invalid regular expression:<br><br>" +
                "identity:  " +
                accountsAndIdentities.identities[identityId].email +
                "<br>" +
                "regexp:  " +
                alias.replace(/\\/g, "\\\\") +
                "<br><br>" +
                "Please adjust in the Correct Identity Safety settings!",
              BUTTON_OK
            );
            warningAliases[idxWarningAlias] = ""; // Skip this alias
            // next recipient
          }
        } else if (recipient.indexOf(alias) >= 0)
          warnRecipients += "<br>" + recipient;
      }
    }
  }
  return warnRecipients === "" ? true : firePopup(
        tabId,
        "Warning",
        browser.i18n.getMessage("warning", [
          accountsAndIdentities.identities[identityId].email,
          warnRecipients,
        ]),
        BUTTON_OK | BUTTON_CANCEL
      );
}

function checkComposeTab(tabId) {
  messenger.compose.getComposeDetails(tabId).then((gcd) => {
    entry = composeTabStatus[tabId];
    if (entry) {
      if (entry.identitySetByUser) {
        // user has manually modified identity, so do not change it
        return;
      }
      changed =
        JSON.stringify(entry.identity) != JSON.stringify(gcd.identityId) ||
        JSON.stringify(entry.to) != JSON.stringify(gcd.to);
    } else {
      // new tab detected
      changed = true;
    }
    composeTabStatus[tabId] = {
      identity: gcd.identityId,
      to: gcd.to,
    };
    if (changed) {
      handleComposeTabChanged(tabId, gcd.identityId, gcd.to);
    }
  }, function(){});
}

function checkComposeTabs() {
  // try to find all tabs
  queryInfo = {};
  messenger.tabs.query(queryInfo).then((tabs) => {
    for (var i in tabs) {
      checkComposeTab(tabs[i].id);
    }
  });
}


//test correct identity method
function handleComposeTabChanged(tabId, identityId, toList) {
result = getIdentity(tabId, identityId, toList);
if (result.changed) {
  // change identity
  messenger.compose.getComposeDetails(tabId).then((details) => {
    composeTabStatus[tabId].changedByUs = true;
    details.identityId = result.newIdentityId;
    // workaround for error: "Only one of body and plainTextBody can be specified."
    if (details.isPlainText) {
      details.body = null;
    } else {
      details.plainTextBody = null;
    }
    messenger.compose.setComposeDetails(tabId, details);
  });
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
var result = await sendConfirm(tab.id, details.identityId, details.to);

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

initSettings();

// start compose tab polling
setInterval(checkComposeTabs, 1000);

browser.runtime.onMessage.addListener(handleMessage);
messenger.compose.onIdentityChanged.addListener(onIdentityChangedListener);
messenger.compose.onBeforeSend.addListener(onBeforeSendListener);
