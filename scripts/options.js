var settings;
var accountsAndIdentities;
var guiState;

function notifySettingsChanged() {
  // send update to background script

  // circumvent bug in Thunderbird: replace sendMessage() with direct call into backgroundScript()
  // browser.runtime.sendMessage({
  //   msgType: "SET_SETTINGS_REQ",
  //   settings: settings,
  //   guiState: guiState,
  // });
  browser.extension.getBackgroundPage().handleMessage({
    msgType: "SET_SETTINGS_REQ",
    settings: settings,
    guiState: guiState,
  });
}

function getPerAccountSettingsOrDefault(accountId) {
  if (accountId === undefined) {
    throw "accountId has value \"undefined\"";
  }
  if (!(accountId in accountsAndIdentities.accounts)) {
    throw "accountId has unknown value";
  }
  var perAccountSettings = settings.accountSettings[accountId];
  if (perAccountSettings === undefined) {
    // not found in settings, set defaults
    perAccountSettings = {
      identityMechanism: 0,
      explicitIdentity: accountsAndIdentities.accounts[accountId].defaultIdentityId,
      replyFromRecipient: true,
    };
    settings.accountSettings[accountId] = perAccountSettings;
  }
  return perAccountSettings;
}

function getPerIdentitySettingsOrDefault(identityId) {
  if (identityId === undefined) {
    throw "identityId has value \"undefined\"";
  }
  if (!(identityId in accountsAndIdentities.identities)) {
    throw "identityId has unknown value";
  }
  var perIdentitySettings = settings.identitySettings[identityId];
  if (perIdentitySettings === undefined) {
    // not found in settings, set defaults
    perIdentitySettings = {
      detectable: true,
      detectionAliases: accountsAndIdentities[identityId].label,
      warningAliases: "",
    };
    settings.identitySettings[identityId] = perIdentitySettings;
  }
  return perIdentitySettings;
}

function fillSelectorList(elementId, toBeSelectedIdentityId) {
  // fill explicitId list for that account
  var selector = document.getElementById(elementId);

  // remove all items
  while (selector.options.length) {
    selector.remove(0);
  }

  let index = 0;
  for (var i in accountsAndIdentities.identities) {
    const identity = accountsAndIdentities.identities[i];
    let opt = document.createElement("option");
    // accountLabel is the localised "account" text
    // identityLabel is the localised "identity" text
    opt.setAttribute("aria-labelledby", "identityLabel labelIdentity"+i+" accountLabel labelAccount"+i);
    let label1 = document.createElement("label");
    label1.className = "menu-iconic-text";
    label1.id = "labelIdentity"+i;
    label1.textContent = identity.prettyName + " ";
    if (identity.label !== "") {
        label1.textContent += `(${identity.label}) `;
    }
    let label2 = document.createElement("label");
    label2.className = "menu-description";
    label2.id = "labelAccount"+i;
    label2.textContent = accountsAndIdentities.accounts[identity.accountId].prettyName;
    opt.value = i;
    opt.appendChild(label1);
    opt.appendChild(label2);
    selector.appendChild(opt);
    if (i == toBeSelectedIdentityId) {
      selector.selectedIndex = index;
    }
    index++;
  }
}

function updateGuiAccountChanged(accountId) {
  var perAccountSettings = getPerAccountSettingsOrDefault(accountId);

  fillSelectorList("explicitSelector", perAccountSettings.explicitIdentity);

  // select radio buttons for identityMechanism
  document.getElementById("defaultIdentity").checked =
    perAccountSettings.identityMechanism === 0;
  document.getElementById("explicitIdentity").checked =
    perAccountSettings.identityMechanism === 1;

  document.getElementById("explicitSelector").disabled =
    perAccountSettings.identityMechanism !== 1;
  document.getElementById("replyFromRecipient").checked =
    perAccountSettings.replyFromRecipient;

  var replyable =
    "rss,nntp".indexOf(accountsAndIdentities.accounts[accountId].type) == -1;
  document.getElementById("replyFromRecipient").disabled = !replyable;
}

function updateGuiDetectionIdentityChanged(newDetectionIdentityId) {
  // update Detection GUI
  var perIdentitySettings = getPerIdentitySettingsOrDefault(newDetectionIdentityId);

  document.getElementById("detectable").checked =
    perIdentitySettings.detectable;
  document.getElementById("detectionAliases").value =
    perIdentitySettings.detectionAliases;
}

function updateGuiSafetyIdentityChanged(newSafetyIdentityId) {
  // update Safety GUI
  var perIdentitySettings = getPerIdentitySettingsOrDefault(newSafetyIdentityId);

  document.getElementById("warningAliases").value =
    perIdentitySettings.warningAliases;
}

function updateAdditionalHeaderFields() {
  var str = "";
  for (let i=0; i< settings.additionalHeaderFields.length; i++) {
    // key value
    str = settings.additionalHeaderFields[i][0];

    // occurence value
    if (settings.additionalHeaderFields[i][1]) {
      str += "#" +settings.additionalHeaderFields[i][1];
    }
    str += "\n";
  }

  document.getElementById("additionalHeaderFields").value = str;
  notifySettingsChanged();
}


function accountSelectorChanged(result) {
  var sKey = result.target.value;

  var perAccountSettings = getPerAccountSettingsOrDefault(
    guiState.currentAccountId
  );
  // Remember preferences of currently showed account
  perAccountSettings.identityMechanism = document.getElementById("defaultIdentity").checked ? 0 : 1;
  perAccountSettings.explicitIdentity = document.getElementById("explicitSelector").value;
  perAccountSettings.replyFromRecipient = document.getElementById(
    "replyFromRecipient"
  ).checked;

  guiState.currentAccountId = sKey;

  notifySettingsChanged();

  updateGuiAccountChanged(sKey);
}

function explicitIdentityChanged(result) {
  var perAccountSettings = getPerAccountSettingsOrDefault(guiState.currentAccountId);
  perAccountSettings.explicitIdentity = result.target.value;
  notifySettingsChanged();
}

function identityMechanismChanged(result) {
  var perAccountSettings = getPerAccountSettingsOrDefault(guiState.currentAccountId);
  perAccountSettings.identityMechanism = parseInt(result.target.value, 10);

  // Update the form
  var explicitSelector = document.getElementById("explicitSelector");
  explicitSelector.disabled = (result.target.value != 1);
  if (explicitSelector.disabled) {
    // If not selected, restore the explicit identity to default identity for the account
    perAccountSettings.explicitIdentity =
      accountsAndIdentities.accounts[guiState.currentAccountId].defaultIdentityId;
    explicitSelector.selectedIndex = perAccountSettings.index;
  } else {
    // sync with gui display
    perAccountSettings.explicitIdentity = explicitSelector.value;
  }

  notifySettingsChanged();
}

function replyFromRecipientChanged(result) {
  var perAccountSettings = getPerAccountSettingsOrDefault(
    guiState.currentAccountId
  );
  perAccountSettings.replyFromRecipient = result.target.checked;
  notifySettingsChanged();
}

// expects multiple entries separated by newline
// format: headerkey#occurenceNumber
// #occurenceNumber is optional
// example: received#2
function additionalHeaderFieldsChanged(result) {
  settings.additionalHeaderFields.length = 0;
  var headerEntries = result.target.value.toLowerCase().split(/\n+/);
  for (let i = 0; i < headerEntries.length; i++) {
    var heFields = headerEntries[i].split('#');
    if (heFields.length > 1) {
      if (!Number.isNaN(heFields[1])) {
        settings.additionalHeaderFields.push(heFields);
      }
    } else {
      if (heFields[0]) {
        settings.additionalHeaderFields.push(heFields);
      }
    }
  }
  notifySettingsChanged();
}

function selectedDetectionIdentityChanged(result) {
  guiState.currentDetectionIdentity = result.target.value;
  updateGuiDetectionIdentityChanged(guiState.currentDetectionIdentity);
  notifySettingsChanged();
}

function detectableChanged(result) {
  var perIdentitySettings = getPerIdentitySettingsOrDefault(
    guiState.currentDetectionIdentity
  );
  perIdentitySettings.detectable = result.target.checked;
  notifySettingsChanged();
}

function detectionAliasesChanged(result) {
  var perIdentitySettings = getPerIdentitySettingsOrDefault(
    guiState.currentDetectionIdentity
  );
  perIdentitySettings.detectionAliases = result.target.value;

  notifySettingsChanged();
}

function selectedSafetyIdentityChanged(result) {
  guiState.currentSafetyIdentity = result.target.value;
  updateGuiSafetyIdentityChanged(guiState.currentSafetyIdentity);
  notifySettingsChanged();
}

function warningAliasesChanged(result) {
  var perIdentitySettings = getPerIdentitySettingsOrDefault(
    guiState.currentSafetyIdentity
  );
  perIdentitySettings.warningAliases = result.target.value;

  notifySettingsChanged();
}

function installConfigPageEventListners() {
  document
    .getElementById("accountSelector")
    .addEventListener("change", accountSelectorChanged);

  // for identityMechanism
  document
    .getElementById("defaultIdentity")
    .addEventListener("change", identityMechanismChanged);
  document
    .getElementById("explicitIdentity")
    .addEventListener("change", identityMechanismChanged);

  document
    .getElementById("explicitSelector")
    .addEventListener("change", explicitIdentityChanged);
  document
    .getElementById("replyFromRecipient")
    .addEventListener("change", replyFromRecipientChanged);

  // additional header fields selection
  document
    .getElementById("additionalHeaderFields")
    .addEventListener("change", additionalHeaderFieldsChanged);

  // "Selection"
  document
    .getElementById("selectedDetectionIdentity")
    .addEventListener("change", selectedDetectionIdentityChanged);
  document
    .getElementById("detectable")
    .addEventListener("change", detectableChanged);
  document
    .getElementById("detectionAliases")
    .addEventListener("change", detectionAliasesChanged);

  //"Safety"
  document
    .getElementById("selectedSafetyIdentity")
    .addEventListener("change", selectedSafetyIdentityChanged);
  document
    .getElementById("warningAliases")
    .addEventListener("change", warningAliasesChanged);
}

function getSettings() {
  function handleResponse(message) {
    if (message.msgType == "GET_SETTINGS_REP") {
      settings = message.settings;
      accountsAndIdentities = message.accountsAndIdentities;
      guiState = message.guiState;

      // fill settings into GUI
      var accountSelector = document.getElementById("accountSelector");
      while (accountSelector.firstChild) {
        accountSelector.removeChild(accountSelector.firstChild);
      }
      for (let i in accountsAndIdentities.accounts) {
        let opt = document.createElement("option");
        opt.value = i;
        opt.textContent = accountsAndIdentities.accounts[i].prettyName;
        accountSelector.appendChild(opt);
      }
      // Pick the most recently selected account
      document.getElementById("accountSelector").selectedIndex =
        accountsAndIdentities.accounts[guiState.currentAccountId].index;

      updateGuiAccountChanged(guiState.currentAccountId);

      fillSelectorList("selectedDetectionIdentity", guiState.currentDetectionIdentity);
      fillSelectorList("selectedSafetyIdentity", guiState.currentSafetyIdentity);

      updateGuiDetectionIdentityChanged(guiState.currentDetectionIdentity);
      updateGuiSafetyIdentityChanged(guiState.currentSafetyIdentity);
      updateAdditionalHeaderFields();

      installConfigPageEventListners();
    }
  }

  // circumvent bug in Thunderbird: replace sendMessage() with direct call into backgroundScript()
  // var sending = browser.runtime.sendMessage({ msgType: "GET_SETTINGS_REQ" });
  // sending.then(handleResponse, (err) => {console.log("err:", err)});
  browser.extension.getBackgroundPage().handleMessage({ msgType: "REGISTER_ON_SETTINGS_CHANGED_HANDLER" }, browser.extension, handleResponse)
}

function onLoad(event) {
  i18n.updateDocument();  // from i18n.js
  getSettings();
}

document.addEventListener("DOMContentLoaded", onLoad);
