// The village's still pictures (public/village/): each build's finished
// painting and the dragons' portraits, eggs and hero. vite.config.js stamps
// a hash of the folder, so a repainted picture comes under a new address
// and the phone fetches it instead of showing the old one from its cache.
const PIC_V = typeof __PIC_VERSION__ !== "undefined" ? __PIC_VERSION__ : "dev";

export const villagePic = (path) => `${import.meta.env.BASE_URL}village/${path}?v=${PIC_V}`;
