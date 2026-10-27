import {DOCUMENT_KEYS} from './document-keys.mjs';
// Shared, side-effect-free preflight. This module never writes or uploads data.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const canonical = value => Array.isArray(value) ? value.map(canonical) : object(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

export function prepareLocalImport(snapshot) {
  if (!object(snapshot)) throw new TypeError('本地备份格式错误');
  const records = [];
  for (const kind of ['tasks', 'projects']) {
    const items = snapshot[kind] ?? [];
    if (!Array.isArray(items)) throw new TypeError(`${kind} 必须是数组`);
    const seen = new Set();
    for (const payload of items) {
      if (!object(payload) || typeof payload.id !== 'string' || !payload.id.trim())
        throw new TypeError(`${kind} 存在缺少 ID 的记录，请先修复备份`);
      if (seen.has(payload.id)) throw new TypeError(`${kind} 存在重复 ID：${payload.id}`);
      seen.add(payload.id);
      records.push({ kind, itemId: payload.id, payload: structuredClone(payload) });
    }
  }
  const reviews = snapshot.daily_reviews_v2 ?? {};
  if (!object(reviews)) throw new TypeError('复盘必须是按日期保存的对象');
  for (const [itemId, payload] of Object.entries(reviews)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(itemId) || !object(payload))
      throw new TypeError('复盘日期或内容格式错误');
    records.push({ kind: 'reviews', itemId, payload: structuredClone(payload) });
  }
  for(const key of DOCUMENT_KEYS){
    if(!Object.prototype.hasOwnProperty.call(snapshot,key))continue;
    const value=snapshot[key];
    if(value!==null&&(key==='reading_workspace_v2'?!object(value):!Array.isArray(value)))throw new TypeError('阅读或书签数据格式错误：'+key);
    records.push({kind:'documents',itemId:key,payload:{id:key,value:structuredClone(value)}});
  }
  return records;
}

// A populated cloud account must be fetched in full before this is called.
// Existing tombstones are conflicts too: a fresh import must never revive them.
export function planImport(localRecords, cloudRecords) {
  const cloud = new Map();
  for (const record of cloudRecords) {
    const key = JSON.stringify([record.kind, record.itemId]);
    if (cloud.has(key)) throw new TypeError('云端返回重复记录');
    cloud.set(key, record);
  }
  const result = { create: [], unchanged: [], conflicts: [] };
  for (const local of localRecords) {
    const remote = cloud.get(JSON.stringify([local.kind, local.itemId]));
    if (!remote) result.create.push(local);
    else if (!remote.deletedAt && equal(local.payload, remote.payload)) result.unchanged.push(local);
    else result.conflicts.push({ local, remote });
  }
  return result;
}
