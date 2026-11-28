import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { installTapHaptics } from "./lib/haptics";
import { restoreAfterRefresh } from "./lib/refresh";
import { installAppHeight } from "./lib/appHeight";
import { installVisibleViewport } from "./lib/visibleViewport";

// A light tap you feel on every press, on phones that can do it.
installTapHaptics();
// Back to where he was after tapping Refresh.
restoreAfterRefresh();
// The whole screen, down to the bottom edge, on the home screen app.
installAppHeight();
// Pop-ups end where the iPhone's keyboard begins.
installVisibleViewport();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
