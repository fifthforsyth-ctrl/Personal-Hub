import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { installTapHaptics } from "./lib/haptics";

// A light tap you feel on every press, on phones that can do it.
installTapHaptics();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
