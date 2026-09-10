# 充气牛马物料

根据用户提供的「充气牛马」设计板，使用内置 image_gen 生成。没有使用 CLI / 外部付费 API，没有新增图片运行时请求。

| 文件 | 用途 | 尺寸与取帧 |
| --- | --- | --- |
| pasture.png | 草地与蓝天场景 | 1254 × 1254，完整背景 |
| classic-states.png | 经典牛马四档额度 | 1254 × 1254 RGBA；按测量 rect 取帧，原图保留 |
| skin-states.png | 其余四款装扮，每款四档额度 | 1254 × 1254 白底；按测量 rect 取帧 |
| props.png | 草、水桶、刷子、足球、手、蚊子、打气筒、空木牌 | 1774 × 887，4 × 2 等格 |

生成提示、工具来源及测量记录分别见 [场景](pasture-generation.md)、[经典角色](classic-generation.md)、[装扮](skin-generation.md)、[道具](props-generation.md)。

代码在 `src/buddy/sprites.ts` 中去除边缘连通白底及透明散点，将角色统一缩放并对齐脚底。没有覆盖生成原图。形态真实高度保留，低额度不会因为单独 fit 而被重新拉高。道具和角色缓存于内存，换装与状态切换复用。

对应交互计划：`docs/charging-buddy-plan.md`。木牌由空白道具与动态额度文本组成，单位沿用产品的 ¥，不使用设计板中的演示 GB。
