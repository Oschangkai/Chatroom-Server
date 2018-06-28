export function log(...args): void {
  var msg = Array.prototype.slice.call(args);
  msg.unshift('[' + getCurrentTime() + ']\t');
  console.log.apply(console, msg);
}

function getCurrentTime(): string {
  var t = new Date();
  var ts = t.getFullYear() + '/' + (t.getMonth() + 1) + '/' + t.getDate() + ' ' +
           t.getHours() + ':' + t.getMinutes() + ':' + t.getSeconds();
  return ts;
}