export function timeFormatAddZero(timestamp: number) {
  if (timestamp < 10) {
    return '0' + timestamp;
  }
  return timestamp;
}

export function currentTimeString() {
  return timeToString(currentTime());
}

export function currentTime() {
  return tms();
}

export function timeToString(timestamp: number) {
  // formant YYYY-MM-DD HH:MM:SS
  var date = new Date(timestamp);
  return (
    date.getUTCFullYear() +
    '-' +
    timeFormatAddZero(date.getUTCMonth() + 1) +
    '-' +
    timeFormatAddZero(date.getUTCDate()) +
    ' ' +
    timeFormatAddZero(date.getUTCHours()) +
    ':' +
    timeFormatAddZero(date.getUTCMinutes()) +
    ':' +
    timeFormatAddZero(date.getUTCSeconds())
  );
}

export function timeToStrHms(timestamp: number) {
  // formant HH:MM:SS
  var date = new Date(timestamp);
  return (
    timeFormatAddZero(date.getUTCHours()) +
    ':' +
    timeFormatAddZero(date.getUTCMinutes()) +
    ':' +
    timeFormatAddZero(date.getUTCSeconds())
  );
}

export function stringToTimestamp(str: string) {
  // formant YYYY-MM-DD HH:MM:SS
  var date = new Date(str);
  return date.getTime();
}
