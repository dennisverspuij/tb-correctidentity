// just inform the background script ... then we are done
browser.runtime.sendMessage({ msgType: "NEW_COMPOSE_TAB_READY" });
