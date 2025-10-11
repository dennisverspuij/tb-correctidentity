let accountsAndIdentities = {
  accounts: {}, // key:id, values: prettyName, index, defaultIdentityId, type
  identities: {} // key:id, values: email, accountId, prettyName, prettyNameDebug
};

let guiState = {
  currentAccountId: "",
  currentDetectionIdentity: "",
  currentSafetyIdentity: ""
};

let settings = {
  accountSettings: {},  // key: accountId; values: identityMechanism, explicitIdentity, replyFromRecipient
  identitySettings: {}, // key: identityId; values: detectable, keepRecipientAddress, removeSenderFromRecipients, detectionAliases, warningAliases
  // migrate   ... property will be dynamically added if old prefs were migrated
  additionalHeaderFields: []
};

let initSettingsDone = {
  guiState : false,
  settings : false,
  accountsAndIdentities : false
};

//capture last recorded state of compose tab to detect changes to "identityId" or to "to"
let composeTabStatus = {}; // key:tabId values: initialIdentityId, allRecipientsList, changedByUs,
//                             identitySetByUser, origRecipientsList

var dialogResults = {}; // key:windowId

// FIXME: are there somewhere global constants available?
// used for interfacing to dialog.js
const BUTTON_OK = 1;
const BUTTON_CANCEL = 2;

let onSettingsChanged;  // a callback from option.js

function notifySettingsChanged() {
  if (onSettingsChanged !== undefined) {
    if (initSettingsDone.guiState && initSettingsDone.settings && initSettingsDone.accountsAndIdentities) {
      onSettingsChanged({
        msgType: "GET_SETTINGS_REP",
        settings: settings,
        accountsAndIdentities: accountsAndIdentities,
        guiState: guiState
      });
    }
  }
}

// defaults
const accountSettingDefaults   = {
  "identityMechanism":0,
  // explicitIdentity is the defaultIdentityId from resp. account
  "replyFromRecipient":true,
}

const identitySettingsDefaults = {
  "detectable":true,
  "keepRecipientAddress":false,
  "removeSenderFromRecipients":true,
  "detectionAliases":"",
  "warningAliases":"",
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
    let as = inSettings.accountSettings[idx];
    if (as.identityMechanism === undefined) {
      as.identityMechanism = accountSettingDefaults.identityMechanism;
    }
    if (as.explicitIdentity === undefined) {
      as.explicitIdentity = accountsAndIdentities.accounts[idx].defaultIdentityId;
    }
    if (as.replyFromRecipient === undefined) {
      as.replyFromRecipient = accountSettingDefaults.replyFromRecipient;
    }
  }

  if (inSettings.identitySettings === undefined) {
    inSettings.identitySettings = {};
  }

  if (inSettings.additionalHeaderFields === undefined) {
    inSettings.additionalHeaderFields = [];
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
    let is = inSettings.identitySettings[idx];
    if (is.detectable === undefined) {
      is.detectable = identitySettingsDefaults.detectable;
    }
    if (is.keepRecipientAddress === undefined) {
      is.keepRecipientAddress = identitySettingsDefaults.keepRecipientAddress;
    }
    if (is.removeSenderFromRecipients === undefined) {
      is.removeSenderFromRecipients = identitySettingsDefaults.removeSenderFromRecipients;
    }
    if (is.detectionAliases === undefined) {
      is.detectionAliases = identitySettingsDefaults.detectionAliases;
    }
    if (is.warningAliases === undefined) {
      is.warningAliases = identitySettingsDefaults.warningAliases;
    }
  }
  return inSettings;
}


function cleanSettings(inSettings) {
  // make a deep copy via string conversion
  let settingsTmp    = JSON.parse(JSON.stringify(inSettings));

  // remove defaults from account settings
  for (let idx in settingsTmp.accountSettings) {
    if (settingsTmp.accountSettings[idx].identityMechanism === accountSettingDefaults.identityMechanism) {
      delete settingsTmp.accountSettings[idx].identityMechanism
    }
    if (settingsTmp.accountSettings[idx].explicitIdentity === accountsAndIdentities.accounts[idx].defaultIdentityId) {
      delete settingsTmp.accountSettings[idx].explicitIdentity
    }
    if (settingsTmp.accountSettings[idx].replyFromRecipient === accountSettingDefaults.replyFromRecipient) {
      delete settingsTmp.accountSettings[idx].replyFromRecipient
    }

    if (Object.keys(settingsTmp.accountSettings[idx]).length === 0) {
      delete settingsTmp.accountSettings[idx]
    }
  }

  // remove defaults from identity settings
  for (let idx in settingsTmp.identitySettings) {
    if (settingsTmp.identitySettings[idx].detectable === identitySettingsDefaults.detectable) {
      delete settingsTmp.identitySettings[idx].detectable
    }
    if (settingsTmp.identitySettings[idx].keepRecipientAddress === identitySettingsDefaults.keepRecipientAddress) {
      delete settingsTmp.identitySettings[idx].keepRecipientAddress
    }
    if (settingsTmp.identitySettings[idx].removeSenderFromRecipients === identitySettingsDefaults.removeSenderFromRecipients) {
      delete settingsTmp.identitySettings[idx].removeSenderFromRecipients
    }
    if (settingsTmp.identitySettings[idx].detectionAliases === identitySettingsDefaults.detectionAliases) {
      delete settingsTmp.identitySettings[idx].detectionAliases
    }
    if (settingsTmp.identitySettings[idx].warningAliases === identitySettingsDefaults.warningAliases) {
      delete settingsTmp.identitySettings[idx].warningAliases
    }

    if (Object.keys(settingsTmp.identitySettings[idx]).length === 0) {
      delete settingsTmp.identitySettings[idx]
    }
  }

  return settingsTmp;
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

// read settings from storage
async function initSettings() {
  try {
    // get all accounts and identities from thunderbird
    let arrayMailAccounts = await messenger.accounts.list();
    // console.log("arrayMailAccounts:", arrayMailAccounts);
    let iIndex = 0;
    for (let i in arrayMailAccounts) {
      // determine default identity of this account
      let defaultIdentity = arrayMailAccounts[i].identities[0];
      let defaultIdentityId;

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

      for (let j in arrayMailAccounts[i].identities) {
        const identity = arrayMailAccounts[i].identities[j];
        let prettyName = `${identity.name} <${identity.email}>`;
        let prettyNameDebug = `${identity.email}`;

        if (identity.label !== "") {
          prettyName += ` (${identity.label})`;
          prettyNameDebug += ` (${identity.label})`;
        }

        prettyNameDebug += `(account: ${arrayMailAccounts[i].name})`;

        accountsAndIdentities.identities[identity.id] = {
          email: identity.email,
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
  } catch (error) {
    console.error(`Error failureCallback: ${error}`);
  }

  // get stored settings
  try {
    let result = await messenger.storage.sync.get("guiState");
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
  } catch (error) {
    console.log("Error: storage get guiState failed ", error);
  }

  try {
    let result = await messenger.storage.sync.get("settings");
    // checkSettings (also adds defaults if undefined)
    settings = checkSettings(result.settings);
    // should we save, if changed?

    initSettingsDone.settings = true;
    notifySettingsChanged();
  } catch (error) {
    console.log("Error: storage get settings failed ", error);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function windowExists(winId) {
  try {
    let window = await messenger.windows.get(winId);
    return !!window;
  } catch (ex) {
    return false;
  }
}

// does not exit until window closed
// returns true, if "OK" pressed
async function firePopup(title, text, buttons) {
  try {
    // build script which fires alert
    let winId = "";
    let result = false;
    let cw = await messenger.windows.getCurrent();

    let window = await messenger.windows
      .create({
        type: "popup",
        width: 400,
        height: 300,
        left: cw.left + 20,
        top: cw.top + 20,
        url:
          `dialog.html?buttons=${encodeURIComponent(buttons)}&title=${encodeURIComponent(title)}` +
          `&string=${encodeURIComponent(text)}`,
      });
    winId = window.id;

    // wait until window closed
    while (true) {
      // check if window is still open
      let exists = await windowExists(winId);
      if (!exists) {
        break;
      }
      await sleep(1000);
    }
    if (dialogResults[winId] !== undefined) {
      result = (dialogResults[winId] & BUTTON_OK) !== 0;
    }
    return result;
  } catch (error) {
    console.log("Error: firePopup failed ", error);
    return false;
  }
}


// check if text element at idx could be an email address
function getMatchedMailAddress(haystack, idx) {
  // cut at tabs (used as separator)) left and right
  let spaceIdx = haystack.indexOf("\t", idx);
  if (spaceIdx > 0) {
    // cut at end
    haystack = haystack.substring(0, spaceIdx);
  }
  spaceIdx = haystack.lastIndexOf("\t");
  if (spaceIdx > 0) {
    // remove before
    haystack = haystack.substring(spaceIdx + 1);
  }

  // eslint-disable-next-line
  let emailValidationRegex = /^(?:([^<]*?)\s*<)?((?:[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\]))>?$/;
  if (haystack.match(emailValidationRegex)) {
    return haystack;
  }

  return "";
}

async function patternSearch(haystack, needles, warnIdentityId, warnText) {
  for (let i in needles) {
    let needle = needles[i];
    // check search terms
    if (needle.match(/^\s*$/)) {
      continue; // skip empty lines
    }
    let isRegex = needle.match(/^\s*\/(.*)\/\s*$/);
    if (isRegex) {
      // maybe we have a RegExp
      try {
        const regex = new RegExp(isRegex[1], 'i');  // flag 'i': case insensitive
        let res = haystack.match(regex)
        if (res) {
          let matchedMailAddress = getMatchedMailAddress(haystack, res[1])
          return [true, matchedMailAddress];
        }
      } catch (err) {
        // called non-blocking
        firePopup(
          "Error in RegExp",
          `Ignoring invalid regular expression:\n\n` +
            `identity:  ${accountsAndIdentities.identities[warnIdentityId].email}\n` +
            `regexp:  ${needle.replace(/\\/g, "\\\\")}\n\n` +
            `Please adjust in the Correct Identity ${warnText} settings!`,
          BUTTON_OK
        );
      }
    } else if (needle.startsWith("addressbook=")) {
      // get name, remove leading or trailing quotes
      let addressbookName = needle.substring("addressbook=".length).replaceAll("\"", "");
      let addressbooks = await messenger.addressBooks.list();
      for (let abIdx in addressbooks) {
        if (addressbooks[abIdx].name == addressbookName) {
          contacts = await  messenger.contacts.list(addressbooks[abIdx].id);
          for (let ctctIdx in contacts) {
            let vCard = new ICAL.Component(ICAL.parse(contacts[ctctIdx].properties.vCard));
            let email = vCard.getAllProperties("email")
            for (let entryIdx in email) {
              let matchIdx = haystack.toLowerCase().indexOf(email[entryIdx].jCal[3].toLowerCase()) ;
              if (matchIdx >= 0) {
                let matchedMailAddress = getMatchedMailAddress(haystack, matchIdx)
                return [true, matchedMailAddress];
              }
            }
          }
        }
      }
    } else if (needle.startsWith("mailinglist=")) {
      // get name, remove leading or trailing quotes
      let mailinglistName = needle.substring("mailinglist=".length).replaceAll("\"", "");
      let addressbooks = await messenger.addressBooks.list();
      for (let abIdx in addressbooks) {
        let mailingLists = await messenger.mailingLists.list(addressbooks[abIdx].id)
        for (let mlIdx in mailingLists) {
          if (mailingLists[mlIdx].name == mailinglistName) {
            contacts = await  messenger.mailingLists.listMembers(mailingLists[mlIdx].id)
            for (let ctctIdx in contacts) {
              let vCard = new ICAL.Component(ICAL.parse(contacts[ctctIdx].properties.vCard));
              let email = vCard.getAllProperties("email")
              for (let entryIdx in email) {
                let matchIdx = haystack.toLowerCase().indexOf(email[entryIdx].jCal[3].toLowerCase()) ;
                if (matchIdx >= 0) {
                  let matchedMailAddress = getMatchedMailAddress(haystack, matchIdx)
                  return [true, matchedMailAddress];
                }
              }
            }
          }
        }
      }
    } else if (haystack.toLowerCase().indexOf(needle.toLowerCase()) >= 0) {
      let matchedMailAddress = getMatchedMailAddress(haystack, haystack.toLowerCase().indexOf(needle.toLowerCase()));
      return [true, matchedMailAddress];
    }
  }
  return [false, ""];
}

// Compute identity based on allRecipientsList, explicitIdentity,
// replyFromRecipient, and detectionAliases.
async function getIdentity(tabId, identityId, allRecipientsList, origRecipientsList) {
  let newIdentityId = identityId;
  let newFromAddress = "";  // only used if keepRecipientAddress is enabled
  let aliasedId = "";
  let aliasFromAddress = "";  // only used if keepRecipientAddress is enabled
  let explicitId = "";
  let replyId = "";

  console.log("getIdentity called with identityId:", identityId,
              " allRecipientsList:", JSON.stringify(allRecipientsList), " origRecipientsList:", origRecipientsList);

  console.log(identityId, ":", accountsAndIdentities.identities[identityId].prettyNameDebug);

  let accountId = accountsAndIdentities.identities[identityId].accountId;

  let perAccountSettings = settings.accountSettings[accountId];

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
        for (let origRecipient of origRecipientsList) {
          let replyHint = origRecipient.toLowerCase();
          let identityEmail = accountsAndIdentities.identities[identityId].email.toLowerCase();
          console.log(`this is identityEmail: ${identityEmail}`);
          if (identityEmail.indexOf("@") === -1 || replyHint.indexOf(identityEmail) === -1) {
            // the current identity email (=sender) is not in the replyHint
            // so check if we find a matching identity
            for (let idxIdentity in settings.identitySettings) {
              let perIdentitySettings = settings.identitySettings[idxIdentity];
              let curIdentityEmail = accountsAndIdentities.identities[idxIdentity].email.toLowerCase();
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
      // use tab to separate entries in concatenated string
      let recipientsString = allRecipientsList.join("\t");
      if (origRecipientsList) {
        // if we have a origRecipients, search also for origRecipients
        for (let origRecipient of origRecipientsList) {
          // use tab to separate entries in concatenated string
          recipientsString = `${recipientsString}\t${origRecipient}`;
        }
      }
      for (let idxIdentity in settings.identitySettings) {
        let perIdentitySettings = settings.identitySettings[idxIdentity];
        if (perIdentitySettings.detectable) {
          let detectionAliases = perIdentitySettings.detectionAliases.split(/\n+/);
          let [isMatch, matchedMailAddress] = await patternSearch(recipientsString, detectionAliases,
                                                                  idxIdentity, "Detection"); // TODO: i18n
          if (isMatch) {
            aliasedId = idxIdentity;
            if (perIdentitySettings.keepRecipientAddress) {
              aliasFromAddress = matchedMailAddress;
            }
            break;
          }
        }
      }
    }
  }

  // prioritized selection of resulting identity
  if ((replyId !== "")  && (!composeTabStatus[tabId].replyHintConsumed)) {
    // return the matched identity from the replyHint
    console.log("matched identity from the replyHint (high prio)");
    newIdentityId = replyId;
    composeTabStatus[tabId].replyHintConsumed = true;
  } else if (explicitId !== "") {
    // an explicit identity was defined
    console.log("using explicit identity");
    newIdentityId = explicitId;
  } else if (aliasedId !== "") {
    // we have a match from the alias list
    console.log("match from the alias list");
    newIdentityId  = aliasedId;
    newFromAddress = aliasFromAddress;
  } else if ((replyId !== "")  && (composeTabStatus[tabId].replyHintConsumed)) {
    // return the matched identity from the replyHint
    console.log("matched identity from the replyHint (low prio)");
    newIdentityId = replyId;
  } else {
    console.log("using default identity");
  }

  console.log("getIdentity returns newIdentityId:", newIdentityId);
  console.log(newIdentityId, ":", accountsAndIdentities.identities[newIdentityId].prettyNameDebug);
  if (newFromAddress !=="") {
    console.log("getIdentity returns also newFromAddress:", newFromAddress);
  }

  return [newIdentityId, newFromAddress];
}

// returns true if ok-to-send
async function sendConfirm(identityId, recipients) {
  let perIdentitySettings = settings.identitySettings[identityId];
  if (perIdentitySettings === undefined) {
    // nothing configured
    return true;
  }
  let warningAliases = perIdentitySettings.warningAliases.split(/\n+/);
  let warnRecipients = "";

  for (let idxRecipient in recipients) {
    let recipient = recipients[idxRecipient];
    let [isMatch, _matchedMailAddress] = await patternSearch(recipient, warningAliases,
                                                             identityId, "Safety"); // TODO: i18n
    if (isMatch) {
      warnRecipients += `\n${recipient}`;
    }
  }

  return warnRecipients === "" ? true : firePopup(
    "Warning", // TODO: i18n
    messenger.i18n.getMessage("warning", [
      accountsAndIdentities.identities[identityId].email,
      warnRecipients,
    ]),
    BUTTON_OK | BUTTON_CANCEL
  );
}

async function testGetFull(msgId) {
  try {
    let msgPart = await messenger.messages.getFull(msgId);
    console.log("getFull(msgId): MessagePart.headers", msgPart.headers);
  } catch (error) {
    console.log("Error: messages.getFull failed ", error);
  }
}

async function checkComposeTab(tab) {
  try {
    let gcd = await messenger.compose.getComposeDetails(tab.id);
    let changed = false;
    let allRecipientsList = [];
    let toRecipientsList = [];
    let ccRecipientsList = [];
    let entry = composeTabStatus[tab.id];
    let initialIdentityId = "";
    let relatedMessageId = "";
    let currentIdentityId = gcd.identityId;
    let gcdAllRecipientsList = gcd.to.concat(gcd.cc, gcd.bcc);  // we handle "to", "cc" and "bcc" fields
    let replyHintConsumed = false;

    if (entry) {
      if (entry.identitySetByUser) {
        // user has manually modified identity, so do not change it
        return;
      }

      // get current values
      initialIdentityId = entry.initialIdentityId;
      allRecipientsList = entry.allRecipientsList;
      relatedMessageId  = entry.relatedMessageId;
      replyHintConsumed = entry.replyHintConsumed;

      // check if recipients have changed
      if (JSON.stringify(allRecipientsList) != JSON.stringify(gcdAllRecipientsList)) {
        allRecipientsList = gcdAllRecipientsList;
        toRecipientsList = gcd.to;
        ccRecipientsList = gcd.cc;
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
      replyHintConsumed = false;
    }


    // store status in global object
    composeTabStatus[tab.id] = {
      initialIdentityId : initialIdentityId,
      allRecipientsList : allRecipientsList,
      toRecipientsList  : toRecipientsList,
      ccRecipientsList  : ccRecipientsList,
      relatedMessageId  : relatedMessageId,
      replyHintConsumed : replyHintConsumed,
    };

    if (changed) {
      let origRecipientsList = [];
      if (relatedMessageId) {
        testGetFull(relatedMessageId);
        let msgHdr = await messenger.messages.get(relatedMessageId);
        // recipients is only "to", append also "cc"
        origRecipientsList = msgHdr.recipients.concat(msgHdr.ccList);

        if (gcd.type === "forward") {
          // append also the original author
          // (for "reply-to", the author is also detected, but via the automatically generated "to" entry)
          origRecipientsList = origRecipientsList.concat(msgHdr.author);
        }

        if (settings.additionalHeaderFields) {
          // we should also collect information from other header fields
          let msgPart = await messenger.messages.getFull(relatedMessageId);
          console.log("getFull(msgId): MessagePart.headers", msgPart.headers);
          // add found headers to begining of origRecipientsList, to keep order, we start with last key
          for (let i = settings.additionalHeaderFields.length - 1; i >= 0; i--) {
            if (settings.additionalHeaderFields[i][0]) {
              let headerArray = msgPart.headers[settings.additionalHeaderFields[i][0]];
              if (headerArray) {
                if (settings.additionalHeaderFields[i][1]) {
                  // with occurence number
                  let oN = settings.additionalHeaderFields[i][1];
                  if (headerArray.length >= oN) {
                    origRecipientsList.unshift(headerArray[oN-1]);
                  }
                } else {
                  // without occurence number: take all
                  for (let j = 0; j < headerArray.length; j++) {
                    origRecipientsList.unshift(headerArray[j]);
                  }
                }
              }
            }
          }
        }
      }
      handleComposeTabChanged(tab.id, initialIdentityId, currentIdentityId,
                              allRecipientsList, origRecipientsList);
    }
  } catch (error) {
    /* errors are ignored */
  }
}

function searchAndRemoveFromRecipientList(recipientsList, email) {
  for (let recipientIdx = 0;  recipientIdx < recipientsList.length; recipientIdx++) {
    if (recipientsList[recipientIdx].includes(email)) {
      // remove from list
      recipientsList.splice(recipientIdx,1);
      return true;
    }
  }
  return false;
}

async function handleComposeTabChanged(tabId, initialIdentityId, currentIdentityId,
                                       allRecipientsList, origRecipientsList) {
  let [newIdentityId, newFromAddress] = await getIdentity(tabId, initialIdentityId,
                                                          allRecipientsList, origRecipientsList);
  if (newIdentityId !== currentIdentityId) {
    // change identityId
    composeTabStatus[tabId].changedByUs = true;
    let details = {
      identityId : newIdentityId,
    };

    // Use custom original sender address if Identity Email is not equal to Original
    // Recipient Email (first entry of the list)
    // Plus: Check if newIdentityId was in "to", "cc" or "cc". Remove it from there
    // Both: If configured, respect the settings.
    try {
      let newIdentity = await messenger.identities.get(newIdentityId);
      let newIdentityEmail = newIdentity.email;
      let perIdentitySettings = settings.identitySettings[newIdentityId];

      if (perIdentitySettings.keepRecipientAddress) {
        // Keep matched entry as from address
        if (newFromAddress !== "") {
          details.from     = newFromAddress;

          // overwrite for removal below
          newIdentityEmail = newFromAddress;
        }
      }

      if (perIdentitySettings.removeSenderFromRecipients) {
        // remove sender address from recipients
        if (searchAndRemoveFromRecipientList(composeTabStatus[tabId].toRecipientsList, newIdentityEmail)) {
          // found in "to"
          details.to = composeTabStatus[tabId].toRecipientsList;
        } else if (searchAndRemoveFromRecipientList(composeTabStatus[tabId].ccRecipientsList, newIdentityEmail)) {
          // found in "cc"
          details.cc = composeTabStatus[tabId].ccRecipientsList;
        }
      }

      messenger.compose.setComposeDetails(tabId, details);
    } catch (error) {
      /* errors are ignored */
    }
  }
}

function onIdentityChangedListener(tab, _identityId) {
  if (composeTabStatus[tab.id].changedByUs) {
    composeTabStatus[tab.id].changedByUs = false;
  } else {
    composeTabStatus[tab.id].identitySetByUser = true;
  }
}

//we need to wait for confirmations -> async function
async function onBeforeSendListener(_tab, details) {
  let result = await sendConfirm(details.identityId, details.to.concat(details.cc, details.bcc));

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
    // for direct calls create a local object copy via JSON stringify/parse
    guiState = JSON.parse(JSON.stringify(request.guiState));
    settings = JSON.parse(JSON.stringify(request.settings));
    let cleanedSettings = cleanSettings(settings);
    messenger.storage.sync.set({
      "guiState" : guiState,
      "settings" : cleanedSettings
    });
  } else if (request.msgType === "CLOSE_WINDOW") {
    dialogResults[request.windowId] = request.result;
    messenger.windows.remove(request.windowId);
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

async function onRecipientsChanged(tabId) {
  try {
    let tab = await messenger.tabs.get(tabId);
    checkComposeTab(tab);
  } catch(error) {
    console.log("Error: tabs.get failed ", error);
  }
}

function onComposeTabReady(tab) {
  messenger.exp.installOnRecipientsChangedHook(tab.id, tab.windowId);
  checkComposeTab(tab);
}

function browserActionClicked(_tab, _info) {
  // bring configuration up
  messenger.runtime.openOptionsPage();
}

initSettings();

messenger.exp.onRecipientsChanged.addListener(onRecipientsChanged);

messenger.runtime.onMessage.addListener(handleMessage);

messenger.compose.onIdentityChanged.addListener(onIdentityChangedListener);
messenger.compose.onBeforeSend.addListener(onBeforeSendListener);
messenger.composeScripts.register({ js : [{file: "scripts/compose.js"}] });

messenger.browserAction.onClicked.addListener(browserActionClicked);

// to test empty storage uncomment next line once
// messenger.storage.sync.clear();
