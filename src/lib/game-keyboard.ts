export function ignoreGameKey(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  const target = event.target;
  return target instanceof Element && (!!target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]') || (event.key === " " && !!target.closest("button, a")));
}
