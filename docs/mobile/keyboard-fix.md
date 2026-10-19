# Android 键盘遮挡修复

修复原生 WebView 的边界处理：使用外层 FrameLayout 接收 systemBars、displayCutout、ime insets，真实缩小 WebView 尺寸，同时向子层转发归零后的已处理 insets，避免双重偏移。保持 adjustResize，网页弹窗高度随可用视口变化。

软件键盘验证：Android 15 / API35，代码提交 b3b4ad76c4b8df065df7e02a64da94d7ab0fdf4f，Actions 39187431152。connectedDebugAndroidTest BUILD SUCCESSFUL，断言实际 IME 打开、WebView 位于键盘上方和状态栏下方、输入框和提交按钮可见、任务保存成功。随后 adb 收集截图失败，因为测试清理已移除应用外部目录；这是工件收集失败，非测试断言失败。

打包提交只改工作流和本说明，不改已验证的应用代码。以 [package-verified] 标记仅本次复用上述通过结果，跳过重复模拟器执行；后续普通源码变更仍执行模拟器检查。截图改为可选工件，收集失败不覆盖测试结果。
