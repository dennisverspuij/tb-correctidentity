// needs to be aligned with background script definitions
const BUTTON_OK = 1;
const BUTTON_CANCEL = 2;

async function onButtonClicked(event) {
  let result = 0;
  if (event.target.id === "ok") {
    result |= BUTTON_OK;
  }
  if (event.target.id === "cancel") {
    result |= BUTTON_CANCEL;
  }
  try {
    let window = await messenger.windows.getCurrent();
    // circumvent bug in Thunderbird: replace sendMessage() with direct call into backgroundScript()
    // messenger.runtime.sendMessage({
    //   msgType: "CLOSE_WINDOW",
    //   windowId: window.id,
    //   result: result,
    // });
    messenger.extension.getBackgroundPage().dialogResults[window.id] = result;
    messenger.extension.getBackgroundPage().messenger.windows.remove(window.id);
  } catch (error) {
    console.log("Error: windows.getCurrent failed ", error);
  }
}

function onLoad(event) {
  const queryString = window.location.search;
  let searchParams = new URLSearchParams(queryString);
  let text = searchParams.get("string");
  let buttons = searchParams.get("buttons");

  let dialogText = document.getElementById("dialogText");
  dialogText.setAttribute('style', 'white-space: pre-line;');
  dialogText.textContent = text;

  // show requested buttons
  document.getElementById("ok").style.visibility =
    (buttons & BUTTON_OK) == 0 ? "hidden" : "visible";
  document.getElementById("cancel").style.visibility =
    (buttons & BUTTON_CANCEL) == 0 ? "hidden" : "visible";

  // send message to background script to close me
  document.getElementById("ok").addEventListener("click", onButtonClicked);
  document.getElementById("cancel").addEventListener("click", onButtonClicked);
  i18n.updateDocument();  // from i18n.js
}

document.addEventListener("DOMContentLoaded", onLoad);
