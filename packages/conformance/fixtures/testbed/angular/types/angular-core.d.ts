/**
 * Dev-time Angular type stubs (testbed-inventory shared assertion #2): the testbed
 * source is authored against these declarations so it typechecks with no runtime
 * Angular dependency. Kept OUTSIDE `src/` so the analyzer never discovers it — the
 * analyzer is syntax-only and reads the component source directly.
 */
declare module '@angular/core' {
  export interface InputOptions<T> {
    alias?: string;
    transform?: (value: unknown) => T;
  }
  export interface InputSignal<T> {
    (): T;
  }
  export interface ModelSignal<T> {
    (): T;
    set(value: T): void;
  }
  export interface OutputEmitter<T> {
    emit(value: T): void;
  }

  export function input<T>(initial: T, opts?: InputOptions<T>): InputSignal<T>;
  export function input<T>(): InputSignal<T | undefined>;
  export namespace input {
    export function required<T>(opts?: InputOptions<T>): InputSignal<T>;
  }
  export function model<T>(initial: T): ModelSignal<T>;
  export function model<T>(): ModelSignal<T | undefined>;
  export function output<T>(): OutputEmitter<T>;
  export function signal<T>(initial: T): { (): T; set(value: T): void };
  export function inject<T>(token: unknown): T;
  export function booleanAttribute(value: unknown): boolean;

  export class EventEmitter<T> {
    emit(value: T): void;
  }

  export function Component(meta: unknown): ClassDecorator;
  export function Input(opts?: string | InputOptions<unknown>): PropertyDecorator;
  export function Output(alias?: string): PropertyDecorator;
  export function HostBinding(binding: string): PropertyDecorator;
}
