# 画Master V1 · 完整 draw.io 编辑器

目标：保留旧物流画布，在独立「画Master」Tab 中嵌入 diagrams.net / draw.io 原生完整编辑器，不继续复刻 X6。

## 交付结构
- DeepSeek Flash 实际生成 `logistics-drawio-bridge.js` 初稿，经集成补充 XML export 回传兼容；产出调用准确用量：输入 345 + 输出 610 = 955 tokens。
- `logistics-drawio-model.js` 只将旧画布的模块/操作标题、显式保存的分支与异常关系投影成 XML；不会把内部事件、接口、SLA 或其他未公开业务字段发送到外部编辑器。
- `logistics-master-v1.js` 嵌入官方 `https://embed.diagrams.net/?embed=1&proto=json&spin=1&noExitBtn=1&lang=zh`；严格检查消息 origin/source，使用外站的原生图形编辑功能。
- 独立 owner-scoped 存储键：`lambert_logistics_master_drawio_v1`，修改前留 `lambert_logistics_master_drawio_backup_v1` 备份；旧 `lambert_logistics_knowledge_v1` 与 `lambert_logistics_versions_v1` 完全不写入。
- 支持用户手动保存、导出 .drawio、导入本地图纸、新建空白图纸、从原画布重新导入和沉浸模式。
- 使用 draw.io 官方嵌入服务（不是把全套 draw.io 静态资源自托管进 Lambert OS），浏览器仍需能访问 embed.diagrams.net；后续可评估自托管，但不应宣称已脱离互联网服务依赖。
- 前端导入旧画布是一次性快照，不自动回写原业务分支；用户在 draw.io 新画的研究连接不能假装是经核实的真实 OMS/TMS/EDI 流程。
- 如果用户从预览域访问，预览域本地存储与生产域不共享；旧账户本地数据不会自动跨域迁移。

## 验收
- 模型用例：副本中只包含节点标题和已保存的异常分支、不包含敏感字段；独立保存、覆盖前备份、异常旧数据拒绝覆盖、XML 校验。
- 浏览器用例：旧版 Tab 保留、draw.io 原生嵌入入口、严格消息来源、只有用户点击保存才接受 XML、旧知识文档与版本记录不变、刷新后保存的独立图纸仍存在、返回旧画布正常。
- V3.5 旧画布浏览器回归。
- 未合并到 main，预览可体验。生产发布需单独决定。
