# Day 03 · 可复现的 PDDL 搜索与原 MiniLab 规则检查

这里提供两类实际可运行的程序：**Pyperplan 2.1 读取真实 PDDL 文件并搜索动作序列**，以及**原学习仓库 MiniLab 的规则检查器**。两者用相似的门、钥匙、杯子场景承担不同工作。附带记录来自教程制作环境的真实调用，输入是合成教学场景；没有执行机器人、仿真器、逆运动学或碰撞轨迹规划。

[可视化教程](../../day-03.html) · [课程与官方来源地图](../../notes/day-03-course-map.md) · [制作时的完整运行记录](../../data/day-03-results.json)

## 1. 先运行最小实验

在仓库根目录打开终端。脚本使用 Python **3.8 或以上**的语法；教程记录的实际环境是 Python **3.12.14**、Pyperplan **2.1**。`requirements.txt` 固定规划器版本，避免改用不同版本后混用旧记录。

```bash
python3 -m pip install -r examples/day-03/requirements.txt
python3 examples/day-03/run_examples.py --output my-day-03-results.json
```

Windows 环境若命令名是 `python`，将 `python3` 换成 `python`。可以在自己的 Python 虚拟环境安装依赖。输出文件默认为 `my-day-03-results.json`，不会自动覆盖仓库中本次教程的参考记录。

全套调用实际运行 9 个 PDDL 问题和 9 个原 checker 输入，在终端打印摘要，并把完整结果写成 JSON。耗时是本次调用的观测值，随环境和调度变化；不要把一次微小模型的耗时作为规划器性能排名。

如果暂时不安装规划器，可以只用 Python 标准库运行原 MiniLab：

```bash
python3 examples/day-03/run_examples.py --only-minilab --output my-day-03-minilab.json
```

## 2. 文件分别做什么？

| 文件或目录 | 用途 |
|---|---|
| [run_examples.py](run_examples.py) | 运行 PDDL 解析、落地与 BFS；回放并核对计划；运行原规则函数；保存实际输入、输出与环境。 |
| [requirements.txt](requirements.txt) | 固定 `pyperplan==2.1`；原 MiniLab 单独运行不需要此包。 |
| [pddl/domain.pddl](pddl/domain.pddl) | 本教程的 typed STRIPS 动作域，包含四个动作与完整谓词声明。 |
| [pddl/problem-success.pddl](pddl/problem-success.pddl) 等 9 个 `problem-*.pddl` | 同一动作域下的不同初态与相同抓杯目标；可独立复制和编辑。 |
| [upstream_validate.py](upstream_validate.py) | 原 `14plan/minilab/validate.py` 的逐字节副本；没有加入规划器或悄悄修复原行为。 |
| [worlds](worlds) | 9 个可编辑的 JSON 输入，逐一与参考记录中的 `minilab_cases[].input` 对应。 |
| [../../data/day-03-results.json](../../data/day-03-results.json) | 制作环境中真实产生的 18 个案例记录；不表示学习者已完成实验。 |

本教程 PDDL 域和场景是教学新建文件。原 checker 的来源固定为：

- 仓库版本：[`venividici/14plan@de6fd9cb352370863e94d64d775c4f5236ed38fc`](https://github.com/venividici/14plan/tree/de6fd9cb352370863e94d64d775c4f5236ed38fc)。
- 源文件：[`minilab/validate.py`](https://github.com/venividici/14plan/blob/de6fd9cb352370863e94d64d775c4f5236ed38fc/minilab/validate.py)。
- 源 Git blob SHA：`4cbe22b923d770147e931f610fc00e0d79df96a0`，文件 8266 字节。

运行脚本先核对原 checker 的 Git blob 哈希。若要研究如何修改 checker，请复制成自己的文件并明确记录变更；当前对照脚本会拒绝把改过的文件标为原始 checker。

## 3. PDDL 实验怎样建模？

对象为机器人 `r`，房间 `a/b`，门 `d`，钥匙 `k` 与杯子 `cup`。基线中机器人在 A，杯子在 B，门上锁且未打开，机器人有钥匙、空手，并声明解锁、开门、移动和抓取能力。钥匙按物品栏持有，不占抓杯子的手。

`connected` 与 `door-side` 只表达房间级关系；机器人在相邻房间不等于已经处于正确的把手操作位姿。`can-open` 等是本问题提供的能力声明，未在这里用机械臂模型验证。门宽完全位于 PDDL 之外，用于比较符号计划和独立检查的差别。

四个动作的语义来自 [domain.pddl](pddl/domain.pddl)：

| 动作 | 前置条件 | 增加效果 | 删除效果 |
|---|---|---|---|
| `unlock(r,d,k,room)` | `at`、`door-side`、`has-key`、`fits`、`can-unlock`、`locked` | `unlocked` | `locked` |
| `open(r,d,room)` | `at`、`door-side`、`unlocked`、`can-open` | `opened` | 无 |
| `move(r,from,to,d)` | `at(from)`、`connected(from,to,d)`、`opened`、`can-move` | `at(to)` | `at(from)` |
| `pickup(r,cup,room)` | `at`、`item-at`、`graspable`、`handempty`、`can-pickup` | `holding` | `item-at`、`handempty` |

表中的参数均按动作绑定到同一个对象或位置，精确参数顺序以文件为准。动作前置全为正谓词，满足 Pyperplan 的教学 STRIPS 子集。解锁不等于开门，因此基线实际生成：

```lisp
(unlock r d k a)
(open r d a)
(move r a b d)
(pickup r cup b)
```

初态的事实按经典闭世界语义处理；未列出的事实为假。目标是 `(holding r cup)`，其他没有列进目标的事实不必指定为某个最终值。作用效果未提及的事实保留，状态更新为 `(旧状态 − 删除效果) ∪ 增加效果`。基本语义可对照 [Malte Helmert 的 PDDL 介绍](https://www.cs.toronto.edu/~sheila/2542/w09/A1/introtopddl2.pdf)。

### 九个 PDDL 真实结果

| case ID / 问题文件 | 对基线的改变 | 实际 status | 计划长度 |
|---|---|---|---:|
| `success` / [problem-success.pddl](pddl/problem-success.pddl) | 标准锁门初态，钥匙和四种能力齐全 | `plan_found` | 4 |
| `missing_key` / [problem-missing-key.pddl](pddl/problem-missing-key.pddl) | 只删除 `(has-key r k)` | `no_plan` | 不适用 |
| `missing_unlock` / [problem-missing-unlock.pddl](pddl/problem-missing-unlock.pddl) | 只删除 `(can-unlock r)` | `no_plan` | 不适用 |
| `missing_open` / [problem-missing-open.pddl](pddl/problem-missing-open.pddl) | 只删除 `(can-open r)` | `no_plan` | 不适用 |
| `no_grasp` / [problem-no-grasp.pddl](pddl/problem-no-grasp.pddl) | 只删除 `(can-pickup r)` | `no_plan` | 不适用 |
| `ungraspable` / [problem-ungraspable.pddl](pddl/problem-ungraspable.pddl) | 只删除 `(graspable cup)` | `no_plan` | 不适用 |
| `already_open` / [problem-already-open.pddl](pddl/problem-already-open.pddl) | 删除 locked，增加 unlocked 和 opened | `plan_found` | 2 |
| `narrow_door` / [problem-narrow-door.pddl](pddl/problem-narrow-door.pddl) | 符号输入不变，独立门宽改为 0.50 m | `plan_found` | 4 |
| `goal_already_met` / [problem-goal-already-met.pddl](pddl/problem-goal-already-met.pddl) | 初态 holding，删除 item-at 和 handempty | `plan_found` | 0 |

这里的 `no_plan` 来自**该有限、确定、完全可观测的符号域搜索穷尽**，没有被改写成“搜索超时”。当前域中没有取钥匙、增加技能、换门、借用其他机器人等动作；添加动作或改变初态会形成新的规划问题。结论不推广为现实世界无解。

`goal_already_met` 的 `plan=[]` 是合法的零步计划；失败案例的 `plan` 也为空，但 `status=no_plan`、`plan_length=null`。读取 JSON 时必须检查 status，不能只看列表长度。

## 4. 官方规划器怎样被实际调用？

使用 [Pyperplan 官方项目](https://github.com/aibasel/pyperplan) 的 Parser、grounding 和 BFS；版本来源为 [PyPI 的 2.1 发布](https://pypi.org/project/pyperplan/2.1/)。核心调用如下，完整记录逻辑见脚本：

```python
from pyperplan.pddl.parser import Parser
from pyperplan.grounding import ground
from pyperplan.search.breadth_first_search import breadth_first_search

parser = Parser(domain_path, problem_path)
domain = parser.parse_domain()
problem = parser.parse_problem(domain)
task = ground(
    problem,
    remove_statics_from_initial_state=False,
    remove_irrelevant_operators=False,
)
solution = breadth_first_search(task)
```

`ground` 把带变量的动作绑定到问题中的有限对象。保留静态初态方便把完整场景显示出来；禁用目标相关性裁剪方便保留教学状态语义。规划器仍可能把已确定的静态前置从落地动作中简化掉，因此记录同时保存完整 PDDL 前置 `pre` 与内部 `grounded_preconditions`。

BFS 在这些等代价离散动作中按层搜索，最先找到的计划具有最少动作步数。这不意味着行走距离、运行时间、能耗或风险最小，也不包含真实机械臂的连续运动。

脚本对返回计划另外执行以下核验：

1. 从原 Domain 动作恢复完整前置与效果，核对每步前置确实包含在当前完整状态中。
2. 独立执行删除与增加效果，再与规划器的状态转移结果比较。
3. 核对最终状态包含目标；对给定九例检查机器人唯一位置、锁状态一致、杯子位置与手状态一致。
4. 对无计划结果保留 BFS 的搜索穷尽日志；对基线与各变体核对预期 status 和给定计划长度。

这里没有把手写的标准四步直接当成规划器输出。真实返回的动作、完整状态、增加/删除差异和日志均保存于 JSON 中。用户自定义问题仍进行计划前置、效果和目标核验，但不强制它满足标准九例的预期结果；示例专用状态不变量会作为诊断信息保留。

## 5. 窄门的后验检查做了多少工作？

在有 `move` 的已找到候选计划中，脚本独立比较“声明的门净宽 ≥ 声明的机器人身体宽度”，机器人宽 0.60 m，额外裕量 0。标准案例门宽 0.90 m，该数值条件成立；窄门案例 0.50 m，该数值条件不成立。

这是**单个声明尺寸条件**。它没有检查门扇扫掠、进门姿态、障碍、机器人旋转、动力学、机械臂关节或接触。`geometry_check.passes=true` 只代表这项不等式成立；`false` 只拒绝当前声明尺寸下的过门候选。`execution_status` 始终保留 `not_run`。

没有符号候选时，不进入候选的后验门宽检查；零步计划不包含过门，也不进行宽度检查。自定义 PDDL 文件没有独立尺寸输入，`geometry_check.checked=false`、`passes=null`，不会假定用户的门或机器人尺寸。

## 6. 原 MiniLab 的九个输入怎样比较？

原 `upstream_validate.analyze(world)` 是规则检查函数。它判断房间、门宽、连通、锁与钥匙、能力等声明是否满足自身检查规则，没有生成动作序列，也没有修改输入世界。以下结果及未修改输入的验证均有 [实际 JSON 记录](../../data/day-03-results.json)。

| case ID / 可编辑输入 | 主要改变 | 实际 status |
|---|---|---|
| [baseline](worlds/baseline.json) | 原基线，门未锁、0.90 m，机器人 0.60 m，有 move/grasp | `rule_feasible` |
| [locked_missing_key_and_skill](worlds/locked_missing_key_and_skill.json) | 门设 locked=true、对应钥匙 K；机器人缺钥匙和 unlock | `blocked_state` |
| [key_without_unlock_skill](worlds/key_without_unlock_skill.json) | 锁门例只补钥匙 K | `blocked_state` |
| [unlock_skill_without_key](worlds/unlock_skill_without_key.json) | 锁门例只补 unlock 能力 | `blocked_state` |
| [key_and_unlock_skill](worlds/key_and_unlock_skill.json) | 锁门例同时具有钥匙 K 和 unlock | `rule_feasible` |
| [no_grasp](worlds/no_grasp.json) | 未锁门基线只删除 grasp 能力 | `blocked_action` |
| [ungraspable_object](worlds/ungraspable_object.json) | 未锁门基线只设物体 graspable=false | `blocked_action` |
| [narrow_door](worlds/narrow_door.json) | 未锁门基线只把门宽改为 0.50 m | `blocked_geometry` |
| [narrow_and_locked](worlds/narrow_and_locked.json) | 窄门同时上锁，缺钥匙和 unlock | `blocked_geometry` |

需要结合原代码理解三处容易误读的地方：

1. **`rule_feasible` 没有实际解锁。** 原函数认为满足钥匙和技能规则的锁门可用，但输出前后输入中的 `locked` 都没有改变。它也没有显式 `open` 状态。
2. **状态标签是该 checker 的分类。** 缺 unlock 能力进入 `blocked_state`；缺 grasp 能力进入 `blocked_action`。这不是一种放之四海而皆准的失败归属。
3. **原 reason 和分支有局限。** 锁门例原文可能是 `narrow doors: locked doors: D`，其 `narrow doors:` 是多余前缀，本例门宽实际为 0.90 m。窄门与锁门并存时，程序先处理窄门并跳过这扇门后续锁检查，返回值没有枚举全部障碍。修复宽度之后仍需重新检查锁与能力。

以上输出保留原文，没有为让分类看起来整齐而修改上游程序。可视化解释应与原 `raw_result`、输入和执行路径一起看。

## 7. 自己改变一个条件

先复制一个输入，写下预测，再修改副本。下面的命令只运行给定文件，输出到自己的记录；JSON world 使用原 checker，PDDL problem 使用本目录的动作域。

```bash
python3 examples/day-03/run_examples.py --world examples/day-03/worlds/key_without_unlock_skill.json --output my-day-03-one-world.json
python3 examples/day-03/run_examples.py --problem examples/day-03/pddl/problem-missing-open.pddl --output my-day-03-one-problem.json
```

例如，复制 `key_without_unlock_skill.json` 后只在 `robot.capabilities` 中加入 `unlock`；或者复制 `problem-missing-open.pddl` 后只向 `:init` 加入 `(can-open r)`。运行前先说明预期哪个动作会从不可用变为可用；运行后比较完整状态和输出原因。自定义输入没有预设必须通过的 status，避免把自己的预测误当作实际结果。

`--world`、`--problem` 与 `--only-minilab` 是互斥模式。自定义 PDDL 仍需要符合给定 Domain 的对象类型和谓词；这不是任意 PDDL 扩展、任意机器人或任意 JSON 模式的通用验证接口。

## 8. 怎样读 JSON 证据？

| 字段 | 含义 |
|---|---|
| `environment` | 实际 Python / Pyperplan 版本、平台、UTC 生成时间。 |
| `provenance` | 原计划版本、原 checker 哈希、官方规划器、搜索设置、耗时范围与证据边界。 |
| `planning_cases[].initial_facts / goal` | 完整初态与目标，采用 `(at r a)` 形式。 |
| `planning_cases[].plan` | 实际动作原文 `raw`、`name/args`、完整 `pre/add/del` 和内部落地前置。 |
| `planning_cases[].states / trace` | 初态加每一步后完整状态；各步真正增加、删除的事实。 |
| `planning_cases[].search_log / search_exhausted` | 官方 BFS 日志与有限搜索是否穷尽。 |
| `planning_cases[].geometry_check` | 独立尺寸输入、是否检查、结果与范围；没有检查时 passes 为 null。 |
| `minilab_cases[].input / raw_result` | 传给原 checker 的输入与原始返回值。 |
| `minilab_cases[].input_unchanged` | 调用前后世界声明相同，说明规则检查没有执行动作更新。 |
| `elapsed_ms` | PDDL 中仅计 BFS 调用；MiniLab 中仅计 analyze 调用。解析和落地另记 `parse_ground_ms`。 |
| `execution_status` | `not_run` 指没有机器人或物理仿真执行，不能把程序输出升级为物理完成记录。 |

网页中的浏览器演示是明确受限的教学引擎，完整 PDDL 解析与官方搜索证据在这些 Python 实验里。两个实现可以相互核对当前案例的事实和结果；这样的对照没有把浏览器组件升级成通用 PDDL 解释器。网页的空间组件另有理想平面 2R 解析逆运动学与给定路径的解析碰撞计算，它们不是这些 Python 记录中的已运行项目，也没有产生真实机器人执行日志。

个人的学习时间、首次答案、掌握情况与本机实际运行结果请自行记录。现成案例用于理解和复现，不能替代自己的实验说明。
