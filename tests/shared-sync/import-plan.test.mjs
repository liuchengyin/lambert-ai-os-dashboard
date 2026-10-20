import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareLocalImport, planImport } from '../../shared-sync/import-plan.mjs';

test('保留旧 ID、项目关联、未知字段及删除标记，且不修改备份', () => {
  const backup = { tasks: [{ id: 't1', projectId: 'p1', extra: { steps: [1] }, deletedAt: 'today' }], projects: [{ id: 'p1' }], daily_reviews_v2: { '2026-10-19': { note: '复盘' } } };
  const records = prepareLocalImport(backup);
  assert.equal(records.length, 3);
  assert.deepEqual(records[0].payload, backup.tasks[0]);
  records[0].payload.extra.steps.push(2);
  assert.deepEqual(backup.tasks[0].extra.steps, [1]);
});
test('损坏或重复数据必须阻止导入，不能悄悄跳过', () => {
  for (const data of [{ tasks: {} }, { tasks: [{ title: 'missing id' }] }, { tasks: [{ id: 't1' }, { id: 't1' }] }, { daily_reviews_v2: [] }])
    assert.throws(() => prepareLocalImport(data));
});
test('同 ID 不覆盖，云端删除不复活，字段顺序不影响相等判断', () => {
  const local = prepareLocalImport({ tasks: [{ id: 'new' }, { id: 'same', title: 'a' }, { id: 'conflict', title: 'local' }, { id: 'deleted' }] });
  const remote = [
    { kind: 'tasks', itemId: 'same', payload: { title: 'a', id: 'same' } },
    { kind: 'tasks', itemId: 'conflict', payload: { id: 'conflict', title: 'cloud' } },
    { kind: 'tasks', itemId: 'deleted', payload: { id: 'deleted' }, deletedAt: '2026-10-19' }
  ];
  const plan = planImport(local, remote);
  assert.equal(plan.create.length, 1);
  assert.equal(plan.unchanged.length, 1);
  assert.equal(plan.conflicts.length, 2);
});
