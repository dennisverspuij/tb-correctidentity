let { ExtensionCommon } = ChromeUtils.importESModule("resource://gre/modules/ExtensionCommon.sys.mjs");

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
let onRecipientsChangedWindowIds = new Set();

function restoreOnRecipientsChangedHook(windowId) {
  try {
    let win = Services.wm.getOuterWindowWithId(windowId);
    if (win && win.origOnRecipientsChanged) {
      win.onRecipientsChanged = win.origOnRecipientsChanged;
      delete win.origOnRecipientsChanged;
    }
  } catch (_error) {
    // The window was already closed or destroyed.
  }
  onRecipientsChangedWindowIds.delete(windowId);
}

var exp = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    context.callOnClose(this);
    return {
      exp: {
        //////////////////////////////////////////////////////////////
        // note: would no longer be needed, if https://bugzilla.mozilla.org/show_bug.cgi?id=1700672 is fixed
        async installOnRecipientsChangedHook(tabId, windowId) {
          let win = Services.wm.getOuterWindowWithId(windowId);
          if (!win) {
            // The window was already closed or destroyed.
            onRecipientsChangedWindowIds.delete(windowId);
            return;
          }
          if (!win.origOnRecipientsChanged) {
            win.origOnRecipientsChanged = win.onRecipientsChanged;
          }

          win.onRecipientsChanged = ( automatic => {
            // emit event to background script
            if (!automatic) {
              onRecipientsChangedListener.emit("recipientsChanged", tabId);
            }

            // call original function, we need the window from the outer function
            win.origOnRecipientsChanged(automatic);
          });
          onRecipientsChangedWindowIds.add(windowId);
        },
        async uninstallOnRecipientsChangedHook(windowId) {
          restoreOnRecipientsChangedHook(windowId);
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

  close() {
    for (let windowId of onRecipientsChangedWindowIds) {
      restoreOnRecipientsChangedHook(windowId);
    }
    onRecipientsChangedWindowIds.clear();
  }
};
