# Day 06 · 可复现实验

这组脚本不依赖 Isaac Sim，用标准库复核 Day 6 教程中的受限教学模型。

运行：

```bash
python examples/day-06/run_examples.py
python examples/day-06/run_examples.py --output day-06-my-results.json
```

预期输出：

```text
PASS: 26 cases, 139/139 checks
```

这些检查覆盖简化动力学、门洞净空、reset、reward/success 区分、时间频率与任务合同字段。它们不是 Isaac Sim / Isaac Lab 或实体机器人运行证据。