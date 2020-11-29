var settings;
var accountsAndIdentities;
var guiState;

function notifySettingsChanged() {
  // send update to background script
  browser.runtime.sendMessage({
    msgType: "SET_SETTINGS_REQ",
    settings: settings,
    guiState: guiState,
  });
}

function getPerAccountSettingsOrDefault(accountId) {
  perAccountSettings = settings.accountSettings[accountId];
  if (perAccountSettings === undefined) {
    // not found in settings, set defaults
    perAccountSettings = {
      identityMechanism: 0,
      explicitIdentity:
        accountsAndIdentities.accounts[accountId].defaultIdentityId,
      replyFromRecipient: true,
    };
    settings.accountSettings[accountId] = perAccountSettings;
  }
  return perAccountSettings;
}

function getPerIdentitySettingsOrDefault(identityId) {
  perIdentitySettings = settings.identitySettings[identityId];
  if (perIdentitySettings === undefined) {
    // not found in settings, set defaults
    perIdentitySettings = {
      detectable: true,
      detectionAliases: "",
      warningAliases: "",
    };
    settings.identitySettings[identityId] = perIdentitySettings;
  }
  return perIdentitySettings;
}

function fillExplicitSelector(explicitIdentityId) {
  // fill explicitId list for that account
  explicitSelector = document.getElementById("explicitSelector");

  // remove all items
  while (explicitSelector.options.length) {
    explicitSelector.remove(0);
  }

  let index = 0;
  let selectedIndex = 0;
  for (var i in accountsAndIdentities.identities) {
    var opt = document.createElement("option");
    opt.value = i;
    opt.innerHTML = accountsAndIdentities.identities[i].email;
    explicitSelector.appendChild(opt);
    if (i == explicitIdentityId) {
      selectedIndex = index;
    }
    index++;
  }
  document.getElementById("explicitSelector").selectedIndex = selectedIndex;
}

function updateGuiAccountChanged(accountId) {
  perAccountSettings = getPerAccountSettingsOrDefault(accountId);
  // perIdentitySettings = getPerIdentitySettingsOrDefault(perAccountSettings.defaultIdentityId);

  fillExplicitSelector(perAccountSettings.explicitIdentity);

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
  perIdentitySettings = getPerIdentitySettingsOrDefault(newDetectionIdentityId);

  document.getElementById("detectable").checked =
    perIdentitySettings.detectable;
  document.getElementById("detectionAliases").value =
    perIdentitySettings.detectionAliases;
}

function updateGuiSafetyIdentityChanged(newSafetyIdentityId) {
  // update Safety GUI
  perIdentitySettings = getPerIdentitySettingsOrDefault(newSafetyIdentityId);

  document.getElementById("warningAliases").value =
    perIdentitySettings.warningAliases;
}

function accountSelectorChanged(result) {
  sKey = result.target.value;

  perAccountSettings = getPerAccountSettingsOrDefault(
    guiState.currentAccountId
  );
  // Remember preferences of currently showed account
  perAccountSettings.identityMechanism = document.getElementById("defaultIdentity").checked ? 0 : 1;
  if (document.getElementById("explicitSelector").selectedItem) {
    perAccountSettings.explicitIdentity = document.getElementById(
      "explicitSelector"
    ).selectedItem.value;
  }
  perAccountSettings.replyFromRecipient = document.getElementById(
    "replyFromRecipient"
  ).checked;

  guiState.currentAccountId = sKey;

  notifySettingsChanged();

  perAccountSettings = getPerAccountSettingsOrDefault(sKey);
  perIdentitySettings = getPerIdentitySettingsOrDefault(
    perAccountSettings.defaultIdentityId
  );

  updateGuiAccountChanged(sKey);
}

function explicitIdentityChanged(result) {
  perAccountSettings = getPerAccountSettingsOrDefault(
    guiState.currentAccountId
  );
  perAccountSettings.explicitIdentity = result.target.value;
  notifySettingsChanged();
}

function identityMechanismChanged(result) {
  perAccountSettings = getPerAccountSettingsOrDefault(
    guiState.currentAccountId
  );
  perAccountSettings.identityMechanism = parseInt(result.target.value, 10);

  // Update the form
  explicitSelector = document.getElementById("explicitSelector");
  explicitSelector.disabled = result.target.value != 1;
  if (explicitSelector.disabled) {
    // If not selected, restore the explicit identity to default identity for the account
    perAccountSettings.explicitIdentity =
      accountsAndIdentities.accounts[guiState.currentAccountId].defaultIdentity;
    explicitSelector.selectedIndex = perAccountSettings.index;
  }

  notifySettingsChanged();
}

function replyFromRecipientChanged(result) {
  perAccountSettings = getPerAccountSettingsOrDefault(
    guiState.currentAccountId
  );
  perAccountSettings.replyFromRecipient = result.target.checked;
  notifySettingsChanged();
}

function selectedDetectionIdentityChanged(result) {
  guiState.currentDetectionIdentity = result.target.value;
  updateGuiDetectionIdentityChanged(guiState.currentDetectionIdentity);
  notifySettingsChanged();
}

function detectableChanged(result) {
  perIdentitySettings = getPerIdentitySettingsOrDefault(
    guiState.currentDetectionIdentity
  );
  perIdentitySettings.detectable = result.target.checked;
  notifySettingsChanged();
}

function detectionAliasesChanged(result) {
  perIdentitySettings = getPerIdentitySettingsOrDefault(
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
  perIdentitySettings = getPerIdentitySettingsOrDefault(
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
      accountSelector = document.getElementById("accountSelector");
      for (let i in accountsAndIdentities.accounts) {
        let opt = document.createElement("option");
        opt.value = i;
        opt.innerHTML = accountsAndIdentities.accounts[i].prettyName;
        accountSelector.appendChild(opt);
      }
      // Pick the most recently selected account
      document.getElementById("accountSelector").selectedIndex =
        accountsAndIdentities.accounts[guiState.currentAccountId].index;

      updateGuiAccountChanged(guiState.currentAccountId);

      // fill "Detection" and "Safety" section
      selectedDetectionIdentity = document.getElementById(
        "selectedDetectionIdentity"
      );
      selectedSafetyIdentity = document.getElementById(
        "selectedSafetyIdentity"
      );
      var detectionIndex = 0;
      var safetyIndex = 0;
      var index = 0;
      for (let i in accountsAndIdentities.identities) {
        let opt = document.createElement("option");
        opt.value = i;
        opt.innerHTML = accountsAndIdentities.identities[i].email;
        selectedDetectionIdentity.appendChild(opt.cloneNode(true)); // we need a copy not a reference
        selectedSafetyIdentity.appendChild(opt);
        if (guiState.currentDetectionIdentity == i) {
          detectionIndex = index;
        }
        if (guiState.currentSafetyIdentity == i) {
          safetyIndex = index;
        }
        index++;
      }

      selectedDetectionIdentity.selectedIndex = detectionIndex;
      selectedSafetyIdentity.selectedIndex = safetyIndex;
      updateGuiDetectionIdentityChanged(guiState.currentDetectionIdentity);
      updateGuiSafetyIdentityChanged(guiState.currentSafetyIdentity);

      installConfigPageEventListners();
    }
  }

  const sending = browser.runtime.sendMessage({ msgType: "GET_SETTINGS_REQ" });
  sending.then(handleResponse);
}

function onLoad(event) {
  i18n.updateDocument();  // from i18n.js
  getSettings();
}

document.addEventListener("DOMContentLoaded", onLoad);
