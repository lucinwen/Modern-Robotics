# Modern Robotics · 可视化学习手记

面向初学者的中文学习笔记。先通过交互观察空间变化，再解释概念、公式与适用条件。

目前包含 [14plan 的 Day 1](https://github.com/venividici/14plan/blob/main/DAILY/day-01.md) 与 [Day 2](https://github.com/venividici/14plan/blob/main/DAILY/day-02.md)。Day 1 从刚体与坐标变换建立空间直觉；Day 2 把空间要求写成 Z3 / SMT 约束，解释可满足性、冲突与验证。

## 打开教程

- **Day 1 网页**：[index.html](index.html) · **Day 2 网页**：[day-02.html](day-02.html)。下载并解压完整仓库后，直接用浏览器打开对应文件；网页交互无须安装依赖。
- GitHub Pages 预定地址：<https://venividici.github.io/-Modern-Robotics/>。需要在仓库 **Settings → Pages** 选择 **Deploy from a branch → main → /(root)** 并保存后才会发布。
- **完整文字版**：[Day 01 教程](notes/day-01-tutorial.md) · [Day 02 教程](notes/day-02-tutorial.md)。
- 课程对应表：[Day 01](notes/day-01-course-map.md) · [Day 02](notes/day-02-course-map.md)。
- 配套材料：[2.1 刚体自由度专题](notes/day-01-2-1-rigid-body-dof.md) · [Day 2 Python / Z3 实验](examples/day-02/README.md)。

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

## 使用方式

1. 按目录学习一节，先猜滑条改变后会发生什么。
2. 每次只改一个参数，观察图和数值如何联动。
3. 用自己的话解释，再打开折叠参考说明。
4. 回到原视频复听对应部分，或继续原计划的实际练习。

页面末尾的个人笔记只保存在当前浏览器，支持导出 `.md`；不会自动上传 GitHub。页面本身不标记用户已掌握，也不把 AI 整理的示例当成用户完成的实验。

Day 1 与 Day 2 的个人笔记使用不同存储键和导出文件名；可以通过页侧的学习日导航来回切换。

## 来源与约定

- [Modern Robotics 官方视频转写](https://modernrobotics.northwestern.edu/nu-gm-book-resource/)：Day 1 的 P4 / P9 / P10 / P11 / P12 / P16，合计 22 分 35 秒。
- [Modern Robotics 原书](https://hades.mech.northwestern.edu/images/2/25/MR-v2.pdf)：§2.1、§2.5 与第 3 章相关内容。
- [MIT Robotic Manipulation · Geometric Pose Estimation](https://manipulation.mit.edu/pose.html)：相机、点云、遮挡、位姿估计与配准选读。
- [14plan Day 1 任务手册](https://github.com/venividici/14plan/blob/de6fd9cb352370863e94d64d775c4f5236ed38fc/TASK_GUIDES/day-01.md) 与 [MiniLab](https://github.com/venividici/14plan/blob/de6fd9cb352370863e94d64d775c4f5236ed38fc/minilab/validate.py)。
- [Z3Py 官方入门](https://github.com/microsoft/z3guide/blob/main/website/docs-programming/02%20-%20Z3%20Python/01%20-%20Introduction.md) 与 [Programming Z3](https://z3prover.github.io/papers/programmingz3.html)：Day 2 约束、作用域、核心和优化的依据。

Day 1 依据官方转写与讲义整理，使用右手系、米、列向量；`T_world_camera` 将相机坐标表达为世界坐标。Day 2 依据 Z3 官方文档与计划任务整理，分别标注整数／实数、米／厘米和各演示的模型条件。

## 维护与扩展

这是一个无第三方浏览器运行时依赖的静态网站。Python 构建脚本把本地组件和预运行数据嵌入两篇网页；编译后的 `index.html` 与 `day-02.html` 一同提交，因此在线与离线阅读都不需要构建。主动复现 Python / Z3 实验时，才需安装其单独依赖。

| 路径 | 用途 |
|---|---|
| `src/*.template.html` | 两篇教程正文与组件位置 |
| `components/` | 18 个交互演示的标记 |
| `assets/` | 主题、交互、几何计算与图形样式 |
| `notes/` | 可直接在 GitHub 阅读的中文 Markdown 笔记 |
| `scripts/build.py` | 构建两篇网页，并安全内嵌 Day 2 运行 JSON |
| `scripts/validate.py` | 检查构建一致性、链接、ID、依赖和语法 |
| `tests/` | 坐标、几何、区间与逻辑边界检查 |
| `examples/day-02/` | 可复现的真实 Z3 教学实验 |
| `data/day-02-z3-results.json` | 制作环境的一次真实输出记录 |

修改正文或组件后，在仓库根目录执行：

```bash
python3 scripts/build.py
python3 scripts/validate.py
node tests/frames-math.test.cjs
node tests/day2-geometry.test.cjs
node tests/day2-logic.test.cjs
```

修改正文后同步相应完整文字版。新增课程时保留现有笔记与锚点；每篇写明原课程、核心问题、交互模型的条件和练习，不自动填写个人完成状态或学习体会。

## 验证范围

本版执行了静态结构、资源与链接、JS 语法及纯数学检查。坐标模块核对正交性、90° 旋转、正逆恢复和变换链；房间规则与原 Python MiniLab 对照；点云使用合成真值检查误差守恒。

Day 2 的几何与区间检查覆盖贴边、碰角、缝隙、门洞端点、双侧余量、完整作用域撤回、核心与有限候选边界；真实 Z3 实验则独立核对模型满足性、核心不可满足性及所列扩展示例。

本次新网站尚未进行浏览器端的整页视觉与交互实测。原对话中的三个自由度演示曾单独检查过，但这不替代新页面的整体浏览器测试。
