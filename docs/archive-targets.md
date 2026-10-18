# 阅读归档位置设置

网页每日记录或每日阅读 → 归档位置设置：添加名称和飞书知识库节点链接，为每日记录、每日阅读、插件阅读笔记分别设置默认位置。保存时输入现有AI入口密码，密码不会存入配置。配置使用现有Upstash Redis与AI_ACCESS_PASSWORD，不新增凭证。

当前支持 https://租户.feishu.cn/wiki/节点ID，暂不支持云盘文件夹。目标节点需给原飞书应用编辑权限，否则归档会返回权限提示。

已有文档不会自动搬迁。选择新位置后重新归档会在新位置新建，同位置继续更新。未改配置前兼容原节点；旧配置升级时每日记录默认保留原位置；之后也可独立修改。

插件：下载 downloads/lambert-reading-extension-v0.2.4.zip，解压到现有插件文件夹；chrome://extensions 打开开发者模式，点原插件“重新加载”。也可解压新文件夹后加载已解压的扩展程序。插件侧栏有位置选择器，“添加/修改”打开工作台设置；位置会从服务端读取。

检查仅使用模拟接口，不向真实飞书写测试文档。

保存报错现在分为：PASSWORD_REQUIRED（未填密码）、CONFIG_PASSWORD_MISSING（当前部署缺 AI_ACCESS_PASSWORD）、CONFIG_STORE_MISSING（当前部署缺Redis连接）、CONFIG_STORE_UNAVAILABLE（存储服务无法连接或返回错误）。设置弹窗只显示缺少的配置项名称，不返回密钥值。Preview与Production环境配置需分别核对。
