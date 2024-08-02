import { BaseObject } from '../../base-object';
import { global } from '../../global';
import { ObserverError } from './types';
import { currentTimeString } from '../../utils/date-time';
import { error, log } from '../../log';

export class Observer extends BaseObject {
  private readonly errors: ObserverError[] = [];
  private readonly keys: Record<string, boolean> = {};
  private _hasErrors: boolean = false;

  constructor(private readonly observerName: string) {
    super();
    global.events.subscribe('onStop', this._onStop, this);
  }

  hasErrors() {
    return !!this.errors.length;
  }

  error(message: string, params: object) {
    if (Array.isArray(params)) {
      params.forEach((errorParams) => this.errorOnce(message, errorParams));
      return;
    }

    this.errors.push({ date: currentTimeString(), message, params });
  }

  addErrors(errors: ObserverError[]) {
    errors.forEach((error) => this.errorOnce(error.message, error.params));
  }

  errorOnce(message: string, params: object) {
    const key = message;
    if (this.keys[key]) return;

    this.keys[key] = true;
    this.error(message, params);
  }

  private _onStop() {
    if (!this.errors.length) {
      log(this.observerName, 'Tests passed successfully', {}, true);
      return;
    }

    error(this.observerName, 'Tests failed with errors. Check report for more information', {}, true);

    global.report.tableUpdate(
      `${this.observerName} | Failed tests`,
      this.errors.map((error) => ({
        ...error,
        ...(typeof error.params === 'object' && { params: JSON.stringify(error.params) }),
      })),
    );
  }
}
