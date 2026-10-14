export const SETTINGS_SECTIONS = ['appearance', 'character', 'calendar', 'combatSettings', 'streaming', 'hiddenCube', 'about'];
export const ANALYSIS_SECTIONS = ['overview', 'skills', 'training', 'curves', 'effects', 'build', 'worldBosses', 'gameReport', 'history', 'planner', 'alerts'];

export function settingsSection(value) {
  return SETTINGS_SECTIONS.includes(value) ? value : 'appearance';
}

export function nextTab(ids, current, key) {
  if (!ids.length || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return null;
  if (key === 'Home') return ids[0];
  if (key === 'End') return ids.at(-1);
  const index = Math.max(0, ids.indexOf(current));
  return ids[(index + (key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length];
}

export function modalControls(panel) {
  return [...panel.querySelectorAll('button,input:not([type=hidden]),select,textarea,a[href],summary,[tabindex]')]
    .filter(control => control.tabIndex >= 0 && !control.matches(':disabled') && !control.closest('[hidden],[inert]') && control.getClientRects().length > 0);
}

export function focusBoundary(controls, active, backwards = false) {
  if (!controls.length) return null;
  if (!controls.includes(active)) return backwards ? controls.at(-1) : controls[0];
  if (backwards && active === controls[0]) return controls.at(-1);
  if (!backwards && active === controls.at(-1)) return controls[0];
  return null;
}

export function shouldApplyPollFailure(start, current) {
  return start.receivedCount === current.receivedCount && start.revision === current.revision;
}

export function captureFormDraft(form) {
  const counts = new Map();
  return [...form.elements].filter(control => control.name && !control.disabled && !['file', 'submit', 'button', 'hidden'].includes(control.type)).map(control => {
    const base = `${control.name}:${control.type}`, index = counts.get(base) || 0;
    counts.set(base, index + 1);
    return { name: control.name, type: control.type, index, value: control.value, checked: control.checked };
  });
}

export function restoreFormDraft(form, draft) {
  for (const field of draft) {
    const controls = [...form.elements].filter(control => control.name === field.name && control.type === field.type);
    const checkable = ['checkbox', 'radio'].includes(field.type);
    const control = checkable ? controls.find(control => control.value === field.value) : controls[field.index];
    if (!control || control.disabled) continue;
    if (checkable) control.checked = field.checked;
    else if (!control.options || [...control.options].some(option => option.value === field.value)) control.value = field.value;
  }
}

// Serialize window transitions; an earlier delayed open cannot overtake a close.
export function createPanelSynchronizer(write, onError) {
  let revision = 0, tail = Promise.resolve();
  return open => {
    const current = ++revision;
    const pending = tail.then(async () => {
      if (current !== revision) return false;
      try { await write(Boolean(open)); return true; }
      catch (error) { if (current === revision) onError?.(error); return false; }
    });
    tail = pending.then(() => {});
    return pending;
  };
}
