// import { error } from './log';
// import { global } from './global';

export class BaseError extends Error {
  context: Record<string, any> = {};
  constructor(msg: string, context: any = {}) {
    super(msg);
    this.name = 'BaseError';

    // if (context.e && context.e?.constructor?.name !== 'BaseError') {
    //   context.internalStack = context.e.stack;
    // }

    this.context[msg] = context;
    // console.log('BaseError::constructor', msg, { context, stack: this.stack }, true);

    //error('BaseError::constructor', msg, { ...args, e: this });
    // error('BaseError::constructor', msg, { ...args, e: this });
    // if (global.report) {
    //   global.report.updateReport().then(() => {});
    // }
  }
}
