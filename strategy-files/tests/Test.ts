import { BaseObject } from '../common/base-object';

export class Test extends BaseObject {
  description = '';
  errors = [];
  constructor() {
    super();
  }

  iterator = 0;
  async onTick() {
    this.iterator++;
  }

  async onOrderChange(order) {}

  onInit() {}
  onRun() {}
  onStop() {}
  async error(event, msg, params) {
    this.errors.push({ event: event, msg: msg, params: params });
  }
}
