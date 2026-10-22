# Day 06 · 从可渲染场景到机器人训练环境

Day 6 的核心不是“会不会打开 Isaac Sim”，而是能否把 **UE 场景资产、物理仿真世界、机器人学习任务与评测证据** 分清楚。

## 一条最重要的链

`UE/PCG Mesh → 尺度与坐标 → Collision/Rigid Body → Joint/Articulation → Sensor → Observation → Policy → Action → Controller → Physics → Reward/Termination → Reset → Episode metrics`

其中任何一步缺失，都不能只凭“场景看起来能跑”宣布它已经是机器人训练环境。

## 11 个核心问题

1. **渲染几何与物理几何**：视觉 Mesh 可以没有碰撞。机器人任务必须有明确 collision、尺寸与净空模型。
2. **质量、摩擦与时间步**：相同推力在不同质量、摩擦和步长下会产生不同响应。
3. **门的 Articulation**：门有动画不等于存在可被物理求解的 hinge joint、limit 和 drive。
4. **Observation**：策略只能读取合同声明的观测。直接读取现实中不可测的 `door_locked` 真值属于特权观测。
5. **时间同步**：物理、传感器与控制频率不同，需要明确采样、保持、延迟与时间戳。
6. **Action**：动作必须写清变量、单位、频率、控制器和安全边界。
7. **Reward 与 Success**：奖励是训练信号，成功是任务判据。奖励很高仍可能没有完成任务。
8. **Reset**：恢复位置还不够，还要恢复速度、关节、物体、随机状态等。
9. **Seed 与数据划分**：训练/测试 seed 泄漏会把记忆场景误当成泛化。
10. **UE → 物理仿真审计**：单位、坐标、碰撞、质量、关节、传感、控制、任务、版本、日志都要逐项核对。
11. **Episode 时间线**：reset → observation → policy → action → physics → reward/termination → next observation。

## 20 项迁移检查

| 类别 | 检查项 |
|---|---|
| 坐标 | 单位；世界原点；轴方向；姿态约定 |
| 几何 | collision；footprint；门洞净宽；高度净空 |
| 物理 | rigid body；质量；惯量；摩擦/恢复系数 |
| 关节 | joint 类型；轴；限位；drive/阻尼 |
| 传感 | 外参；频率；时间戳；噪声/遮挡 |
| 控制 | action 类型；单位；控制频率；限幅/安全 |
| 任务 | reward；success；termination；timeout |
| 复现 | reset；seed；场景版本；失败日志 |

## 三个必须会讲的反例

**反例 1：视觉墙没有碰撞。**症状是机器人穿墙；缺的是 collision 接口；验证应使用独立碰撞查询或物理 rollout，而不是截图。

**反例 2：门有动画却没有物理铰链。**症状是机器人推门时门完全不响应；缺的是 articulation/joint；验证应检查 joint、limit、drive 和实际接触力矩。

**反例 3：策略读取 door_locked 真值。**症状是仿真中策略异常聪明；缺的是公平 observation 合同；验证要列出每个观测字段是否有现实可用传感来源。

## 真实性边界

本教程中的网页与 Python 属于教学模型。没有运行 Isaac Sim、Isaac Lab、ROS 或实体机器人，因此不能把它们写成“仿真成功率”或“实机成功率”。