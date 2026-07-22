/* 每日任务系统：进度归零、奖励独立。 */
'use strict';

(function(){
  if (typeof evOn !== 'function') return;
  evOn('kill', function() { addDailyProgress(1); });
  evOn('merge', function() { addDailyProgress(1); });
})();