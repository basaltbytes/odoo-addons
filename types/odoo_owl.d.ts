// Upstream Odoo's owl.d.ts re-exports from the package internals. Keep this
// local overlay so addon-only typecheck works without the full Odoo source
// tree or a package-internal path mapping.
declare module "@odoo/owl" {
  export class Component<Props = any, Env = any> {
    props: Props;
    env: Env;
    static template: string;
    static components: Record<string, unknown>;
    static props: unknown;
    setup?(): void;
  }

  export class App<C = any> {
    static apps: Set<App<any>>;
    mount(target: HTMLElement | ShadowRoot): Promise<C>;
    constructor(Component: new (...args: any[]) => C, config?: Record<string, unknown>);
  }

  export interface Ref<T = HTMLElement> {
    el: T | null;
  }

  export function useRef<T = HTMLElement>(name: string): Ref<T>;
  export function useState<T extends object>(obj: T): T;
  export function toRaw<T>(value: T): T;
  export function reactive<T extends object>(obj: T, cb?: () => void): T;
  export function useEffect(
    fn: (...deps: any[]) => void | (() => void),
    depsFn?: () => any[]
  ): void;
  export function useEnv<T = any>(): T;
  export function useSubEnv(env: Record<string, unknown>): void;
  export function useChildSubEnv(env: Record<string, unknown>): void;
  export function onWillStart(fn: () => void | Promise<void>): void;
  export function onMounted(fn: () => void): void;
  export function onWillUnmount(fn: () => void): void;
  export function onPatched(fn: () => void): void;
  export function onWillUpdateProps(fn: (props: any) => void | Promise<void>): void;
  export function onWillDestroy(fn: () => void): void;
  export function onError(fn: (err: unknown) => void): void;
  export function xml(strings: TemplateStringsArray, ...vals: unknown[]): string;
  export const markup: (s: string) => {toString(): string};

  export class EventBus extends EventTarget {
    trigger(name: string, payload?: unknown): void;
  }
}
