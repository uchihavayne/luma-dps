import { clippedInputRegion } from './overlay.mjs';

// Keep controls themselves stable so live metrics do not discard focus or scroll.
export function setText(element, value) {
  const text = String(value ?? '');
  if (element.textContent !== text) element.textContent = text;
}

export function setAttribute(element, name, value) {
  const text = String(value ?? '');
  if (element.getAttribute(name) !== text) element.setAttribute(name, text);
}

export const DRAG_CONTROL_SELECTOR = 'button,input,select,textarea,a,label,[role="button"],[role="tab"],[contenteditable="true"],[data-no-drag]';

export function isDrawerDragStart(event, header) {
  const target = event.target;
  return event.button === 0 && event.isPrimary !== false && Boolean(target && header.contains(target)) && !target.closest(DRAG_CONTROL_SELECTOR);
}

export function delegatedControl(event, container, selector) {
  const control = event.target?.closest(selector);
  return control && container.contains(control) ? control : null;
}

export const INPUT_CONTROL_SELECTOR = 'button,input,select,textarea,a[href],summary,[role="button"],[role="tab"],.pet-tracker-rows,.target-pet-pin-actions,.roster-list:has(>#target-roster-strip:not([hidden]))';

export function visibleInputRegions(root, viewport) {
  const view = root.ownerDocument.defaultView, styles = new Map(), regions = [];
  const styleOf = element => { if (!styles.has(element)) styles.set(element, view.getComputedStyle(element)); return styles.get(element); };
  for (const control of root.querySelectorAll(INPUT_CONTROL_SELECTOR)) {
    if (control.matches(':disabled,[aria-disabled="true"]') || control.closest('[hidden],[inert],[aria-hidden="true"]') || !control.getClientRects().length) continue;
    const clips = [];
    let hidden = false;
    for (let ancestor = control; ancestor; ancestor = ancestor.parentElement) {
      const style = styleOf(ancestor);
      if (style.visibility === 'hidden' || style.visibility === 'collapse' || style.display === 'none' || Number(style.opacity) === 0) { hidden = true; break; }
      if (ancestor !== control && (style.overflowX !== 'visible' || style.overflowY !== 'visible')) {
        const rect = ancestor.getBoundingClientRect(), clipX = style.overflowX !== 'visible', clipY = style.overflowY !== 'visible';
        clips.push({ x: clipX ? rect.x + ancestor.clientLeft : 0, y: clipY ? rect.y + ancestor.clientTop : 0,
          width: clipX ? ancestor.clientWidth : viewport.width, height: clipY ? ancestor.clientHeight : viewport.height });
      }
      if (ancestor === root) break;
    }
    if (hidden || styleOf(control).pointerEvents === 'none') continue;
    const region = clippedInputRegion(control.getBoundingClientRect(), viewport, clips);
    if (region) regions.push(region);
    if (regions.length >= 128) break;
  }
  return regions;
}

export function reconcileKeyedRows(container, items, { key, create, update }) {
  const active = container.ownerDocument.activeElement;
  const focused = active && container.contains(active) ? active : null;
  const scrollTop = container.scrollTop, scrollLeft = container.scrollLeft;
  const existing = new Map([...container.children].map(element => [element.dataset.key, element]));
  const retained = new Set();
  items.forEach((item, index) => {
    const id = String(key(item, index));
    let row = existing.get(id);
    if (!row) { row = create(item); row.dataset.key = id; }
    retained.add(row);
    update(row, item, index);
    const atIndex = container.children[index] || null;
    if (atIndex !== row) {
      // Modern DOM moveBefore preserves focus and other element state when moving.
      if (row.parentElement === container && typeof container.moveBefore === 'function') container.moveBefore(row, atIndex);
      else container.insertBefore(row, atIndex);
    }
  });
  for (const row of [...container.children]) if (!retained.has(row)) row.remove();
  if (focused?.isConnected && container.ownerDocument.activeElement !== focused) focused.focus({ preventScroll: true });
  container.scrollTop = scrollTop; container.scrollLeft = scrollLeft;
}
