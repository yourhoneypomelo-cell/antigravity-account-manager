# Antigravity Account Manager — refined SVG

当前为 v3 深色矢量图的视觉优化版。背景、官方 Antigravity 主标志和五把钥匙继续保留。

## 本次视觉调整

- 五个钥匙孔沿椭圆环的弧线定位，拉开头部间距。
- 重新调整钥匙的扇形角度与悬挂位置；减小拥挤的肩部，略微加粗柄部。
- 银白和蓝色钥匙改为平面色，减少小尺寸噪点。
- 在钥匙与主标志的狭窄交界处增加极细的深色分隔。
- 为 16–32 像素制作独立的光学调整版本，略微扩大钥匙头、孔和柄的宽度。

## 当前资源

- 标准 SVG：`public/branding/antigravity-v3-dark.svg`，用于文档和较大展示。
- 小尺寸 SVG：`public/branding/antigravity-v3-small.svg`，用于顶栏、锁屏和 SVG favicon。
- 透明底标志：`public/branding/antigravity-v3-emblem.svg`。
- 独立背景：`public/branding/antigravity-v3-background.svg`。
- 桌面图标目录：`src-tauri/icons/aam-v3-refined/`。

Windows ICO 合并两套导出：16、24、32 像素使用小尺寸版，48、64、256 像素使用标准版。两套 SVG 均有五个独立钥匙实例，不包含嵌入位图。

已检查 16、24、32、48、64、128 像素在浅色和深色环境中的渲染。极小尺寸保留主标志与钥匙串的整体识别，不承诺每个钥匙细节均可辨认。视觉检查图同时保留优化前后对比。

主标志来源：[Antigravity 官方素材](https://www.antigravity.google/press)。本轮直接优化已有 SVG 路径，没有重新生成位图设计。
