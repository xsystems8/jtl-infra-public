interface ErrorStack {
  func: string;
  script: string;
  line: string;
}

export function isIterable(obj: object) {
  // checks for null and undefined
  if (obj == null) {
    return false;
  }
  return typeof obj[Symbol.iterator] === 'function';
}

export function uniqueId(length = 4) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

export function parseErrorStack(errorStack: string): ErrorStack[] {
  const stackLines = errorStack.split('\n');
  let parsedStack: ErrorStack[] = [];

  stackLines.forEach((value) => {
    let info = value.trim().split('(');
    let func = info[0].replace('at ', '').trim();
    let script_info = info[1] ? info[1].split('/') : ['', ''];
    script_info = script_info[script_info.length - 1].replace(')', '').split(':');
    let line = script_info[1];
    let script = script_info[0];

    parsedStack.push({ func: func, script: script, line: line });
  });

  return parsedStack;
}

export function parseErrorStackToLines(errorStack: string) {
  let parsedStack = parseErrorStack(errorStack);

  let lines = [];
  parsedStack.forEach((value) => {
    lines.push(value.func + ' in ' + value.script + ' l:' + value.line);
  });
  return lines;
}

export function functionsStackLine(stopFunc?: string) {
  const error = new Error();
  let parsedStack = parseErrorStack(error.stack);

  let line = '';
  for (let i = 1; i < parsedStack.length; i++) {
    const info = parsedStack[i];

    if (info.func === 'functionsStackLine') {
      continue;
    }
    if (info.func === stopFunc) {
      break;
    }
    line = info.func + '()->' + line;
  }
  return line;
}
