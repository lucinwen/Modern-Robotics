# Modern Robotics · 可视化学习手记

面向初学者的中文学习笔记。先通过交互观察空间变化，再解释概念、公式与适用条件。

目前包含 **Day 1–14** 十四篇连续教程，全部对齐 `14plan` 对应日的任务手册；另有独立的 [路线总览](start.html)（14 天怎么排、前置关系、参考时长）和 [术语表](glossary.html)（80 个词的一句话解释，可搜索）。基础链为 Day 1 空间与五层合法性 → Day 2 约束与 Z3 → Day 3 任务规划与 TAMP；身体与系统链为 **Day 4 运动学（FK/IK/Jacobian）** → **Day 5 ROS2 / TF / Nav2 接口** → **Day 6 UE → Isaac Sim / Isaac Lab 训练环境**；策略与文献链为 **Day 7 BC / RL / Diffusion Policy / VLA** → **Day 8 MANSION / SceneWeaver / Holodeck 方法对照**；交互与感知链为 **Day 9 可打断语音会话** → **Day 10 3DGS / FLAME / SMPL-X 数字人**；传感与部署链为 **Day 11 FMCW 毫米波与微动感知** → **Day 12 SAR 与多源融合** → **Day 13 OpenXR / WebRTC / 触觉安全**；最后一篇 **Day 14 模拟面试与证据核验** 把前 13 天收成一套可被追问的答法。

## 打开教程

- **先看路线**：[路线总览 start.html](start.html)（14 天地图、三种读法、数学底线）· [术语表 glossary.html](glossary.html)（80 个词速查）。
- **Day 1**：[index.html](index.html) · **Day 2**：[day-02.html](day-02.html) · **Day 3**：[day-03.html](day-03.html) · **Day 4**：[day-04.html](day-04.html) · **Day 5**：[day-05.html](day-05.html) · **Day 6**：[day-06.html](day-06.html) · **Day 7**：[day-07.html](day-07.html) · **Day 8**：[day-08.html](day-08.html) · **Day 9**：[day-09.html](day-09.html) · **Day 10**：[day-10.html](day-10.html) · **Day 11**：[day-11.html](day-11.html) · **Day 12**：[day-12.html](day-12.html) · **Day 13**：[day-13.html](day-13.html) · **Day 14**：[day-14.html](day-14.html)。下载并解压完整仓库后，直接用浏览器打开对应文件；网页交互无须安装依赖。GitHub 文件页显示源码，要操作可视化请打开本地网页，或启用下述 Pages。
- **在线地址（GitHub Pages，已发布）**：<https://lucinwen.github.io/Modern-Robotics/>。推送到 `main` 后会自动重新发布，不需要再改设置。
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
- [14plan Day 1 任务手册](https://github.com/lucinwen/14plan/blob/de6fd9cb352370863e94d64d775c4f5236ed38fc/TASK_GUIDES/day-01.md) 与 [MiniLab](https://github.com/lucinwen/14plan/blob/de6fd9cb352370863e94d64d775c4f5236ed38fc/minilab/validate.py)。
- [Z3Py 官方入门](https://github.com/microsoft/z3guide/blob/main/website/docs-programming/02%20-%20Z3%20Python/01%20-%20Introduction.md) 与 [Programming Z3](https://z3prover.github.io/papers/programmingz3.html)：Day 2 约束、作用域、核心和优化的依据。
- [Helmert · An Introduction to PDDL](https://www.cs.toronto.edu/~sheila/2542/w09/A1/introtopddl2.pdf)：Day 3 对象、初态、目标、前置与效果的原始讲义依据。
- [MIT Fall 2022 官方课表](https://manipulation.csail.mit.edu/Fall2022/schedule.html)、[Programming the Task Level 所在章节](https://manipulation.mit.edu/clutter.html) 与 [Motion Planning](https://manipulation.mit.edu/trajectories.html)：FSM、任务规划、IK、轨迹和检查边界。
- [Integrated Task and Motion Planning](https://arxiv.org/abs/2010.01083)：离散动作和连续参数耦合的作者综述。
- [Pyperplan 官方代码](https://github.com/aibasel/pyperplan)：Day 3 的实际 PDDL 解析与搜索实现。

Day 1 依据官方转写与讲义整理，使用右手系、米、列向量；`T_world_camera` 将相机坐标表达为世界坐标。Day 2 依据 Z3 官方文档与计划任务整理，分别标注整数／实数、米／厘米和各演示的模型条件。

Day 3 已核对指定讲次与 MIT 2022 课表，未取得本轮 B 站整段视频或字幕，因此使用官方文字资料、原始规划讲义和实际程序完成讲解，不编造完整观看记录或逐秒视频索引。持续更新的 MIT 在线讲义用来核对原理，不当作 2022 讲座的逐字转写；详细阅读顺序见 [Day 3 课程对应表](notes/day-03-course-map.md)。

## 维护与扩展

这是一个无第三方浏览器运行时依赖的静态网站。Python 构建脚本把本地组件和预运行数据嵌入十篇网页；编译后的 `index.html`、`day-02.html` 与 `day-03.html` 一同提交，因此在线与离线阅读都不需要构建。主动复现 Python / Z3 / PDDL 实验时，才需安装各自的单独依赖。

| 路径 | 用途 |
|---|---|
| `src/*.template.html` | 十篇教程正文与组件位置 |
| `components/` | 知识可视化、阶段练习区与 14 天导航组件 |
| `assets/` | 主题、交互、几何计算与图形样式 |
| `notes/` | 可直接在 GitHub 阅读的中文 Markdown 笔记 |
| `scripts/build.py` | 构建十篇网页，并安全内嵌 Day 2 / Day 3 运行 JSON |
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


## Day 4 · 机械臂够得到吗：FK / IK / Jacobian

平面二连杆把五个概念一次讲透：正运动学（改角度看末端）、可达环与两组逆解、关节限位（可达但不可执行）、雅可比与速度椭圆、奇异位形（|J| = 0）。数值校核覆盖 `(1,1)` 有解与 `(3,0)` 无解，并配有四条失败链（逆解无解 / 超限位 / 路径碰撞 / 控制跟不上）与责任链。

- 网页：[day-04.html](day-04.html)

## Day 5 · 一条“去 B 房间”的消息链：ROS2 / TF / Nav2

Topic / Service / Action 的语义选择、八条箭头的消息合同（含义/方向/单位/frame/发布者）、TF 时间戳陈旧、URDF 的职权边界、costmap 膨胀与有效通道、Action 状态机与取消语义、三种故障注入、UE 场景 → 导航接口合同六项。**本页未运行 ROS 2 / Nav2，是概念合同，不是实测记录。**

- 网页：[day-05.html](day-05.html)

## Day 6 · 从可渲染场景到机器人训练环境

Day 6 面向 UE / PCG 已有基础，重点不是安装平台，而是建立可执行的 **robot task contract**。自包含网页包含 **16 个交互学习区**，依次覆盖：三方责任分工（UE / Isaac Sim / Isaac Lab）、渲染几何与物理几何、动力学参数、门 Articulation、Observation 与公平性、时间同步、Action、Reward vs Success、Reset、Seed 划分、**19 项 UE→物理仿真迁移审计（可勾选留痕）**、**三个反例（症状→缺哪个接口→如何独立验证）**、**规则 checker 与物理 rollout 的能力差距**、完整 Episode 时间线、**综合考题六栏答卷与五维自评**、任务合同与 Day 7 交接字段。

- 网页：[day-06.html](day-06.html)

## Day 7 · 环境生成完了，策略从哪来：BC / RL / Diffusion Policy / VLA

把“环境生成系统”和“学习型策略系统”彻底分开：state / observation / action 的差别、MDP 五要素、四方法的五列对照（训练来源 / 条件输入 / 输出 / 控制粒度 / 部署困难）、动作块长度与闭环纠错频率的换算、`observation → policy → action chunk → controller → new observation` 五环接口合同、同一“开门取杯”任务的四条路线、示范数据 schema 与证据字段、两个可证伪反例（换视角 / 块内门关闭）与训练测试分割泄漏自检。

- 网页：[day-07.html](day-07.html)
- **本页没有训练任何模型、没有采集机器人数据、没有跑 rollout**，因此不提供任何成功率数字。

## Day 8 · 同名不同物：MANSION / SceneWeaver / Holodeck 怎么比，以及从语言到资产的链路

把文献阅读变成可辩护的证据：三个工作的输入/中间状态/产物/限制、五维方法矩阵（输入任务 / 空间表示 / 动态状态与交互 / 实验基线 / 已证明范围）、证据四级分类（论文已展示 / 个人已验证 / 纸面设计 / 待查）、两个反例（跨楼层锁门、楼梯净空 0.62 m）、贡献四分类与安全分界、公平基线五个固定量与三层指标、**从语言到可编辑资产的五段链与四道关（结构 / 可解 / 几何后验 / 任务前提）**、**多模型异步任务的四道保护（任务 ID 归属 / 幂等 / 版本比较 / 原子回填）**、BEHAVIOR-1K 为什么是任务基准而不是生成器、90 秒科研叙事、申请材料冻结核验。

- 网页：[day-08.html](day-08.html)

## Day 9 · 打断之后：语音会话的状态一致性

把“让声音停下来”和“让这次回答作废”彻底分开：Mic → VAD → ASR → LLM → TTS → Speaker 六节点合同与首响延迟预算、六个会话状态（LISTENING / RECOGNIZING / THINKING / SPEAKING / CANCELING / CONFIRMING）的合法迁移矩阵、t0–t4 打断时序的逐步责任归属、三条竞态（旧回答晚到 / 二次插话 / TTS 队列仍在播）、`turn_id` 与 `generation_epoch` 组成的四道过期过滤闸门、陪伴机器人报警分级 L0–L3 与三条退出路径、五条“无双重播放”事件日志断言。

- 网页：[day-09.html](day-09.html)
- **本页没有运行任何 ASR / TTS / LLM 服务，没有接入语音设备，没有实机延迟数据**；六状态机是学习用草案，不是任何产品的内部实现。

## Day 10 · 像不像 vs 能不能动：3DGS / FLAME / SMPL-X

把“我做过数字人”拆成四层：表征 / 驱动 / 渲染 / 同步。六种技术各写清“不能自动保证什么”（3DGS、FLAME、SMPL-X、Blendshape、VRM、Live2D）、三种需求到选型的映射、3DGS 的“高斯 → 投影 → alpha 混合”及其覆盖率随数量收敛的演示、FLAME 参数语义的四旋钮示意、音画偏移的计算式 `(viseme + 渲染) − 音频缓冲` 与三条修复路线、三种失配的归因、贡献四格表与安全底线。

- 网页：[day-10.html](day-10.html)
- **本页没有训练 3DGS、没有加载 FLAME / SMPL-X 权重、没有驱动真实数字人**；所有画面是手写二维示意，毫秒数是量级示意而非实测。
- **本页不复述任何论文的具体实验数值**；未核实处一律标“待查”，不替论文补它没写的东西。
- 文字版：[notes/day-06-tutorial.md](notes/day-06-tutorial.md)
- 验证范围：[notes/day-06-validation.md](notes/day-06-validation.md)
- 可复现实验：[examples/day-06/README.md](examples/day-06/README.md)

配套标准库 Python 脚本实际运行 **26 个教学案例、139/139 项检查通过**。这些结果只验证本教程的受限数学/任务合同模型；Isaac Sim、Isaac Lab、ROS 与实体机器人执行均明确标记为未运行。

## Day 11 · 一段 chirp 里能读出什么：FMCW 毫米波与微动感知

把“毫米波能测呼吸”这句话拆成一条可以逐级验算的链：**上电 / 配置 → chirp → 混频 → 中频拍频 → 距离 FFT → 相位 → 解缠 → 微动 → 质量门 → 报警**。10 个交互区依次是：链路与每段产物、TX/RX 时频图与 `f_b = S·τ`、距离 FFT 与 `δR = c/2B` 分辨单元、相位对 λ/4 的敏感性（位移 / 解缠 / 缠绕三联图）、距离-多普勒热图（坐 / 走 / 人群三场景）、四类合成信号的周期估计与误差（干净 / 阶跃 / 拍频）、安装条件四维质量门（人数 / 信噪比 / 幅度 / 朝向）、七步报警决策链与可追溯日志、综合考题六栏答卷、五维自评。

- 网页：[day-11.html](day-11.html)
- **本页没有雷达硬件、没有采集任何真实中频数据**；波形与热图是手写数值模型，毫秒与 dB 都是量级示意。
- **本页不提供任何医疗结论**：微动信号不等于呼吸率诊断，页面里所有“报警”都只是工程分级，不是医学判断。

## Day 12 · 图上那栋楼为什么“倒”了：SAR 与多源融合

把“多源融合”从口号变成可检验的流程：**平台与尺度 → 合成孔径 → 侧视几何 → 叠掩 / 透视收缩 / 阴影 → 时序与容差门 → 证据分级 → 分支处置 → 独立性投票**。10 个交互区：任务到来源的适配表、`L_max ≈ λR/D` 与 `δa ≈ D/2`（注意 R 被消掉）、入射角滑块的楼体剖面与 `h·cotθ` / `h·tanθ`、三种几何畸变的成因与误读、云 / 地理定位 / 时间窗三条件门、四字段证据体的 JSON 与审计等级、五类异常分支的处置、共享上游导致的“伪独立票”、综合考题、五维自评。

- 网页：[day-12.html](day-12.html)
- **本页没有下载或处理任何真实 SAR 影像**，没有跑配准，也没有做正射纠正；所有分辨率与位移都是公式算出来的量级。
- 自评里“实验验证”给 0 分是刻意的：想拿分就必须自己去叠一对 Sentinel-1 GRD 与同日光学影像，并量出残差。

## Day 13 · 两个人的手在同一个位置吗：OpenXR / WebRTC / 触觉安全

把“远程共处”拆成三件事：**坐标、传输、安全**。10 个交互区：LOCAL → VIEW → STAGE 的坐标链与“直接相减”错在哪、四个参考空间的适用条件、网络与参考空间两组开关的四种组合症状、RTT / 抖动 / 丢包合成“姿态年龄”并换算成外推误差与触觉禁用阈值、锚点漂移速率与重对齐触发、姿态消息必填字段的缺字段检查、请求 → 授权 → 撤销 → 断线的触觉状态机与日志、三类故障的归因表、综合考题、五维自评。

- 网页：[day-13.html](day-13.html)
- **本页没有启动 XR 运行时、没有建立 WebRTC 连接、没有驱动任何触觉设备**；时延与误差是公式推的量级，不是实测。
- 触觉部分只给**责任顺序**（先撤销授权再断电、断线即冻结），不提供任何硬件接线或驱动代码。

## Day 14 · 把前 13 天收成一套答法：模拟面试与证据核验

这一页不教新知识，只做三件事：**把话说准、把时间排对、把材料备齐**。10 个交互区：真实性卡片十个字段的归属标签（本人实做 / 团队成果 / 开源 / 未来计划 / 待核实）、六条典型断言 × 四级证据的“可原样写 / 加限定 / 改写删掉”判定、90 秒 / 3 分钟 / 5 分钟三档自介的四段式分配与超时切割、两轮 45 分钟的时间盒与“超时从最后往前扣”、三层技术主线与项目归属、四层追问链（做了什么 → 为什么 → 有别的方案吗 → 失败了呢）与可信度计量、四页展示包的来源分层与保密红线、面试前八项清单、综合考题六栏答卷、五维自评。

- 网页：[day-14.html](day-14.html)
- **本页没有替你写简历或编经历**：所有字段与断言都是模板，需要你自己填真实的证据层级。
- 页面里的“可信度”是教学用的记账模型，不是任何机构的评分标准。
