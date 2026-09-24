// Minimal ambient declaration for the vendored interact.js UMD bundle.
// Covers only the surface we call from `web_planning_view`. Loaded as a
// global via `window.interact` (see `static/lib/interactjs/interact.min.js`
// registered in `web_planning_view/__manifest__.py`).

/**
 * Pointer event mixed with the drag/resize info interact.js attaches.
 * Fields are a subset of what the lib actually provides.
 */
interface InteractEvent {
  type: string;
  target: HTMLElement;
  currentTarget: HTMLElement;
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
  dx: number;
  dy: number;
  rect: DOMRect & {width: number; height: number};
  deltaRect?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  };
  edges?: {left: boolean; right: boolean; top: boolean; bottom: boolean};
  interaction: {pointerIsDown: boolean};
  // Underlying browser event interact.js mixed in. Useful when an inner-most
  // target needs to be inspected (e.g., re-checking ignoreFrom selectors on
  // a tap that bubbled through a child element).
  originalEvent?: Event;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  stopPropagation(): void;
  preventDefault(): void;
}

interface InteractListeners {
  start?: (ev: InteractEvent) => void;
  move?: (ev: InteractEvent) => void;
  end?: (ev: InteractEvent) => void;
  tap?: (ev: InteractEvent) => void;
}

interface InteractDraggableOptions {
  inertia?: boolean;
  listeners?: InteractListeners;
  modifiers?: unknown[];
  autoScroll?: boolean;
  allowFrom?: string;
  ignoreFrom?: string;
}

interface InteractResizableOptions {
  edges?: {
    left?: boolean | string;
    right?: boolean | string;
    top?: boolean | string;
    bottom?: boolean | string;
  };
  listeners?: InteractListeners;
  modifiers?: unknown[];
  margin?: number;
}

interface Interactable {
  draggable(opts: InteractDraggableOptions): Interactable;
  resizable(opts: InteractResizableOptions): Interactable;
  on(event: string, listener: (ev: InteractEvent) => void): Interactable;
  unset(): void;
  styleCursor(value: boolean): Interactable;
}

interface InteractStatic {
  addDocument(document: Document): void;
  removeDocument(document: Document): void;
  (
    selectorOrElement: string | Element,
    opts?: {context?: Element | Document}
  ): Interactable;
  modifiers: {
    snap(opts: unknown): unknown;
    restrictRect(opts: unknown): unknown;
    restrictSize(opts: unknown): unknown;
    restrictEdges(opts: unknown): unknown;
  };
  snappers: {
    grid(opts: {
      x?: number;
      y?: number;
      left?: number;
      top?: number;
      right?: number;
      bottom?: number;
      width?: number;
      height?: number;
      range?: number;
      offset?: {x: number; y: number};
    }): unknown;
  };
  stop(): void;
  isSet(element: Element): boolean;
}

interface Window {
  interact: InteractStatic;
}

declare var interact: InteractStatic;
