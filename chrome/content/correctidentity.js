// Correct Identity v1.3.4
// Copyright (c) 2005-2010 Dennis Verspuij

var CorrectIdentity = {

  /*** GENERAL ***/

  preferences: Components.classes["@mozilla.org/preferences-service;1"]
                 .getService(Components.interfaces.nsIPrefService).getBranch("CorrectIdentity."),

  accountManager: Components.classes["@mozilla.org/messenger/account-manager;1"]
                    .getService(Components.interfaces.nsIMsgAccountManager),

  getAccountPreferences: function(oServer)
  {
    var oPreferences = this.preferences;

    // Determine defaults for this account
    var oIdentities = this.accountManager.GetIdentitiesForServer(oServer);
    var oDefaultIdentity = this.accountManager.defaultAccount.defaultIdentity;
    var oAccountPreferences = {
      identityMechanism: oPreferences.getIntPref("identityMechanism"),
      defaultIdentity: oIdentities.Count() ? oIdentities.QueryElementAt(0,Components.interfaces.nsIMsgIdentity).key
                                           : (oDefaultIdentity ? oDefaultIdentity.key : ""),
      replyFromRecipient: oPreferences.getBoolPref("replyFromRecipient")
    };
    oAccountPreferences.explicitIdentity = oAccountPreferences.defaultIdentity ;

    // Override with valid persisted preferences from user preferences system
    var sKey = "settings_"+oServer.key;
    var aPreferences = (oPreferences.getPrefType(sKey) == oPreferences.PREF_STRING)
                       ? oPreferences.getCharPref(sKey).split(/\001/) : [];
    if ((aPreferences.length == 4) && (aPreferences[0] == oServer.type))
    {
      oAccountPreferences.identityMechanism = parseInt(aPreferences[1],10);
      var oIdentity = this.accountManager.getIdentity(aPreferences[2]);
      if (oAccountPreferences.identityMechanism == 1)
        if (oIdentity && (oIdentity.email != null))
          oAccountPreferences.explicitIdentity = oIdentity.key;
        else
          // Revert to default mechanism if the explicit identity was removed
          oAccountPreferences.identityMechanism = 0;
      oAccountPreferences.replyFromRecipient = (aPreferences[3]=="true");
    }

    // Check and return
    if (!(oAccountPreferences.replyable = (("rss,nntp").indexOf(oServer.type) == -1)))
      oAccountPreferences.replyFromRecipient = false;
    return oAccountPreferences;
  },

  getIdentityPreferences: function(oIdentity)
  {
    var oPreferences = this.preferences;

    // Determine defaults for this identity
    var oIdentityPreferences = {
      detectable: true,
      aliases: ""
    };

    // Override with valid persisted preferences from user preferences system
    var sKey = "settings_"+oIdentity.key;
    var aPreferences = (oPreferences.getPrefType(sKey) == oPreferences.PREF_STRING)
                       ? oPreferences.getCharPref(sKey).split(/\001/,2) : [];
    if (aPreferences.length == 2)
    {
      oIdentityPreferences.detectable = (aPreferences[0]=="true");
      oIdentityPreferences.aliases = aPreferences[1];
    }

    // Return
    return oIdentityPreferences;
  },


  /*** OPTIONS HANDLING ***/

  disableInterface: function(oElm)
  {
    var aTags = ["menulist","radiogroup","checkbox"];
    for(var iTag=aTags.length; iTag--;)
      for(var oElms=oElm.getElementsByTagName(aTags[iTag]), iElm=oElms.length; iElm--;)
        oElms.item(iElm).disabled = true;
  },

  initOptions: function()
  {
    var oSettings = this.settings = {
      currentAccount: "",
      accounts: {},
      currentIdentity: "",
      identities: {}
    };

    // Select the most recently selected tab
    var oTabsElm = window.document.getElementById('tabs');
    window.document.getElementById('tabs').selectedIndex = this.preferences.getIntPref("selectedTab");
    oTabsElm.onselect = function() { window.CorrectIdentity.preferences.setIntPref('selectedTab',this.selectedIndex); };

    // Populate accounts
    var oAccountListElm = window.document.getElementById("accountSelector");
    oAccountListElm.removeAllItems();
    for(var oAccounts=this.accountManager.accounts, iNrAccounts=oAccounts.Count(), iCnt=0, iIndex=0; iCnt < iNrAccounts; iCnt++)
    {
      var oAccount = oAccounts.QueryElementAt(iCnt,Components.interfaces.nsIMsgAccount), oServer = oAccount.incomingServer;
      if (oServer && (!(oServer.key in oSettings.accounts)))
      {
        var oAccountPreferences = oSettings.accounts[oServer.key] = this.getAccountPreferences(oServer);
        oAccountPreferences.index = iIndex++;
        oAccountPreferences.type = oServer.type;
        oAccountPreferences.prettyName = oServer.prettyName;
        oAccountListElm.appendItem(oServer.prettyName).value = oServer.key; // Assign value to resolve bug that TB thinks it doesn't have one on first use
      }
    }

    // Pick the most recently selected account
    var sSelectedAccount = this.preferences.getCharPref("selectedAccount");
    oAccountListElm.selectedIndex = (sSelectedAccount in oSettings.accounts) ? oSettings.accounts[sSelectedAccount].index : 0;
    if (iIndex)
      setTimeout("window.CorrectIdentity.pickAccount(window.document.getElementById('accountSelector').selectedItem.value)", 0);
    else
      this.disableInterface(window.document.getElementById("accountsTab"));

    // Populate identities
    var oIdentityListElm = window.document.getElementById("identitySelector");
    var oExplicitListElm = window.document.getElementById("explicitSelector");
    oIdentityListElm.removeAllItems();
    oExplicitListElm.removeAllItems();
    for(var oIdentities=this.accountManager.allIdentities, iNrIdentities=oIdentities.Count(), iCnt=0, oIdentity, iIndex=0; iCnt < iNrIdentities; iCnt++)
      if ((oIdentity = oIdentities.QueryElementAt(iCnt,Components.interfaces.nsIMsgIdentity)).valid)
      {
        var oIdentityPreferences = oSettings.identities[oIdentity.key] = this.getIdentityPreferences(oIdentity);
        oIdentityPreferences.index = iIndex++;
        oIdentityListElm.appendItem(oIdentity.identityName).value = oIdentity.key; // Assign value to resolve bug that TB thinks it doesn't have one on first use
        oExplicitListElm.appendItem(oIdentity.identityName).value = oIdentity.key; // Assign value to resolve bug that TB thinks it doesn't have one on first use
      }

    // Pick the most recently selected identity
    var sSelectedIdentity = this.preferences.getCharPref("selectedIdentity");
    oIdentityListElm.selectedIndex = (sSelectedIdentity in oSettings.identities) ? oSettings.identities[sSelectedIdentity].index : 0;
    if (iIndex)
      setTimeout("window.CorrectIdentity.pickIdentity(window.document.getElementById('identitySelector').selectedItem.value)", 0);
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
    var oAccounts = this.settings.accounts;
    for(var sKey in oAccounts)
    {
      var oAccount = oAccounts[sKey];
      this.preferences.setCharPref("settings_"+sKey,
        ([oAccount.type, oAccount.identityMechanism, oAccount.explicitIdentity, oAccount.replyFromRecipient ? "true" : "false"]).join("\001"));
    }

    // Persist preferences of all identities to the user preferences system
    if (window.document.getElementById('identitySelector').selectedItem)
      this.pickIdentity(window.document.getElementById('identitySelector').selectedItem.value);
    var oIdentities = this.settings.identities;
    for(var sKey in oIdentities)
    {
      var oIdentity = oIdentities[sKey];
      this.preferences.setCharPref("settings_"+sKey,
        ([oIdentity.detectable ? "true" : "false", oIdentity.aliases]).join("\001"));
    }
  },

  pickAccount: function(sKey)
  {
    var oSettings = this.settings, oAccount, oIdentity;
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
    var oAccountElm = window.document.getElementById('accountSelector').selectedItem;
    var oMechanismRadioGroup = window.document.getElementById("identityMechanism");
    var oExplicitSelector = window.document.getElementById("explicitSelector");
    if ((oExplicitSelector.disabled = (oMechanismRadioGroup.selectedIndex != 1)) && oAccountElm)
    {
      // If not selected, restore the explicit identity to default identity for the account
      var oIdentity = this.settings.accounts[oAccountElm.value].defaultIdentity;
      oExplicitSelector.selectedIndex = oIdentity ? this.settings.identities[oIdentity].index : 0;
    }
  },

  pickIdentity: function(sKey)
  {
    var oSettings = this.settings, oIdentity;
    if (oIdentity = oSettings.identities[oSettings.currentIdentity])
    {
      // Remember preferences of currently showed identity
      oIdentity.detectable = window.document.getElementById("detectable").checked;
      oIdentity.aliases = window.document.getElementById("aliases").value.replace(/^\n+|\n+$/g,"").replace(/\n{2,}/,"\n");
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
    setTimeout(window.CorrectIdentity.delayedInit,1);
  },

  delayedInit: function()
  {
    if (window.getIdentityForServer && (window.CorrectIdentity.origgetIdentityForServer == null))
    {
      // Overlay function getIdentityForServer of chrome://messenger/content/mailCommands.js
      window.CorrectIdentity.origgetIdentityForServer = window.getIdentityForServer;
      window.getIdentityForServer = window.CorrectIdentity.getIdentityForServer;
    }
  },

  origgetIdentityForServer: null,
  getIdentityForServer: function(server, optionalHint)
  {
    var oAccountPreferences = window.CorrectIdentity.getAccountPreferences(server);
    var oIdentity = null;

    // First, select an identity using the prefered identity mechanism
    switch(oAccountPreferences.identityMechanism)
    {
      case 1: oIdentity = window.accountManager.getIdentity(oAccountPreferences.explicitIdentity);  break;
      // Room for more options in the future
    }
    if ((oIdentity == null) || (oIdentity.email == null))
      oIdentity = window.CorrectIdentity.origgetIdentityForServer(server); // Fallback to TB default mechanism without the hint

    // Second, if prefered to reply from a receiving identity and we have a hint that does not contain
    // the currently selected identity's email address, then enumerate the email addresses ans aliases
    // of all identities available from last till first and return the last one that exists in the hint
    if (optionalHint && oAccountPreferences.replyFromRecipient)
    {
      optionalHint = optionalHint.toLowerCase();
      if (!(oIdentity && (oIdentity.email.indexOf("@") != -1) && (optionalHint.indexOf(oIdentity.email.toLowerCase()) >= 0)))
      {
        for(var oMatchingId=null, oAliasedId=null, allIdentities=window.accountManager.allIdentities, iCnt=allIdentities.Count(); iCnt--;)
        {
          var oThisIdentity = allIdentities.QueryElementAt(iCnt,Components.interfaces.nsIMsgIdentity);
          var oIdentityPreferences = window.CorrectIdentity.getIdentityPreferences(oThisIdentity);

          // Process identity unless preferred never to detect it
          if (oThisIdentity.email && oIdentityPreferences.detectable)
          {
            // Scan identity email address
            var sEmail = oThisIdentity.email.toLowerCase();
            if ((sEmail.indexOf("@") != -1) && (optionalHint.indexOf(sEmail) >= 0))
              oMatchingId = oThisIdentity;
            
            // Scan identity aliases
            if (!oMatchingId)
              for(var aAliases=oIdentityPreferences.aliases.split(/\n+/), sAlias, iNr=aAliases.length; iNr--;)
                if ((sAlias = aAliases[iNr]) != "")
                  if (/^\/(.*)\/$/.exec(sAlias))
                  {
                    try {
                      if (optionalHint.match(new RegExp(RegExp.$1,"i")))
                        oAliasedId = oThisIdentity;
                    }
                    catch(vErr) {
                      alert("Ignoring invalid regular expression alias:\n\n"+
                            "identity:  "+oThisIdentity.identityName+"\n"+
                            "alias:  "+sAlias.replace(/\\/g,"\\\\")+"\n\n"+
                            "Please adjust in the Correct Identity settings!");
                    }
                  }
                  else if (optionalHint.indexOf(sAlias) >= 0)
                    oAliasedId = oThisIdentity;
          }
        }
        oIdentity = oMatchingId ? oMatchingId : (oAliasedId ? oAliasedId : oIdentity); // Select the best match
      }
    }

    return oIdentity;
  }

};

window.addEventListener('load',CorrectIdentity.init,false);
