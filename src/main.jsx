import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { installTapHaptics } from "./lib/haptics";
import { restoreAfterRefresh } from "./lib/refresh";

// A light tap you feel on every press, on phones that can do it.
installTapHaptics();
// Back to where he was after tapping Refresh.
restoreAfterRefresh();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
