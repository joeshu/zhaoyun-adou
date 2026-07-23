/* 地形建筑：棋盘上的特殊格子，为战斗增加空间策略。 */
'use strict';
function spawnBuilding(x, y, type) {
  G.buildings.push({ x: x, y: y, type: type, range: type === 'tower' ? 80 : 0 });
}
function drawBuildings() {
  if (!G || !G.buildings.length) return;
  for (var i = 0; i < G.buildings.length; i++) {
    var b = G.buildings[i], w = 18, h = 18, cx = b.x - w / 2, cy = b.y - h / 2;
    if (b.type === 'tower') {
      ctx.fillStyle = '#ea8685'; ctx.fillRect(cx, cy, w, h);
      txt('塔', b.x, b.y + 4, 12, '#c92a2a', 'center', true);
    } else if (b.type === 'altar') {
      ctx.fillStyle = '#b197fc'; ctx.fillRect(cx, cy, w, h);
      txt('祭', b.x, b.y + 4, 12, '#5f3dc4', 'center', true);
    } else if (b.type === 'heal') {
      ctx.fillStyle = '#69db7c'; ctx.fillRect(cx, cy, w, h);
      txt('医', b.x, b.y + 4, 12, '#2b8a3e', 'center', true);
    } else if (b.type === 'trap') {
      ctx.fillStyle = '#748ffc'; ctx.fillRect(cx, cy, w, h);
      txt('阱', b.x, b.y + 4, 12, '#364fc7', 'center', true);
    }
  }
}
function tickBuildings(dt) {
  if (!G || !G.buildings || !G.P || !G.P.mobs) return;
  for (var i = 0; i < G.buildings.length; i++) {
    var b = G.buildings[i];
    if (b.type === 'tower') {
      for (var j = 0; j < G.P.mobs.length; j++) {
        var m = G.P.mobs[j];
        if (m.hp <= 0) continue;
        if (Math.hypot(m.x - b.x, m.y - b.y) <= b.range) dealDmg(G.P, m, 4 * dt);
      }
    } else if (b.type === 'heal') {
      for (var c = 0; c < G.P.cells.length; c++) {
        var cell = G.P.cells[c];
        if (cell.unit && cell.unit.hp > 0 && Math.hypot(cell.x - b.x, cell.y - b.y) <= 42) {
          var st = unitStats(cell.unit, G.P);
          cell.unit.hp = Math.min(st.maxhp, cell.unit.hp + 2 * dt);
        }
      }
    } else if (b.type === 'trap') {
      for (var t = 0; t < G.P.mobs.length; t++) {
        var tm = G.P.mobs[t];
        if (tm.hp > 0 && Math.hypot(tm.x - b.x, tm.y - b.y) <= 22) {
          dealDmg(G.P, tm, 10); tm.slowT = Math.max(tm.slowT, 1.5);
        }
      }
    }
  }
}
