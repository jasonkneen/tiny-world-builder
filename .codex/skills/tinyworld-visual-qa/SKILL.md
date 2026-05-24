---
name: tinyworld-visual-qa
description: Use when visually testing Tiny World Builder UI, camera, ghost opacity, buildings, tile geometry, or frontend polish in the browser.
---

# Tiny World Visual QA

Use the browser route `http://localhost:3000/tiny-world-builder` when available.

Checks:

- Console has no app errors.
- Toolbar shortcuts still work: `0`, `1`-`9`, letter tools, `E`.
- Left-click places only on the editable home board.
- Right-drag and Space+drag pan smoothly.
- Dragging/clicking the minimap canvas pans the camera target while dragging the minimap chrome/footer still moves the widget.
- Minimap colours should track live scene materials plus time/weather theme tint, not a stale fixed palette.
- Orbit still works with normal left-drag.
- Ghost boards do not become editable.
- The opacity torch is smooth and does not reveal square board seams.
- Tilt-shift overlays have `pointer-events: none`, stay below UI controls, and remain visible during pan/orbit/zoom movement.
- Cloud shadow at 0% / low values should reduce ground shadow strength without hiding visible cloud puffs.
- Building details should be believable: manor portico columns stay entry-scale, windows have frames/crossbars, and tall buildings do not stretch entry features unrealistically.
- Toolbar flyouts should sit clear of the toolbar (about 10px), avoid vertical clipping, and reduce empty thumbnail air via camera/frustum framing rather than negative CSS margins inside scrollable flyout containers.
- Dialog titles should use the shared Fraunces `.modal-head strong` treatment, with explanatory body copy in `.modal-copy` / `.confirm-copy` and readable darker muted text.
- Selection preview in the floating agent panel should show useful property chips for the primary selected kind. Supported properties (e.g. tower Top/Body colour, building Shape, Size) should apply immediately through `setCell`; unsupported creative edits can fall back to prompts.
- Selection preview must render the same object/stamp factory as the world view. Voxel-build/custom objects should not fall back to a generic blue cube.
- Selection colour controls should offer a broad palette for supported object parts, not just 3-4 legacy swatches.

Useful browser probes:

```js
pickTile(window.innerWidth / 2, window.innerHeight / 2)
```

```js
getComputedStyle(document.body, '::before').pointerEvents
getComputedStyle(document.body, '::after').pointerEvents
```
