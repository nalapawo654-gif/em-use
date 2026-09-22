# 土豆战神五星红旗修正

2026-09-22，使用内置 imagegen 的 precise-object-edit 模式，以 `public/assets/potato/props-atlas.png` 为参考，仅生成修正后的独立旗帜。原始透明 PNG 保存为 `public/assets/potato/china-flag.png`，运行时替换 props 第 5 帧，其他道具继续使用原图集。保留生成的原始 alpha，不做抠色。

## 生成提示

Edit ONLY the small flag in row 2 column 2 of the input prop atlas and output that single corrected flag as a standalone isolated transparent PNG. Preserve the warm wooden flagpole, gold ball finial, two dark metal clamps, softly waving richly textured red cloth and polished 3D toy rendering. Correct the design to the national flag of China, 五星红旗: red field with exactly FIVE yellow five-pointed stars confined to the upper-left canton near the hoist. ONE larger upright star at the left, FOUR much smaller stars in an arc to its right, each small star with one point aimed toward the center of the big star. Approximate unfolded flag 30x20 grid: big star center (5,5), radius 3; small centers (10,2), (12,4), (12,7), (10,9), radius 1. No centered single star, no extra stars, no text. Gently waving cloth must leave all five stars clearly visible with clean separation and accurate arrangement. Flagpole slightly leans to right as in original, cloth extends to right. Keep original proportions and lighting. Center whole prop in a square canvas with about 4% transparent margins, fully visible top and bottom. True transparent alpha background, no background scene, no cast shadow rectangle, no watermark. High quality production game sprite.

## 验证

类型检查、生产构建、迁移对比与素材完整性检查通过。浏览器确认互动加载独立五星红旗，画布保留透明 alpha，3.6 秒后恢复日常；180px 迷你窗口旗帜正常加载且可点击「结束」。[440px 效果](../../output/playwright/potato-china-flag-440.png) · [180px 效果](../../output/playwright/potato-china-flag-180.png)。本次未重新打包，未进行原生安装与真实账户验证。
