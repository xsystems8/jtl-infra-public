import { uniqueId } from './base';
import { global } from './global';

export class BaseObject {
  id = '';

  constructor() {
    this.id = uniqueId(8);
    return this;
  }

  // init() {
  //   return this;
  // }

  unsubscribe() {
    global.events.unsubscribeByObj(this);
  }
}
