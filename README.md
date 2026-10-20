# Modern Robotics · 可视化学习手记

面向初学者的中文学习笔记。先通过交互观察空间变化，再解释概念、公式与适用条件。

首篇覆盖 [14plan 的完整 Day 1](https://github.com/venividici/14plan/blob/main/DAILY/day-01.md)：指定的 6 个 Modern Robotics 短片、MIT 几何位姿估计选读，以及空间图、AABB 和门通行的应用练习。

## 打开教程

- 网页入口：根目录 [index.html](index.html)。下载仓库后可直接用浏览器打开，所有交互都在本地运行，不需要安装依赖。
- GitHub Pages 预定地址：<https://venividici.github.io/-Modern-Robotics/>。需要在仓库 **Settings → Pages** 选择 **Deploy from a branch → main → /(root)** 并保存后才会发布。
- 完整文字版：[Day 01 教程](notes/day-01-tutorial.md)。
- 深入阅读：[2.1 刚体的自由度](notes/day-01-2-1-rigid-body-dof.md) · [原课程对应表](notes/day-01-course-map.md)。

## 这一篇包含什么

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

## 使用方式

1. 按目录学习一节，先猜滑条改变后会发生什么。
2. 每次只改一个参数，观察图和数值如何联动。
3. 用自己的话解释，再打开折叠参考说明。
4. 回到原视频复听对应部分，或继续原计划的实际练习。

页面末尾的个人笔记只保存在当前浏览器，支持导出 `.md`；不会自动上传 GitHub。页面本身不标记用户已掌握，也不把 AI 整理的示例当成用户完成的实验。

## 来源与约定

- [Modern Robotics 官方视频转写](https://modernrobotics.northwestern.edu/nu-gm-book-resource/)：Day 1 的 P4 / P9 / P10 / P11 / P12 / P16，合计 22 分 35 秒。
- [Modern Robotics 原书](https://hades.mech.northwestern.edu/images/2/25/MR-v2.pdf)：§2.1、§2.5 与第 3 章相关内容。
- [MIT Robotic Manipulation · Geometric Pose Estimation](https://manipulation.mit.edu/pose.html)：相机、点云、遮挡、位姿估计与配准选读。
- [14plan Day 1 任务手册](https://github.com/venividici/14plan/blob/de6fd9cb352370863e94d64d775c4f5236ed38fc/TASK_GUIDES/day-01.md) 与 [MiniLab](https://github.com/venividici/14plan/blob/de6fd9cb352370863e94d64d775c4f5236ed38fc/minilab/validate.py)。

本教程依据官方转写与讲义整理，不声称完整播放 B 站视频。统一使用右手系、米、列向量；`T_world_camera` 将相机坐标表达为世界坐标。

## 维护与扩展

这是一个无第三方运行时依赖的静态网站。为了让组件独立维护，使用一个很小的 Python 构建脚本把本地组件嵌入页面；编译后的 `index.html` 一同提交，因此访问网站与离线阅读不需要构建。

| 路径 | 用途 |
|---|---|
| `src/index.template.html` | 教程正文与组件位置 |
| `components/` | 9 个交互演示的标记 |
| `assets/` | 主题、交互、几何计算与图形样式 |
| `notes/` | 可直接在 GitHub 阅读的中文 Markdown 笔记 |
| `scripts/build.py` | 将组件嵌入 `index.html` |
| `scripts/validate.py` | 检查构建一致性、链接、ID、依赖和语法 |
| `tests/frames-math.test.cjs` | 坐标与变换的数值检查 |

修改正文或组件后，在仓库根目录执行：

```bash
python3 scripts/build.py
python3 scripts/validate.py
node tests/frames-math.test.cjs
```

新增课程时保留现有笔记与锚点。每篇写明原课程、核心问题、交互模型的条件和练习，不自动填写个人完成状态或学习体会。

## 验证范围

本版执行了静态结构、资源与链接、JS 语法及纯数学检查。坐标模块核对正交性、90° 旋转、正逆恢复和变换链；房间规则与原 Python MiniLab 对照；点云使用合成真值检查误差守恒。

本次新网站尚未进行浏览器端的整页视觉与交互实测。原对话中的三个自由度演示曾单独检查过，但这不替代新页面的整体浏览器测试。
