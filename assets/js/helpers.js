// http://stackoverflow.com/questions/1669190/javascript-min-max-array-values

function arrayMin(arr) {
  var len = arr.length,
    min = Infinity;
  while (len--) {
    if (arr[len] < min) {
      min = arr[len];
    }
  }
  return min;
}

function arrayMax(arr) {
  var len = arr.length,
    max = -Infinity;
  while (len--) {
    if (arr[len] > max) {
      max = arr[len];
    }
  }
  return max;
}

function generateString(len) {
  var text = "";
  var charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (var i = 0; i < len; i++)
    text += charset.charAt(Math.floor(Math.random() * charset.length));
  return text;
}

function generateID() {
  return [
    generateString(8),
    generateString(4),
    generateString(4),
    generateString(4),
    generateString(12)
  ].join('-');
}
