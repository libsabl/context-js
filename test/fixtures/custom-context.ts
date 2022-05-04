import { Canceler, CancelFunc, Context } from '$';
import { CancelableContext, Setter, Getter } from '$/context';

export class CustomContext implements Context {
  #parent: Context | null;
  #name: string | null;
  value(key: any) {
    throw new Error('Method not implemented.');
  }
  get canceler(): Canceler | null {
    throw new Error('Method not implemented.');
  }
  get canceled(): boolean {
    throw new Error('Method not implemented.');
  }
  toString(): string {
    throw new Error('Method not implemented.');
  }
  withValue(key: any, value: any): Context {
    throw new Error('Method not implemented.');
  }
  withCancel(): [CancelableContext, CancelFunc] {
    throw new Error('Method not implemented.');
  }
  withNumber: Setter<number>;
  getNumber: Getter<number>;
}
