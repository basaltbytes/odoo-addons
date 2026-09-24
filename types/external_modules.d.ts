declare module "@bus/*";
declare module "@html_editor/*";

// Upstream Odoo's hoot declarations re-export from internal web paths. Keep a
// tiny standalone overlay so this repo can typecheck without a sibling Odoo
// checkout.
declare module "@odoo/hoot" {
  export const after: any;
  export const beforeEach: any;
  export const describe: any;
  export const expect: any;
  export const mockDate: any;
  export const mockTimeZone: any;
  export const mockTouch: any;
  export const test: any;
}

declare module "@odoo/hoot-dom" {
  type DragPositionOptions = {position?: {x: number; y: number}; relative?: boolean};
  export function drag(
    target: string | Element,
    options?: DragPositionOptions
  ): Promise<{
    moveTo(target: string | Element, options?: DragPositionOptions): Promise<unknown>;
    drop(target?: string | Element, options?: DragPositionOptions): Promise<unknown>;
    cancel(): Promise<unknown>;
  }>;
  export const click: any;
  export const edit: any;
  export const select: any;
  export const press: any;
  export const pointerDown: any;
  export const pointerUp: any;
  export const hover: any;
  export const scroll: any;
  export const queryAll: any;
  export const queryFirst: any;
  export const queryOne: any;
  export const queryText: any;
  export const unload: any;
  export const waitFor: any;
  export const resize: any;
}

declare module "@odoo/hoot-mock" {
  export const animationFrame: any;
  export const mockSendBeacon: any;
  export const tick: any;
  export const microTick: any;
  export const advanceTime: any;
  export const advanceFrame: any;
  export const Deferred: any;
  export const freezeTime: any;
  export const unfreezeTime: any;
}
declare module "@web/*";
declare module "@web/../tests/*";
declare module "@web_tour/*";
declare module "@website/*";

declare module "@web/core/domain" {
  export type DomainListRepr = any[];
}

declare module "@web/core/utils/concurrency" {
  export class KeepLast<T = unknown> {
    add(value: Promise<T> | T): Promise<T>;
  }
}

declare module "@web/model/model" {
  import {EventBus} from "@odoo/owl";

  export class Model {
    static services: string[];
    data: any;
    meta: any;
    orm: any;
    bus: EventBus;
    notify(): void;
    setup(...args: any[]): void;
    load(searchParams?: any): Promise<void>;
    hasData(): boolean;
  }

  export function useModelWithSampleData(
    ModelClass: new (...args: any[]) => any,
    params: any
  ): any;
}

declare module "@web/search/search_model" {
  export interface SearchParams {
    context?: Record<string, unknown>;
    domain?: any[];
    groupBy?: string[];
  }
}
