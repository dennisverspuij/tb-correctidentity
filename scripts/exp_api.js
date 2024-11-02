let { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");


let onRecipientsChangeHookInstalled = {};  // key: windowId; value: bool


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

let onRecipientsChangedListener = new OnRecipientsChangedListener();

var exp = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    context.callOnClose(this);
    return {
      exp: {
        //////////////////////////////////////////////////////////////
        // note: would no longer be needed, if https://bugzilla.mozilla.org/show_bug.cgi?id=1700672 is fixed
        async installOnRecipientsChangedHook(tabId, windowId) {
          if (!onRecipientsChangeHookInstalled[windowId]) {
            onRecipientsChangeHookInstalled[windowId] = true;
            let win = Services.wm.getOuterWindowWithId(windowId);
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
        // note: would no longer be needed, if https://bugzilla.mozilla.org/show_bug.cgi?id=1700672 is fixed
        onRecipientsChanged: new ExtensionCommon.EventManager({
          context,
          name: "exp.onRecipientsChanged",
          register(fire) {
            function callback(_event, tabId) {
              return fire.async(tabId);
            }

            onRecipientsChangedListener.add(callback);
            return function() {
              onRecipientsChangedListener.remove(callback);
            };
          },
        }).api(),
        //////////////////////////////////////////////////////////////
      }
    };
  }
};
