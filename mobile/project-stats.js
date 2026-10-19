(function(root){'use strict';
 function validDate(day){if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;var parts=day.split('-').map(Number),d=new Date(parts[0],parts[1]-1,parts[2],12);return d.getFullYear()===parts[0]&&d.getMonth()===parts[1]-1&&d.getDate()===parts[2];}
 function stats(rows,day){
  var result={total:0,done:0,doing:0,todo:0,overdue:0,percent:0};
  (Array.isArray(rows)?rows:[]).forEach(function(t){if(!t||typeof t!=='object'||Array.isArray(t)||t.archived||t.deletedAt)return;result.total++;if(t.status==='已完成')result.done++;else if(t.status==='进行中')result.doing++;else result.todo++;var due=typeof t.due==='string'?t.due.slice(0,10):'';if(t.status!=='已完成'&&validDate(day)&&validDate(due)&&due<day)result.overdue++;});
  result.percent=result.total?Math.round(result.done/result.total*100):0;return result;
 }
 root.MobileProjectStats={stats:stats};
})(globalThis);
