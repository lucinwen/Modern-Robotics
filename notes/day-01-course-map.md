# Day 01 · 课程地图：从空间直觉走到坐标计算

学习日期：2026-10-20。本文对应 [14plan 的 Day 01](https://github.com/venividici/14plan/blob/de6fd9cb352370863e94d64d775c4f5236ed38fc/DAILY/day-01.md) 与 [R01 精确分 P 清单](https://github.com/venividici/14plan/blob/de6fd9cb352370863e94d64d775c4f5236ed38fc/STUDY_GUIDES/R01.md)。这是一份辅助理解的教程地图，不代表已经完成个人学习或实测。

本教程以官方视频文字转写和官方在线讲义为依据，重新组织解释并制作交互示意；不声称已经完整播放、观看或逐帧解析 B 站原片。原视频保留为回看入口。不同年份的 MIT 视频目录不可互换。

[打开完整可视化教程](../index.html) · [阅读完整文字版教程](day-01-tutorial.md)

## 1. 今天究竟要读哪些课程？

六段 Modern Robotics 原视频合计 **22 分 35 秒**。需要暂停、画图和试算，原计划为 R01 安排的约 65 分钟包含这些练习时间。

| 顺序 | 原视频与时长 | 对应官方转写 | 用新手语言提出问题 | 在教程里观察什么 |
|---|---|---|---|---|
| 1 | [P4 · 2.1 刚体的自由度](https://www.bilibili.com/video/BV1KV411Z7sC/?p=4) · 05:16 | [Degrees of Freedom of a Rigid Body](https://modernrobotics.northwestern.edu/nu-gm-book-resource/2-1-degrees-of-freedom-of-a-rigid-body/) | 描述一本书怎么摆，需要几个独立的数？ | 桌面 3、空间 6、铰链 1；三个不共线点的 3 + 2 + 1；所有摆法的集合。 |
| 2 | [P9 · 2.5 任务空间与工作空间](https://www.bilibili.com/video/BV1KV411Z7sC/?p=9) · 01:36 | [Task Space and Workspace](https://modernrobotics.northwestern.edu/nu-gm-book-resource/2-5-task-space-and-workspace/) | 任务需要描述什么？这台机械臂实际能到哪里？ | 移动目标点，区分目标位置可达、当前末端已到位、附加朝向要求可满足。 |
| 3 | [P10 · 刚体运动简介](https://www.bilibili.com/video/BV1KV411Z7sC/?p=10) · 02:11 | [Introduction to Rigid-Body Motions](https://modernrobotics.northwestern.edu/nu-gm-book-resource/introduction-to-rigid-body-motions/) | 同一个点，为什么有世界坐标和相机坐标两种写法？ | 原点、三根坐标轴、空间参考系与物体参考系、右手规则。 |
| 4 | [P11 · 3.2.1 旋转矩阵上](https://www.bilibili.com/video/BV1KV411Z7sC/?p=11) · 02:54 | [Rotation Matrices · Part 1](https://modernrobotics.northwestern.edu/nu-gm-book-resource/3-2-1-rotation-matrices-part-1-of-2/) | 九个数字为什么可以表示三根坐标轴的朝向？ | 旋转矩阵的每一列对应一根单位轴；轴长为 1、彼此垂直。 |
| 5 | [P12 · 3.2.1 旋转矩阵下](https://www.bilibili.com/video/BV1KV411Z7sC/?p=12) · 04:15 | [Rotation Matrices · Part 2](https://modernrobotics.northwestern.edu/nu-gm-book-resource/3-2-1-rotation-matrices-part-2-of-2/) | 点真的转了，和同一点换一把“坐标尺”，有什么区别？ | 固定坐标系转动点；固定真实点改变坐标表达；变换方向与逆变换。 |
| 6 | [P16 · 3.3.1 齐次变换矩阵](https://www.bilibili.com/video/BV1KV411Z7sC/?p=16) · 06:23 | [Homogeneous Transformation Matrices](https://modernrobotics.northwestern.edu/nu-gm-book-resource/3-3-1-homogeneous-transformation-matrices/) | 怎样把旋转和平移一起记录，还能沿坐标链传递？ | 先旋转、后加平移；4 × 4 矩阵；逆变换；world ← base ← camera。 |

章节编号沿用该 B 站合集与仓库清单；P10 在作者网站中的标题是第 3 章刚体运动导入。

## 2. MIT 部分是定向阅读

按 [R16 子教程](https://github.com/venividici/14plan/blob/de6fd9cb352370863e94d64d775c4f5236ed38fc/STUDY_GUIDES/R16.md)，Day 01 优先阅读 [MIT 官方第 4 章 Geometric Pose Estimation](https://manipulation.mit.edu/pose.html) 的以下内容，约 30–40 分钟：

1. **Cameras and depth sensors / Simulating an RGB-D camera**：相机给出了什么测量？颜色图像、深度图和三维点各自是什么？
2. **Sensor noise and depth dropouts / Occlusions and partial views**：看不到的部分为什么不能当作不存在？
3. **Representations for geometry**：点云是一组带坐标的采样点；必须说明这些坐标属于哪个参考系。
4. **Point cloud registration with known correspondences** 的开头：模型点与测量点怎样用刚体变换放进同一参考系？先理解问题，不要求今天推导最小二乘或奇异值分解。

2022 合集的 [P5 · Geometric perception part 1](https://www.bilibili.com/video/BV1dB4y1R7bS/?p=5) 是补充入口，约 1 小时 19 分钟；Day 01 不要求看完整讲。MIT 在线讲义持续更新，和 2022 视频的组织方式不必逐页相同。

## 3. 开始之前，只补这几个小概念

- **坐标**：相对于指定原点和坐标轴，用几个数字给一个点“报地址”。三维点可写为 `(x, y, z)`，还要注明单位。
- **向量**：可先看成一个有方向、有长度的箭头。点的坐标与从原点指向该点的箭头可以使用同样的三个数，但平移时要分清它们的含义。
- **单位向量**：长度为 1 的箭头，适合用来记录坐标轴的方向。
- **角度**：本教程滑条显示度数；计算公式中的三角函数按弧度计算。90° 是四分之一圈。
- **矩阵**：按行和列摆放的数字。这里先观察它怎样把输入坐标组合成输出坐标，再读符号；不需要先补完整线性代数课程。
- **列向量约定**：坐标按一列来理解，变换乘在左侧。`T_world_camera` 把相机坐标变成世界坐标；下标方向写清楚后再计算。

这些概念用于读懂空间关系，不要求重新学习已有的 Python、UE 或 PCG 基础。

## 4. 本教程怎样连接到 Day 01 实操？

| 课程得到的工具 | Day 01 中要解决的问题 | 合适的最小观察 |
|---|---|---|
| 位置、朝向、坐标变换 | 杯子在相机和世界中的数值为何不同？ | 同一个点经过变换，再经逆变换，恢复原来的坐标。 |
| 点云和位姿估计 | 相机测到的几何怎样放进统一空间？ | 坐标对齐后仍可能有噪声、遮挡和缺失，不能据此直接宣称抓取成功。 |
| 任务空间与工作空间 | 任务目标在三维里，为什么机械臂仍可能够不到？ | 目标在工作空间外；或位置能到，但要求的朝向不能同时满足。 |
| 空间图、AABB 和接面证据 | 房间在图上连接，为什么机器人仍可能过不了门？ | 分别改变门宽、锁状态和房间位置，定位失败所属的层。 |

最后一行来自 [Day 01 任务操作手册](https://github.com/venividici/14plan/blob/de6fd9cb352370863e94d64d775c4f5236ed38fc/TASK_GUIDES/day-01.md)，属于该学习计划的综合练习；不能把它说成上述六段 Modern Robotics 视频全部讲过的内容。

## 5. 先观察，再自己复述

每次只改一个量，改之前先预测，再看图中什么改变、什么保持不变。能说清楚以后，再回看对应短片。暂时不知道的地方保留为问题，个人首答与修订答案分开记录。

本教程中的机械臂、点云、房间检查是教学模型。操作演示不等于在真实机器人或本人项目中完成了验证，也不会自动填入学习计划的完成记录。
