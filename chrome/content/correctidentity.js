var CorrectIdentity = {
	
  init: function()
  {
    setTimeout(window.CorrectIdentity.delayedInit,1);
  },

  delayedInit: function()
  {
    if (window.getIdentityForServer && (window.CorrectIdentity.origgetIdentityForServer == null))
    {
      window.CorrectIdentity.origgetIdentityForServer = window.getIdentityForServer;
      window.getIdentityForServer = window.CorrectIdentity.getIdentityForServer;
    }
  },
  
	origgetIdentityForServer: null,
	getIdentityForServer: function(server, optionalHint)
	{
	  // First, fetch the identity the default selection mechanism whould choose
	  var oIdentity = window.CorrectIdentity.origgetIdentityForServer(server, optionalHint);

    // Second, if we have a hint and it does not contain the selected identity's email address then
    // enumerate the email addresses of all identities available from last till first and return
    // the last one that exists in the hint instead
    if (optionalHint && window.accountManager)
    {
      optionalHint = optionalHint.toLowerCase();
      if (!(oIdentity && (optionalHint.indexOf(oIdentity.email.toLowerCase()) >= 0)))
        for(var allIdentities=window.accountManager.allIdentities, iCnt=allIdentities.Count(), oId; iCnt--;)
          if (optionalHint.indexOf((oId = allIdentities.QueryElementAt(iCnt, Components.interfaces.nsIMsgIdentity)).email.toLowerCase()) >= 0)
            oIdentity = oId;
    }
    
    return oIdentity;
	}

};

window.addEventListener('load',CorrectIdentity.init,false);
