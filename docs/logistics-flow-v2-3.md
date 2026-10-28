# 物流知识库 V2.3：流程连线与自定义模块颜色

## 范围
本轮在 V2.2 四级结构（仓/干/关/配 → 模块 → 子环节 → 操作）上增加两个能力。

1. **默认操作主线**：同一子环节里，常规操作按当前节点顺序展示可见的横向箭头，支持水平滚动。只有操作顺序的视觉表示，不自动声称每个动作一定触发下一动作。
2. **条件分支**：在操作详情选择「添加条件分支」并选择当前大模块内另一操作作为目标、填写条件标签。数据模型新增可选 `module.branches:[{id,from,to,label}]`；当勾选「仅在分支显示」，目标 `node.branchOnly=true`，只在有效关联存在时从主线分离；移除分支后会自动回到主线，**不删除目标操作本身**。
   默认示例：国内中心仓 / 收入，`安检扫描 —[安检异常]→ 安检异常上报`，不是所有包裹的默认必经节点。真实业务规则和系统接口待核实。
3. **颜色自定义**：每个大模块及其子环节有原生颜色选择器，点击「默认色」恢复；模块默认颜色依据仓干关配分类，子环节默认继承所属大模块。保存可选 `module.color` / `module.stages[].color`，值必须是完整的 `#RRGGBB`，不执行任意 CSS。
4. **兼容**：不改变 V1 `schema:1`、不迁移旧节点、不会在单纯访问时写入。全部保存复用原有隔离键 `lambert_logistics_knowledge_v1`，仍无跨设备同步，提供 JSON 导出。任务、项目、复盘和旧知识数据不在写入范围内。

## 当前限制
- 此版不是 BPMN 引擎；流程主线根据当前节点排列，用户配置的分支仅用于知识整理。
- 条件分支目前只支持**同一个大模块内**连接操作，跨模块系统关系、异常会合、判断菱形、关系自动布局留待后续。
- 远距离大模块拖动对浏览器滚动位置敏感，仍提供稳定的上下按钮；手机也可使用顺序按钮。
- 示例主线和分支并未核实实际 OMS/TMS/EDI 的全部触发规则。

## 验证
```bash
node tests/logistics-flow-model.test.mjs
node tests/logistics-stage-model.test.mjs
node tests/logistics-canvas-logic.test.mjs
TEST_ORIGIN=http://127.0.0.1:8765 node tests/logistics-flow-ui.mjs
TEST_ORIGIN=http://127.0.0.1:8765 node tests/logistics-stage-ui.mjs
TEST_ORIGIN=http://127.0.0.1:8765 node tests/logistics-knowledge-ui.mjs
```
通过 `.github/workflows/logistics-flow-ci.yml` 在 GitHub Actions 使用真实 Chromium 检查。基于未合并的 V2.2 分支；仅预览，不直接发布正式版。
