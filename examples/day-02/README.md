# Day 02 · 实际 Z3 教学实验

本目录用真正的 `z3-solver` 运行六个基础例子及若干对照。网页中的记录查看器展示的是已经运行并保存的结果；拖动其他教学演示不等于在浏览器中调用 Z3。

[Day 2 可视化教程](../../day-02.html) · [课程对应表](../../notes/day-02-course-map.md) · [完整实际输出 JSON](../../data/day-02-z3-results.json)

## 开始运行

从仓库根目录执行：

```bash
python -m pip install -r examples/day-02/requirements.txt
python examples/day-02/run_examples.py --output my-day-02-results.json
```

省略 `--output` 时直接输出到终端。输出是 UTF-8 JSON，不需要浏览器或网络服务。

安装后的脚本只在本地运行。运行前先写下自己的预测，再把输出与预测并列记录；不要用本仓库已有记录代替自己的本机实测。

## 本次已经运行的结果

教程制作环境：Python **3.12.14**，Z3 **5.3.1**，Python 包 **z3-solver 5.3.1.0**，Linux x86_64。实际运行时间与每次 `check()` 的耗时保存在 JSON 中。

| 例子 | 实际结果 | 本次模型或核心 |
|---|---|---|
| S1：两间 2×2 房放入 4×3 | `sat` | A=(0,0)，B=(2,0) |
| S2：两间 2×2 房放入 5×5 | `sat` | A=(0,2)，B=(0,0) |
| S3：单间 2×2 房放入 2×2 | `sat` | A=(0,0) |
| U1：两间 2×2 房放入 3×3 | `unsat` | `a_inside, b_inside, no_overlap` |
| U2：单间 2×2 房放入 1×3 | `unsat` | `a_inside` |
| U3：门宽 ≥0.8 且 ≤0.5 | `unsat` | `minimum_clearance, available_opening` |

S1–U2 使用整数位置、米、轴对齐、不旋转、允许接边的模型。U3 使用精确实数门宽。SAT 图中的坐标直接来自该次 Z3 模型；UNSAT 没有伪造的“失败模型”。

模型往往不唯一，核心的成员与顺序也可能随版本或运行方式改变。复现时首先核对输入与语义、求解状态、模型是否满足条件和核心是否仍构成冲突，不要求坐标、顺序或耗时逐字相同。

## 扩展对照

- **整数与连续坐标**：把 U1 的坐标改成 `Real` 后再次运行，结果仍为 `unsat`。这一特例的连续无解经过单独核对。
- **push/pop**：基础条件 `2 <= x <= 6` 得到 `sat`；`push` 后加入 `x <= 1` 得到 `unsat`；`pop` 后恢复 `sat`，前后基础断言列表一致。
- **assumptions**：用两个布尔开关守卫门宽上下界，分别以两个开关、单个开关、两个开关检查，得到 `unsat → sat → unsat`。改变的是本次检查要求为真的假设，背景蕴含式仍在求解器中。
- **标签粒度**：将 `x>=2` 和 `x<=1` 分别跟踪时返回两个标签；把它们打包成一个 `And` 跟踪时可只返回一个标签。标签数量不等于原子需求数量。
- **两个独立冲突**：x 的上下界冲突和 y 的上下界冲突同时存在。只删除本次核心的一条 x 条件后，实际结果仍为 `unsat`，新的核心指出 y 冲突。
- **背景断言**：普通 `add(x>=2)` 加 `assert_and_track(x<=1, 'tracked_upper')`，实际核心只有 `tracked_upper`。必须连同未跟踪背景理解这个标签。
- **unknown**：官方例子 `Real x; 2**x == 3` 本次返回 `unknown`，`reason_unknown()` 的原文也是 `unknown`。设置了 3000 ms 上限，本次约 1.31 ms 返回；这个记录没有证据支持把原因写成超时。原文档把该例用于说明非多项式表达的求解边界。
- **Solver 与 Optimize**：硬范围为 80–120 cm 时，本次 Solver 给 120 cm；以距离 100 cm 最小为偏好时 Optimize 给 100 cm。硬上限变成 90 cm 时最优值为 90 cm；硬上限变成 70 cm 时两者均 `unsat`。
- **SAT 后独立检查失败**：S1 的布局公式未编码门宽，仍是 `sat`。另用精确数值检查门宽 0.5 m 与机器人宽度 0.6 m，结果不满足该宽度规则。这个检查没有验证三维路径或实际执行。

## 原 MiniLab 对照

本次还在经过 Git blob SHA 核对的原 `14plan/minilab/z3_demo.py` 上，分别以宽度 4、3、5 启动 Python 子进程，得到 `sat`、`unsat`、`sat`。

- 原计划版本：`de6fd9cb352370863e94d64d775c4f5236ed38fc`
- 原文件 blob：`2cb1e01141b6d983c2e6e55b28d407c363604e83`
- [原文件](https://github.com/venividici/14plan/blob/de6fd9cb352370863e94d64d775c4f5236ed38fc/minilab/z3_demo.py)

若本地已有这个版本的 14plan，可选执行：

```bash
python examples/day-02/run_examples.py --output my-day-02-results.json --upstream-demo /path/to/14plan/minilab/z3_demo.py
```

参数中的路径换成自己的原文件位置。脚本会先检查完整内容的 Git blob SHA；文件有任何修改时会要求重新核对版本。省略此参数只跳过原项目子进程对照，六例和其他扩展例照常运行。

## 数据结构与验证范围

`schema_version` 为 1。顶层 `cases` 是六个主要例子，`extra` 是扩展对照，`environment` 记录实际版本和时间，`provenance` 标明运行主体。

每例保留 `input`、`variables`、`constraints`、`status`、`elapsed_ms`、`model`、`unsat_core`、`reason_unknown` 和 `scope`。二维例另有 `view_geometry`；SAT 的 `rooms` 来自实际模型，UNSAT 的 `rooms` 为空，只有边界和尺寸要求。门宽冲突使用 `view_interval`。

脚本会核对六例状态，检查 SAT 模型使各公式成立，并以独立数值规则检查 SAT 布局；对于跟踪断言得到的核心，会重建核心对应公式并核对不可满足。还检查了恢复断言、假设切换、连续坐标特例和优化边界。

这些检查证明的是所列教学输入和约束的行为。**没有执行机器人物理任务，也没有为用户标记已掌握或已完成。**耗时仅记录一次运行，不能用来比较算法或机器性能。

## 官方依据

- [Z3Py Introduction](https://github.com/microsoft/z3guide/blob/main/website/docs-programming/02%20-%20Z3%20Python/01%20-%20Introduction.md)：Solvers、Boolean Logic、Arithmetic。
- [Programming Z3](https://z3prover.github.io/papers/programmingz3.html)：§4.1–§4.5 与 §8。
- [R03](https://github.com/venividici/14plan/blob/de6fd9cb352370863e94d64d775c4f5236ed38fc/STUDY_GUIDES/R03.md) 与 [Day 02 任务手册](https://github.com/venividici/14plan/blob/de6fd9cb352370863e94d64d775c4f5236ed38fc/TASK_GUIDES/day-02.md)。
