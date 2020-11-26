// needs to be aligned with background script definitions
const BUTTON_OK = 1;
const BUTTON_CANCEL = 2;

function onButtonClicked(event) {
  var result = 0;
  if (event.target.value === "OK") {
    result |= BUTTON_OK;
  }
  if (event.target.value === "CANCEL") {
    result |= BUTTON_CANCEL;
  }
  browser.windows.getCurrent().then((window) => {
    browser.runtime.sendMessage({
      msgType: "CLOSE_WINDOW",
      windowId: window.id,
      result: result,
    });
  });
}

function onLoad(event) {
  const queryString = window.location.search;
  var searchParams = new URLSearchParams(queryString);
  text = searchParams.get("string");
  title = searchParams.get("title");
  buttons = searchParams.get("buttons");

  document.getElementById("dialogText").innerHTML = text;
  document.title = title;

  // show requested buttons
  document.getElementById("ok").style.visibility =
    (buttons & BUTTON_OK) == 0 ? "hidden" : "visible";
  document.getElementById("cancel").style.visibility =
    (buttons & BUTTON_CANCEL) == 0 ? "hidden" : "visible";

  // send message to background script to close me
  document.getElementById("ok").addEventListener("click", onButtonClicked);
  document.getElementById("cancel").addEventListener("click", onButtonClicked);
}

document.addEventListener("DOMContentLoaded", onLoad);
