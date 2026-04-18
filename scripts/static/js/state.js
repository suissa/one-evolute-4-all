// @ts-check

export let width = window.innerWidth;
export let height = window.innerHeight;

/** @param {number} w */
export function setWidth(w) { width = w; }
/** @param {number} h */
export function setHeight(h) { height = h; }
export function updateDimensions() {
    width = window.innerWidth;
    const toolbar = document.getElementById('toolbar');
    const toolbarHeight = toolbar ? toolbar.offsetHeight : 0;
    height = window.innerHeight - toolbarHeight;
}
