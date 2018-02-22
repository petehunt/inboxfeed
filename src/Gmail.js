import EventEmitter from "eventemitter3";
import invariant from "invariant";

export const emitter = new EventEmitter();
export let gapi = null;

// Client ID and API key from the Developer Console
let CLIENT_ID = null;

// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = [
  "https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"
];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
var SCOPES =
  "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.labels https://www.googleapis.com/auth/gmail.modify";

/**
 *  On load, called to load the auth2 library and API client library.
 */
function handleClientLoad() {
  gapi = window.gapi;
  gapi.load("client:auth2", initClient);
}

/**
 *  Initializes the API client library and sets up sign-in state
 *  listeners.
 */
function initClient() {
  gapi.client
    .init({
      discoveryDocs: DISCOVERY_DOCS,
      clientId: CLIENT_ID,
      scope: SCOPES
    })
    .then(function() {
      // Listen for sign-in state changes.
      gapi.auth2
        .getAuthInstance()
        .isSignedIn.listen(isSignedIn =>
          emitter.emit("signInStatus", isSignedIn)
        );

      // Handle the initial sign-in state.
      emitter.emit(
        "signInStatus",
        gapi.auth2.getAuthInstance().isSignedIn.get()
      );
    });
}

export function install(clientId) {
  invariant(!CLIENT_ID, "already installed");
  CLIENT_ID = clientId;

  const script = document.createElement("script");
  script.src = "https://apis.google.com/js/api.js";
  script.onload = handleClientLoad;
  script.onreadystatechange = () => {
    if (this.readyState === "complete") {
      handleClientLoad();
    }
  };
  document.body.appendChild(script);
}
