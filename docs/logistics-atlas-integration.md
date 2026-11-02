# 物流知识地球：工作台接入

范围：新增 `atlas` 菜单、同源 iframe 页面和独立静态资源；不改动现有物流 Draw、任务或账号数据。

入口：`/?view=atlas`。地球使用色块陆地与深蓝海洋，现阶段为示意线路及国家知识卡片。笔记通过父页面 LambertPrivateStorage 按账号隔离，独立页面才回退到浏览器存储；暂不承诺云同步。

后续设计：节点库保存地点与经纬度，路线保存有序节点 ID，知识卡片挂在节点或路段。先手工选节点、排序、保存模板，再生成路线；不要自动猜测真实运输链路。杭州中心与义乌揽收点属于不同角色，可同时出现在一条路线，实际顺序需业务确认。日本目的机场可选关西，后续清关、分拨、派送点待补全。

参考：Mapbox Directions 的有序 waypoint 输入与路线/分段展示；其道路寻路不能代替跨境物流业务节点配置。
https://docs.mapbox.com/api/navigation/directions/

验证：JS 语法检查通过；生成 PDF.js 公共资源后，Netlify 静态构建通过（243 引用，无缺失）。当前环境没有 DeepSeek 凭证，预检为 credentialPresent=false，无外部模型调用。WebGL 模式未在此环境验证；地球自带 Canvas 兼容模式。

数据来源：色块底图由 Globe.GL 示例使用的 Natural Earth 国家轮廓生成（公共领域），不作为精确边界或导航依据。Globe.GL 使用 MIT 协议，原许可保留在 assets/logistics-atlas/LICENSE.txt。
