var CorrectIdentity = {

  /*** GENERAL ***/

  preferences: Components.classes["@mozilla.org/preferences-service;1"]
                 .getService(Components.interfaces.nsIPrefService).getBranch("CorrectIdentity."),

  accountManager: Components.classes["@mozilla.org/messenger/account-manager;1"]
                    .getService(Components.interfaces.nsIMsgAccountManager),

  getIdentityById: function(identities, idx)
  {
    return identities.queryElementAt
           ? identities.queryElementAt(idx, Components.interfaces.nsIMsgIdentity)
           : identities.GetElementAt(idx).QueryInterface(Components.interfaces.nsIMsgIdentity);
  },

  getIdentityCount: function(identities)
  {
    return (typeof identities.Count === 'undefined')
           ? identities.length
           : identities.Count();
  },

  getAccountPreferences: function(oServer)
  {
    let oPreferences = this.preferences;

    // Determine defaults for this account
    let oIdentities = this.accountManager.getIdentitiesForServer
      ? this.accountManager.getIdentitiesForServer(oServer)
      : this.accountManager.GetIdentitiesForServer(oServer);

    let oDefaultIdentity = this.accountManager.defaultAccount.defaultIdentity;
    let oDefaultId = this.getIdentityCount(oIdentities)
                     ? this.getIdentityById(oIdentities, 0)
                     : (oDefaultIdentity ? oDefaultIdentity : null);

    let oAccountPreferences = {
      identityMechanism: oPreferences.getIntPref("identityMechanism"),
      defaultIdentity: oDefaultId ? oDefaultId.key : "",
      replyFromRecipient: oPreferences.getBoolPref("replyFromRecipient")
    };
    oAccountPreferences.explicitIdentity = oAccountPreferences.defaultIdentity ;

    // Override with valid persisted preferences from user preferences system
    let sKey = "settings_" + oServer.key;
    let aPreferences = (oPreferences.getPrefType(sKey) == oPreferences.PREF_STRING)
                       ? oPreferences.getCharPref(sKey).split(/\x01/) : [];
    if ((aPreferences.length == 4) && (aPreferences[0] == oServer.type))
    {
      oAccountPreferences.identityMechanism = parseInt(aPreferences[1], 10);
      let oIdentity = this.accountManager.getIdentity(aPreferences[2]);
      if (oAccountPreferences.identityMechanism == 1)
        if (oIdentity && (oIdentity.email != null))
          oAccountPreferences.explicitIdentity = oIdentity.key;
        else
          // Revert to default mechanism if the explicit identity was removed
          oAccountPreferences.identityMechanism = 0;
      oAccountPreferences.replyFromRecipient = (aPreferences[3] == "true");
    }

    // Check and return
    if (!(oAccountPreferences.replyable = (("rss,nntp").indexOf(oServer.type) == -1)))
      oAccountPreferences.replyFromRecipient = false;
    return oAccountPreferences;
  },

  getIdentityPreferences: function(oIdentity)
  {
    let oPreferences = this.preferences;

    // Determine defaults for this identity
    let oIdentityPreferences = {
      detectable: true,
      aliases: ""
    };

    // Override with valid persisted preferences from user preferences system
    let sKey = "settings_" + oIdentity.key;
    let aPreferences = (oPreferences.getPrefType(sKey) == oPreferences.PREF_STRING)
                       ? oPreferences.getCharPref(sKey).split(/\x01/, 2) : [];

    if (aPreferences.length == 2)
    {
      oIdentityPreferences.detectable = (aPreferences[0] == "true");
      oIdentityPreferences.aliases = aPreferences[1];
    }

    // Return
    return oIdentityPreferences;
  },


  /*** OPTIONS HANDLING ***/

  disableInterface: function(oElm)
  {
    let aTags = ["menulist", "radiogroup", "checkbox"];
    for (let iTag = aTags.length; iTag--;)
      for (let oElms = oElm.getElementsByTagName(aTags[iTag]), iElm = oElms.length; iElm--;)
        oElms.item(iElm).disabled = true;
  },

  initOptions: function()
  {
    let oSettings = this.settings = {
      currentAccount: "",
      accounts: {},
      currentIdentity: "",
      identities: {}
    };

    // Select the most recently selected tab
    let oTabsElm = window.document.getElementById('tabs');
    window.document.getElementById('tabs').selectedIndex = this.preferences.getIntPref("selectedTab");
    oTabsElm.onselect = function() { window.CorrectIdentity.preferences.setIntPref('selectedTab', this.selectedIndex); };

    // Populate accounts
    let oAccountListElm = window.document.getElementById("accountSelector");
    oAccountListElm.removeAllItems();
    let accounts = this.accountManager.accounts;
    let iNrAccounts = (typeof accounts.Count === 'undefined') ? accounts.length : accounts.Count();
    let iIndex = 0;
    for (let iCnt = 0; iCnt < iNrAccounts; iCnt++)
    {
      let oAccount = accounts.queryElementAt ?
        accounts.queryElementAt(iCnt, Components.interfaces.nsIMsgAccount) :
        accounts.GetElementAt(iCnt).QueryInterface(Components.interfaces.nsIMsgAccount);
      let oServer = oAccount.incomingServer;
      if (oServer && (!(oServer.key in oSettings.accounts)))
      {
        let oAccountPreferences = oSettings.accounts[oServer.key] = this.getAccountPreferences(oServer);
        oAccountPreferences.index = iIndex++;
        oAccountPreferences.type = oServer.type;
        oAccountPreferences.prettyName = oServer.prettyName;
        oAccountListElm.appendItem(oServer.prettyName).value = oServer.key; // Assign value to resolve bug that TB thinks it doesn't have one on first use
      }
    }

    // Pick the most recently selected account
    let sSelectedAccount = this.preferences.getCharPref("selectedAccount");
    oAccountListElm.selectedIndex = (sSelectedAccount in oSettings.accounts) ? oSettings.accounts[sSelectedAccount].index : 0;
    if (iIndex)
      setTimeout(function() { window.CorrectIdentity.pickAccount(window.document.getElementById('accountSelector').selectedItem.value); }, 0);
    else
      this.disableInterface(window.document.getElementById("accountsTab"));

    // Populate identities
    let oIdentityListElm = window.document.getElementById("identitySelector");
    let oExplicitListElm = window.document.getElementById("explicitSelector");
    oIdentityListElm.removeAllItems();
    oExplicitListElm.removeAllItems();
    let oIdentities = this.accountManager.allIdentities;
    let iNrIdentities = this.getIdentityCount(oIdentities);
    let iIndex = 0;
    for (let iCnt = 0; iCnt < iNrIdentities; iCnt++)
    {
      let oIdentity = this.getIdentityById(oIdentities, iCnt);
      if (oIdentity.valid)
      {
        let oIdentityPreferences = oSettings.identities[oIdentity.key] = this.getIdentityPreferences(oIdentity);
        oIdentityPreferences.index = iIndex++;
        oIdentityListElm.appendItem(oIdentity.identityName).value = oIdentity.key; // Assign value to resolve bug that TB thinks it doesn't have one on first use
        oExplicitListElm.appendItem(oIdentity.identityName).value = oIdentity.key; // Assign value to resolve bug that TB thinks it doesn't have one on first use
      }
    }

    // Pick the most recently selected identity
    let sSelectedIdentity = this.preferences.getCharPref("selectedIdentity");
    oIdentityListElm.selectedIndex = (sSelectedIdentity in oSettings.identities) ? oSettings.identities[sSelectedIdentity].index : 0;
    if (iIndex)
      setTimeout(function() {
                   window.CorrectIdentity.pickIdentity(window.document.getElementById('identitySelector').selectedItem.value);
                 }, 0);
    else
    {
      window.document.getElementById("explicitIdentity").disabled = true;
      this.disableInterface(window.document.getElementById("detectionTab"));
    }
  },

  applyOptions: function()
  {
    // Persist preferences of all accounts to the user preferences system
    if (window.document.getElementById('accountSelector').selectedItem)
      this.pickAccount(window.document.getElementById('accountSelector').selectedItem.value);
    let oAccounts = this.settings.accounts;
    for (let sKey in oAccounts)
    {
      let oAccount = oAccounts[sKey];
      this.preferences.setCharPref(
        "settings_" + sKey,
        ([oAccount.type, oAccount.identityMechanism, oAccount.explicitIdentity, oAccount.replyFromRecipient ? "true" : "false"]).join("\x01")
      );
    }

    // Persist preferences of all identities to the user preferences system
    if (window.document.getElementById('identitySelector').selectedItem)
      this.pickIdentity(window.document.getElementById('identitySelector').selectedItem.value);
    let oIdentities = this.settings.identities;
    for (let sKey in oIdentities)
    {
      let oIdentity = oIdentities[sKey];
      this.preferences.setCharPref(
        "settings_" + sKey,
        ([oIdentity.detectable ? "true" : "false", oIdentity.aliases]).join("\x01")
      );
    }
  },

  pickAccount: function(sKey)
  {
    let oSettings = this.settings, oAccount, oIdentity;
    if (oAccount = oSettings.accounts[oSettings.currentAccount])
    {
      // Remember preferences of currently showed account
      oAccount.identityMechanism = window.document.getElementById("identityMechanism").selectedIndex;
      if (window.document.getElementById("explicitSelector").selectedItem)
        oAccount.explicitIdentity = window.document.getElementById("explicitSelector").selectedItem.value;
      oAccount.replyFromRecipient = window.document.getElementById("replyFromRecipient").checked;
    }

    // Fetch the remembered preferences for the picked account and update the form
    this.preferences.setCharPref("selectedAccount", oSettings.currentAccount = sKey);
    oAccount = oSettings.accounts[sKey];
    oIdentity = oSettings.identities[oAccount.explicitIdentity];
    window.document.getElementById("identityMechanism").selectedIndex = oAccount.identityMechanism;
    window.document.getElementById("explicitSelector").selectedIndex = oIdentity ? oIdentity.index : 0;
    window.document.getElementById('explicitSelector').disabled = (oAccount.identityMechanism != 1);
    window.document.getElementById("replyFromRecipient").checked = oAccount.replyFromRecipient;
    window.document.getElementById('replyFromRecipient').disabled = (!oAccount.replyable);
  },

  updateMechanism: function()
  {
    // Update the form
    let oAccountElm = window.document.getElementById('accountSelector').selectedItem;
    let oMechanismRadioGroup = window.document.getElementById("identityMechanism");
    let oExplicitSelector = window.document.getElementById("explicitSelector");
    if ((oExplicitSelector.disabled = (oMechanismRadioGroup.selectedIndex != 1)) && oAccountElm)
    {
      // If not selected, restore the explicit identity to default identity for the account
      let oIdentity = this.settings.accounts[oAccountElm.value].defaultIdentity;
      oExplicitSelector.selectedIndex = oIdentity ? this.settings.identities[oIdentity].index : 0;
    }
  },

  pickIdentity: function(sKey)
  {
    let oSettings = this.settings;
    let oIdentity;
    if (oIdentity = oSettings.identities[oSettings.currentIdentity])
    {
      // Remember preferences of currently showed identity
      oIdentity.detectable = window.document.getElementById("detectable").checked;
      oIdentity.aliases = window.document.getElementById("aliases").value.replace(/^\n+|\n+$/g, "").replace(/\n{2,}/, "\n");
    }

    // Fetch the remembered aliases for the picked identity and update the form
    this.preferences.setCharPref("selectedIdentity", oSettings.currentIdentity = sKey);
    window.document.getElementById("detectable").checked = oSettings.identities[sKey].detectable;
    window.document.getElementById("aliases").value = oSettings.identities[sKey].aliases;
    window.document.getElementById("aliases").disabled = (!oSettings.identities[sKey].detectable);
  },


  /*** COMPOSE HANDLING ***/

  init: function()
  {
    // Be hopefully the last to apply function overlays
    setTimeout(window.CorrectIdentity.delayedInit, 1);
  },

  delayedInit: function()
  {
    if (window.getIdentityForServer && (window.CorrectIdentity.origgetIdentityForServer == null))
    {
      // Overlay function getIdentityForServer of chrome://messenger/content/mailCommands.js (mail/base/content/mailCommands.js)
      window.CorrectIdentity.origgetIdentityForServer = window.getIdentityForServer;
      window.getIdentityForServer = window.CorrectIdentity.getIdentityForServer;

      let appInfo = Components.classes['@mozilla.org/xre/app-info;1'].getService(Components.interfaces.nsIXULAppInfo);
      window.CorrectIdentity.lastHintIsDeliveredTo = (appInfo.name == 'Thunderbird') && (parseInt(appInfo.version, 10) >= 13);
    }
    if (window.setupAutocomplete && (window.CorrectIdentity.origsetupAutocomplete == null)) {
      // Overlay function setupAutocomplete of chrome://messenger/content/messengercompose/MsgComposeCommands.js
      window.CorrectIdentity.origsetupAutocomplete = window.setupAutocomplete;
      window.setupAutocomplete = window.CorrectIdentity.setupAutocomplete;
    }
    if (window.awAddRecipient && (window.CorrectIdentity.origawAddRecipient == null)) {
      // Overlay function setupAutocomplete of chrome://messenger/content/messengercompose/addressingWidgetOverlay.js
      window.CorrectIdentity.origawAddRecipient = window.awAddRecipient;
      window.awAddRecipient = window.CorrectIdentity.awAddRecipient;
    }
    if (window.LoadIdentity && (window.CorrectIdentity.origLoadIdentity == null)) {
      // Overlay function LoadIdentity of chrome://messenger/content/messengercompose/MsgComposeCommands.js
      window.CorrectIdentity.origLoadIdentity = window.LoadIdentity;
      window.LoadIdentity = window.CorrectIdentity.LoadIdentity;
    }
  },

  lastHintIsDeliveredTo: false,
  origgetIdentityForServer: null,
  // WARNING: This will override a global function, so don't use "this" because it will refer to window instead of the CorrectIdentity object!
  getIdentityForServer: function(server, optionalHint, manualAddressing)
  {
    let oAccountPreferences = window.CorrectIdentity.getAccountPreferences(server);
    let oIdentity = null;

    // We overlay with the same code different things and as names are different we make a simple trick to make them the same
    if (!window.accountManager) window.accountManager = this.accountManager;

    // First, select an identity using the prefered identity mechanism
    switch(oAccountPreferences.identityMechanism)
    {
      case 1: oIdentity = window.accountManager.getIdentity(oAccountPreferences.explicitIdentity);  break;
      // Room for more options in the future
    }
    if (window.CorrectIdentity.origgetIdentityForServer && ((oIdentity == null) || (oIdentity.email == null)))
      oIdentity = window.CorrectIdentity.origgetIdentityForServer(server); // Fallback to TB default mechanism without the hint, if this function is called when constructing a new message

    // Second, if prefered to reply from a receiving identity and we have a hint that does not contain
    // the currently selected identity's email address, then enumerate the email addresses ans aliases
    // of all identities available from last till first and return the last one that exists in the hint
    if (optionalHint && oAccountPreferences.replyFromRecipient)
    {
      // Remove Delivered-To address always hinted last since TB 13, with thanks to azurewelkin for detecting this!
      if (window.CorrectIdentity.lastHintIsDeliveredTo)
        optionalHint = optionalHint.replace(/,[^,]*$/, '');

      // Uncomment to view what hinted addresses are evaluated:
      //Components.classes["@mozilla.org/consoleservice;1"]
      //  .getService(Components.interfaces.nsIConsoleService)
      //  .logStringMessage("CorrectIndentity evaluated hints:\n" + optionalHint);

      optionalHint = optionalHint.toLowerCase();
      if (!(oIdentity && (oIdentity.email.indexOf("@") != -1) && (optionalHint.indexOf(oIdentity.email.toLowerCase()) >= 0)))
      {
        let oMatchingId = null;
        let oAliasedId = null;
        let allIdentities = window.accountManager.allIdentities;
        for (let iCnt = CorrectIdentity.getIdentityCount(allIdentities) - 1; iCnt >= 0; iCnt--)
        {
          let oThisIdentity = CorrectIdentity.getIdentityById(allIdentities, iCnt);
          let oIdentityPreferences = window.CorrectIdentity.getIdentityPreferences(oThisIdentity);

          // Process identity unless preferred never to detect it
          if (oThisIdentity.email && oIdentityPreferences.detectable)
          {
            // Scan identity email address when scanning hint from message to reply on
            let sEmail = oThisIdentity.email.toLowerCase();
            if ((!manualAddressing) && (sEmail.indexOf("@") != -1) && (optionalHint.indexOf(sEmail) >= 0))
              oMatchingId = oThisIdentity;

            // Scan identity aliases
            if (!oMatchingId)
            {
              let aAliases = oIdentityPreferences.aliases.split(/\n+/);
              for (let iNr = aAliases.length; iNr >= 0; iNr--)
              {
                let sAlias = aAliases[iNr];
                if (sAlias != "")
                  if (/^\/(.*)\/$/.exec(sAlias))
                  {
                    try {
                      if (optionalHint.match(new RegExp(RegExp.$1, "i")))
                        oAliasedId = oThisIdentity;
                    }
                    catch(vErr) {
                      alert("Ignoring invalid regular expression:\n\n" +
                            "identity:  " + oThisIdentity.identityName + "\n" +
                            "regexp:  " + sAlias.replace(/\\/g, "\\\\") + "\n\n" +
                            "Please adjust in the Correct Identity Detection settings!");
                    }
                  }
                  else if (optionalHint.indexOf(sAlias) >= 0)
                    oAliasedId = oThisIdentity;
              }
            }
          }
        }
        oIdentity = oMatchingId ? oMatchingId : (oAliasedId ? oAliasedId : oIdentity); // Select the best match
      }
    }

    return oIdentity;
  },

  explicitIdentityChosen: null,  // Explicit identity chosen?: null==no and unitialized, false==no, true==yes
  initialIdentity: null,
  redoIdentity: function() {
    if ((this.explicitIdentityChosen !== true) && (gMsgCompose != null))
    {
      var msgCompFields = gMsgCompose.compFields;
      if (msgCompFields)
      {
        Recipients2CompFields(msgCompFields);

        let currentIdentityKey = document.getElementById("msgIdentity").value;

        if (this.explicitIdentityChosen === null)
        {
          // Remember initial identity to revert to when no suggestion is returned
          this.explicitIdentityChosen = false;
          this.initialIdentity = this.accountManager.getIdentity(currentIdentityKey);
          //Components.classes["@mozilla.org/consoleservice;1"]
          //  .getService(Components.interfaces.nsIConsoleService)
          //  .logStringMessage('window: ' + window + ', def: ' + this.initialIdentity);
        }

        let identity = this.getIdentityForServer(
          this.accountManager.getServersForIdentity(this.initialIdentity).queryElementAt(0, Components.interfaces.nsIMsgIncomingServer),
          msgCompFields.to + ',' + msgCompFields.cc + ',' + msgCompFields.bcc,
          true
        );
        //Components.classes["@mozilla.org/consoleservice;1"]
        //  .getService(Components.interfaces.nsIConsoleService)
        //  .logStringMessage('window: ' + window + ', def: ' + this.initialIdentity + ', suggested: ' + identity);
        if (!identity)
          identity = this.initialIdentity;
        if (identity.key != currentIdentityKey)
        {
          document.getElementById("msgIdentity").value = identity.key;
          this.origLoadIdentity(false);
        }
      }
    }
  },

  origsetupAutocomplete: null,
  setupAutocomplete: function() {
    window.CorrectIdentity.origsetupAutocomplete();
    window.CorrectIdentity.redoIdentity();
  },

  origawAddRecipient: null,
  awAddRecipient: function(recipientType, address) {
    window.CorrectIdentity.origawAddRecipient(recipientType, address);
    window.CorrectIdentity.redoIdentity();
  },

  origLoadIdentity: null,
  LoadIdentity: function(startup) {
    window.CorrectIdentity.explicitIdentityChosen = startup ? null : true;
    window.CorrectIdentity.origLoadIdentity(startup);
  }

};

window.addEventListener('load', CorrectIdentity.init, false);
