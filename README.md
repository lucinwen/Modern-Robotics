# Modern Robotics · 可视化学习手记

面向初学者的中文学习笔记。先通过交互观察空间变化，再解释概念、公式与适用条件。

目前包含 **Day 1 / 2 / 3 / 6** 四篇连续教程，全部对齐 `14plan` 对应日的任务手册。Day 1–3 是空间、约束与任务规划的基础链；**Day 6 · 从可渲染场景到机器人训练环境** 聚焦 UE → Isaac Sim / Isaac Lab：三方责任分工、尺度、碰撞、质量、关节、传感、动作、奖励、终止、reset、seed、迁移审计与评测证据。

## 打开教程

- **Day 1 网页**：[index.html](index.html) · **Day 2 网页**：[day-02.html](day-02.html) · **Day 3 网页**：[day-03.html](day-03.html) · **Day 6 网页**：[day-06.html](day-06.html)。下载并解压完整仓库后，直接用浏览器打开对应文件；网页交互无须安装依赖。GitHub 文件页显示源码，要操作可视化请打开本地网页，或启用下述 Pages。
- **在线地址（GitHub Pages，已发布）**：<https://venividici.github.io/Modern-Robotics/>。推送到 `main` 后会自动重新发布，不需要再改设置。
- 本地预览（推荐，交互最稳）：在仓库根目录执行 `python -m http.server 8000`，浏览器打开 <http://localhost:8000>。
- **完整文字版**：[Day 01 教程](notes/day-01-tutorial.md) · [Day 02 教程](notes/day-02-tutorial.md) · [Day 03 教程](notes/day-03-tutorial.md) · [Day 06 教程](notes/day-06-tutorial.md)。
- 课程对应表：[Day 01](notes/day-01-course-map.md) · [Day 02](notes/day-02-course-map.md) · [Day 03](notes/day-03-course-map.md)。
- 配套材料：[2.1 刚体自由度专题](notes/day-01-2-1-rigid-body-dof.md) · [Day 2 Python / Z3 实验](examples/day-02/README.md) · [Day 3 PDDL / MiniLab 实验](examples/day-03/README.md)。

## Day 1 · 看懂空间与运动

| 章节 | 学习内容 | 交互演示 |
|---|---|---|
| 01 | 刚体、构型与自由度 | 书平放 / 拿到空中 / 铰链门；A、B、C 三点 |
| 02 | 构型空间、任务空间、工作空间 | 两关节机械臂与环面；可达域与末端朝向 |
| 03 | 世界系、物体系、右手系与旋转矩阵 | 三根物体坐标轴与 R 的三列联动 |
| 04 | 主动旋转与被动换坐标 | 同一个角度下“点动”与“坐标轴动”的对照 |
| 05 | 齐次变换、逆变换与坐标链 | 相机 → 世界；相机 → 底座 → 世界 |
| 06 | 相机点云与坐标配准 | 合成杯子点云、外参误差、噪声与遮挡 |
| 07 | 拓扑、度量几何与分层检查 | 门宽、房间缝隙 / 重叠、门锁与机器人能力 |
| 08 | 预测、解释与复习 | 开放练习、折叠核对、个人笔记导出 |

共 9 个可交互演示。它们是教学模型，明确区分静态几何、受限规则和仍未验证的运动 / 物理执行。

## Day 2 · 看懂约束与求解

Day 2 指定资源为微软 Z3 官方文档，约 105 分钟定向阅读，无必修视频配额。教程按“数轴 → 房间 → 门接面 → 求解状态 → 冲突诊断 → 亲手实验”组织，保留原计划的七段、10 小时有效学习安排。

| 章节 | 要理解的内容 | 可视化 |
|---|---|---|
| 01 | 变量、Bool / Int / Real、模型、SAT 与 SMT | 实数区间与整数取值 |
| 02 | 完整边界、四向非重叠析取 | 当前矩形位置与 Or / And 对照 |
| 03 | 可行见证与全局不可满足 | 两个 2×2 房间，宽 4 / 宽 3 的对照 |
| 04 | 共墙、门开口区间、每侧余量、平台高度 | 门接面交互及楼梯平台图 |
| 05 | sat / unsat / unknown 与独立检查 | 四种实际记录对应的后续流程 |
| 06 | push / pop、assumptions 与断言作用域 | 可操作的临时约束栈 |
| 07 | 跟踪标签、核心粒度、核心非唯一 | 两组独立冲突与候选核心 |
| 08 | 硬约束、优化目标与允许的退让 | 有限候选门宽的筛选与排序 |
| 09–10 | 六例预测、真实结果、复现与记录 | 六例模型 / 核心 / 耗时查看器 |

Day 2 共 9 个可视化。数轴、房间、核心和偏好组件使用明确限定的解析公式或有限枚举；实际 Z3 输出来自配套 Python 脚本的预运行记录，浏览器不会把拖动交互伪装成通用 Z3 求解。

### Day 2 已实际运行的教学记录

制作环境为 Python 3.12.14、Z3 5.3.1（z3-solver 5.3.1.0）。[完整 JSON](data/day-02-z3-results.json) 包含六例的输入、类型、公式、模型或核心、耗时和边界；状态为 **sat / sat / sat / unsat / unsat / unsat**。

另有实际 push / pop、assumptions、标签粒度、独立冲突、未跟踪背景、Real 坐标 3×3 对照、Optimize、SAT 后门宽拒绝，以及原 MiniLab 宽 4 / 3 / 5 的对照。非多项式例子本次返回 unknown，原始原因同样为 unknown；记录没有把它改写为超时。

这些是制作教程时的运行，个人本机复现与学习体会另行记录。复现方法见 [实验说明](examples/day-02/README.md)。

## Day 3 · 让机器人一步步拿到杯子

贯穿全篇的任务是：机器人在 A 房间，杯子在 B 房间，中间有一扇锁着的门。教程从中文句子开始，再引入符号、动作、真实搜索与连续空间，保留原计划的七段 10 小时安排。指定资源为 R04 PDDL 阅读与 MIT Fall 2022 Lecture 21 TAMP；R20 是选读。

| 章节 | 要理解的内容 | 可视化与操作 |
|---|---|---|
| 01 | 拓扑、几何、当前状态、动作能力分别回答什么 | 同一场景切换四层信息、窄门与缺技能对照 |
| 02 | 对象、类型、谓词、状态与目标 | 房间图与事实集合联动，比较解锁前后和开门前后 |
| 03 | 前置条件、增加效果、删除效果、保持不变 | 自己按四种动作，逐条检查为什么能做或不能做 |
| 04 | domain、problem、参数与实例化 | 中文含义对照 PDDL；换初态时定位变化的文件 |
| 05 | 计划作为状态搜索，队列与重复状态 | 逐步执行有限 BFS，观察标准任务与缺钥匙的差别 |
| 06 | FSM、规划器与执行反馈的分工 | 发出请求后等待反馈，成功才推进，失败先复核 |
| 07 | 身体净宽、中心位置、全路径检查、IK | 门洞与圆盘、给定折线路径；两杆手臂和两种肘部姿态 |
| 08 | 离散动作与连续可行性的往返 | 缺钥匙、窄门、把手过高；保留失败证据和世界版本 |
| 09 | 搜索计划与受限规则检查的不同结论 | 9 个实际 PDDL 记录、9 个原 MiniLab 记录，可逐步看完整事实 |
| 10 | 自己解释、首次回答与后来修订 | 35 分钟 Checkpoint A、分项自评、个人笔记与 Markdown 导出 |

共 **10 个知识可视化 + 1 个阶段练习区**。每节先给操作问题，再解释符号；自测提示可以折叠，不替学习者填写答案。门已解锁与门已打开分别建模；钥匙表示物品栏持有，不占拿杯子的手。全文明确区分这些教学假设与真实动作所需的观测、运动和执行证据。

### Day 3 已实际运行的教学记录

制作环境为 Python 3.12.14、Pyperplan 2.1。程序实际解析 `.pddl`、实例化动作并执行 BFS，保存输入、动作、完整状态、增删效果、搜索日志和耗时。全部返回动作根据源 PDDL 的完整前置与效果复核。

| 输入变化 | 符号搜索实际结果 | 这说明什么 |
|---|---|---|
| 标准初态 | `plan_found`，4 步 | 解锁 → 开门 → 进入 B → 拿杯 |
| 缺钥匙、缺解锁、缺开门、缺抓取能力、杯不可抓（5 例） | 各为 `no_plan`，长度 `null` | BFS 穷尽当前有限模型；没有编码替代动作或额外来源 |
| 门已经打开 | `plan_found`，2 步 | 从移动与抓取开始 |
| 门宽变为 0.50 m，机器人宽 0.60 m | `plan_found`，4 步；后验净宽检查拒绝 | 所列符号条件成立仍不足以通过身体尺寸检查 |
| 杯子一开始就在手里 | `plan_found`，0 步 | 目标已成立，空计划是成功结果 |

另有 9 个原 MiniLab 检查记录，比较钥匙与解锁能力各自缺失、两者齐全、窄门、缺抓取能力和物体不可抓等输入。保留原始 `reason`、检查顺序与 `input_unchanged` 证据；规则判定不会冒充真实开锁或动作执行。[完整数据](data/day-03-results.json) 与 [复现说明](examples/day-03/README.md) 一同提交。

网页中的 BFS 在本页限定模型内实时计算；门洞、给定线段碰撞和平面两杆 IK 使用标明条件的解析计算。第 09 节则读取制作时保存的实际 Python 输出，操作查看器不会重新启动 Python。完整 TAMP 求解与机器人执行不包含在这些记录中。

## 使用方式

1. 按目录学习一节，先猜滑条改变后会发生什么。
2. 每次只改一个参数，观察图和数值如何联动。
3. 用自己的话解释，再打开折叠参考说明。
4. 回到原视频复听对应部分，或继续原计划的实际练习。

页面末尾的个人笔记只保存在当前浏览器，支持导出 `.md`；不会自动上传 GitHub。页面本身不标记用户已掌握，也不把 AI 整理的示例当成用户完成的实验。

三天的个人笔记使用不同存储键和导出文件名；可以通过页侧的学习日导航来回切换。Day 3 的阶段练习另存首答、修订和自评；计时可以暂停，重置计时保留答案。运行记录旁的预测只在当前页面会话中保留，重要推理可另写进个人笔记或导出练习。

## 来源与约定

- [Modern Robotics 官方视频转写](https://modernrobotics.northwestern.edu/nu-gm-book-resource/)：Day 1 的 P4 / P9 / P10 / P11 / P12 / P16，合计 22 分 35 秒。
- [Modern Robotics 原书](https://hades.mech.northwestern.edu/images/2/25/MR-v2.pdf)：§2.1、§2.5 与第 3 章相关内容。
- [MIT Robotic Manipulation · Geometric Pose Estimation](https://manipulation.mit.edu/pose.html)：相机、点云、遮挡、位姿估计与配准选读。
- [14plan Day 1 任务手册](https://github.com/venividici/14plan/blob/de6fd9cb352370863e94d64d775c4f5236ed38fc/TASK_GUIDES/day-01.md) 与 [MiniLab](https://github.com/venividici/14plan/blob/de6fd9cb352370863e94d64d775c4f5236ed38fc/minilab/validate.py)。
- [Z3Py 官方入门](https://github.com/microsoft/z3guide/blob/main/website/docs-programming/02%20-%20Z3%20Python/01%20-%20Introduction.md) 与 [Programming Z3](https://z3prover.github.io/papers/programmingz3.html)：Day 2 约束、作用域、核心和优化的依据。
- [Helmert · An Introduction to PDDL](https://www.cs.toronto.edu/~sheila/2542/w09/A1/introtopddl2.pdf)：Day 3 对象、初态、目标、前置与效果的原始讲义依据。
- [MIT Fall 2022 官方课表](https://manipulation.csail.mit.edu/Fall2022/schedule.html)、[Programming the Task Level 所在章节](https://manipulation.mit.edu/clutter.html) 与 [Motion Planning](https://manipulation.mit.edu/trajectories.html)：FSM、任务规划、IK、轨迹和检查边界。
- [Integrated Task and Motion Planning](https://arxiv.org/abs/2010.01083)：离散动作和连续参数耦合的作者综述。
- [Pyperplan 官方代码](https://github.com/aibasel/pyperplan)：Day 3 的实际 PDDL 解析与搜索实现。

Day 1 依据官方转写与讲义整理，使用右手系、米、列向量；`T_world_camera` 将相机坐标表达为世界坐标。Day 2 依据 Z3 官方文档与计划任务整理，分别标注整数／实数、米／厘米和各演示的模型条件。

Day 3 已核对指定讲次与 MIT 2022 课表，未取得本轮 B 站整段视频或字幕，因此使用官方文字资料、原始规划讲义和实际程序完成讲解，不编造完整观看记录或逐秒视频索引。持续更新的 MIT 在线讲义用来核对原理，不当作 2022 讲座的逐字转写；详细阅读顺序见 [Day 3 课程对应表](notes/day-03-course-map.md)。

## 维护与扩展

这是一个无第三方浏览器运行时依赖的静态网站。Python 构建脚本把本地组件和预运行数据嵌入四篇网页；编译后的 `index.html`、`day-02.html` 与 `day-03.html` 一同提交，因此在线与离线阅读都不需要构建。主动复现 Python / Z3 / PDDL 实验时，才需安装各自的单独依赖。

| 路径 | 用途 |
|---|---|
| `src/*.template.html` | 四篇教程正文与组件位置 |
| `components/` | 知识可视化、阶段练习区与 14 天导航组件 |
| `assets/` | 主题、交互、几何计算与图形样式 |
| `notes/` | 可直接在 GitHub 阅读的中文 Markdown 笔记 |
| `scripts/build.py` | 构建四篇网页，并安全内嵌 Day 2 / Day 3 运行 JSON |
| `scripts/validate.py` | 检查构建一致性、链接、ID、依赖和语法 |
| `tests/` | 坐标、几何、区间与逻辑边界检查 |
| `examples/day-02/` | 可复现的真实 Z3 教学实验 |
| `data/day-02-z3-results.json` | 制作环境的一次真实输出记录 |
| `examples/day-03/` | PDDL 动作域、9 个问题、原 MiniLab 与可编辑世界输入 |
| `data/day-03-results.json` | 9 个 PDDL 与 9 个原 MiniLab 的真实输出 |

修改正文或组件后，在仓库根目录执行：

```bash
python3 scripts/build.py
python3 scripts/validate.py
node tests/frames-math.test.cjs
node tests/day2-geometry.test.cjs
node tests/day2-logic.test.cjs
node tests/day3-symbolic.test.cjs
node tests/day3-geometry.test.cjs
```

修改正文后同步相应完整文字版。新增课程时保留现有笔记与锚点；每篇写明原课程、核心问题、交互模型的条件和练习，不自动填写个人完成状态或学习体会。

## 验证范围

本版执行了静态结构、资源与链接、JS 语法及纯数学检查。坐标模块核对正交性、90° 旋转、正逆恢复和变换链；房间规则与原 Python MiniLab 对照；点云使用合成真值检查误差守恒。

Day 2 的几何与区间检查覆盖贴边、碰角、缝隙、门洞端点、双侧余量、完整作用域撤回、核心与有限候选边界；真实 Z3 实验则独立核对模型满足性、核心不可满足性及所列扩展示例。

Day 3 的 173 项符号检查包括状态不变量、失败动作不变更状态、去重与最少步数，并逐例对照全部 9 个 PDDL 实际记录的完整前置、效果和状态。93 项几何检查覆盖门宽与中心偏移、给定折线最小距离、两支 IK 正向恢复、边界和世界版本反馈。记录查看器还核对 18 条记录的 schema、零步与无计划、原始结果和错误数据拒绝。

目前尚未完成三篇网页在浏览器中的整页视觉与交互实测。原对话中的三个自由度演示曾单独检查过，但这不替代新页面的整体浏览器测试。


## Day 6 · 从可渲染场景到机器人训练环境

Day 6 面向 UE / PCG 已有基础，重点不是安装平台，而是建立可执行的 **robot task contract**。自包含网页包含 **16 个交互学习区**，依次覆盖：三方责任分工（UE / Isaac Sim / Isaac Lab）、渲染几何与物理几何、动力学参数、门 Articulation、Observation 与公平性、时间同步、Action、Reward vs Success、Reset、Seed 划分、**19 项 UE→物理仿真迁移审计（可勾选留痕）**、**三个反例（症状→缺哪个接口→如何独立验证）**、**规则 checker 与物理 rollout 的能力差距**、完整 Episode 时间线、**综合考题六栏答卷与五维自评**、任务合同与 Day 7 交接字段。

- 网页：[day-06.html](day-06.html)
- 文字版：[notes/day-06-tutorial.md](notes/day-06-tutorial.md)
- 验证范围：[notes/day-06-validation.md](notes/day-06-validation.md)
- 可复现实验：[examples/day-06/README.md](examples/day-06/README.md)

配套标准库 Python 脚本实际运行 **26 个教学案例、139/139 项检查通过**。这些结果只验证本教程的受限数学/任务合同模型；Isaac Sim、Isaac Lab、ROS 与实体机器人执行均明确标记为未运行。
