// Seam between the web view (which owns its history/home URL) and the app
// chrome (header back button, Android back, footer Home). No RN imports.
type Handler = () => boolean;

let backHandler: Handler | null = null;
let homeHandler: Handler | null = null;

export function setWebBackHandler(handler: Handler | null) {
  backHandler = handler;
}

export function setWebHomeHandler(handler: Handler | null) {
  homeHandler = handler;
}

export function webGoBack(): boolean {
  return backHandler?.() ?? false;
}

export function webGoHome(): boolean {
  return homeHandler?.() ?? false;
}
