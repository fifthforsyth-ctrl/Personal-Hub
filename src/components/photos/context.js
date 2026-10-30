import { createContext, useContext } from "react";

// What a page's photos and pins (Photos.jsx) hand down to its rows and
// sketches. Apart, so a sketch can open itself up close without a loop of
// imports.
export const PhotoCtx = createContext(null);

export function usePhotos() {
  return useContext(PhotoCtx);
}
