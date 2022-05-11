import { Canceler } from '$';
import { IContext } from '$/context';

export class CustomRootContext implements IContext {
  #key: unknown;
  #value: unknown;

  constructor(key: unknown, value: unknown) {
    this.#key = key;
    this.#value = value;
  }

  value(key: unknown) {
    if (key === this.#key) {
      return this.#value;
    }
    return undefined;
  }

  get canceler(): Canceler | null {
    return null;
  }

  get canceled(): boolean {
    return false;
  }
}