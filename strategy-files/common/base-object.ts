import { uniqueId } from './base';
import { global } from './global';

export class BaseObject {
  id: string;

  constructor() {
    this.id = uniqueId(8);
    return this;
  }

  unsubscribe() {
    global.events.unsubscribeByObj(this);
  }
}
