// 战斗 UI 安全区防重叠测试
'use strict';
var fs = require('fs'), root = __dirname + '/../js/';
(function() {
  var content = fs.readFileSync(root + 'data.js', 'utf8');
  var data = {};
  var fn = new Function('global', content + '; global.UI_LAYOUT = UI_LAYOUT;');
  fn(data);
  var ui = data.UI_LAYOUT;
  var rows = ui.handRows.map(function(r) { return [r, 44]; });
  for (var i = 0; i < rows.length; i++)
    for (var j = i + 1; j < rows.length; j++)
      if (rows[i][0] < rows[j][0] + rows[j][1] && rows[j][0] < rows[i][0] + rows[i][1])
        throw new Error('手牌行重叠');
  var lastRowBottom = rows[rows.length - 1][0] + rows[rows.length - 1][1];
  if (lastRowBottom > ui.actionBar.y) throw new Error('手牌压操作栏');
  ['topBar','enemyField','messageBand','playerField','heroStatus','handRows','actionBar','recycle','tempDrawer'].forEach(function(k) {
    if (!ui[k]) throw new Error('UI_LAYOUT 缺 ' + k);
  });
  console.log('布局安全 OK');
})();
