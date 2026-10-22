# Day 06 · 验证说明

## 已验证

- `examples/day-06/run_examples.py` 使用 Python 标准库运行 26 个教学案例。
- 共执行 139 个断言检查；脚本成功时输出 `PASS: 26 cases, 139/139 checks`。
- `day-06.html` 为单文件自包含版本，无第三方前端依赖。
- 页面明确区分教学计算、未运行 Isaac/ROS、以及真实物理执行。

## 未验证

- 未启动 Isaac Sim / Isaac Lab。
- 未运行真实 ROS2 / Nav2。
- 未连接实体机器人或硬件传感器。
- 因此网页/脚本通过不等于真实仿真或实机任务通过。