作为一名富有创意的前端开发者和主题设计师，请为IP "[星穹铁道]" 创建一个高度风格化的聊天应用CSS主题。

核心目标：
这个主题的核心目标是让用户第一眼就能强烈感受到 "[星穹铁道]" 的独特视觉风格和氛围，就像“蜡笔小新”主题那样，通过大胆和富有创意的CSS技巧，将IP的灵魂注入到每一个UI元素中，而非仅仅是简单的颜色替换。

关键指令：

1.  **深度提炼IP视觉DNA：**
    *   **核心质感/画风：** 识别 "[星穹铁道]" 最具代表性的视觉质感或绘画风格。例如，是手绘卡通、像素风、水彩、复古漫画、黏土动画质感、赛璐璐动画等。请在CSS中通过边框样式、阴影、背景纹理（如果可能且轻量）等方式模拟这种质感。
    *   **标志性颜色方案：** 不仅要提取IP的主色调，更要关注其最具代表性的角色配色方案，以及这些颜色在原作中是如何搭配和使用的。将这些颜色大胆地应用于关键UI组件（如消息气泡、按钮、激活状态、头像背景等）。
    *   **标志性形状与符号（可选）：** 如果IP有简单且易于通过CSS（如 `border-radius` 组合、伪元素）实现的标志性形状或小符号，尝试融入设计中（例如，特定形状的按钮，消息气泡的特殊边角）。
    *   **字体选择：** 选择或建议一种能够强烈呼应 "[星穹铁道]" 风格和年代感的字体。如果找不到完美匹配的webfont，选择最接近的通用字体，并通过CSS调整字重、间距等来营造氛围。

2.  **夸张与风格化应用：**
    *   **边框和描边：** 像“蜡笔小新”主题的“蜡笔棕”粗边框一样，为 "[星穹铁道]" 设计一种标志性的边框/描边风格，并应用于应用容器、面板、重要按钮等元素，以强化其风格。
    *   **阴影效果：** 使用能够反映IP艺术风格的阴影。可能是简单、硬朗的卡通阴影，也可能是柔和的、具有特定颜色倾向的阴影。
    *   **交互反馈：** 悬停（hover）、激活（active）、选中（selected）状态应具有鲜明且符合IP调性的视觉反馈，颜色变化要大胆，可以考虑轻微的形变或阴影变化。
    *   **角色主题化：**
        *   为至少3-5个 "[星穹铁道]" 中的核心角色设计独特的子主题。
        *   当聊天对象是这些特定角色时，其头像、聊天列表项激活背景、收到的消息气泡、详情页标题等，都应显著体现该角色的标志性颜色和（可能的）细微特征。颜色应用要直接且有冲击力。

3.  **避免通用化和过度精致：**
    *   除非 "[星穹铁道]" 本身就是极简或高度精致的风格，否则应避免过于现代、扁平化、或Material Design式的通用UI设计。
    *   目标是“神似”和“有趣”，在保证基本可用性的前提下，可以适度牺牲一些传统UI的“最佳实践”，以换取更强烈的IP代入感。

4.  **具体UI元素覆盖：**
    *   整体应用容器 (`.app-container`)
    *   侧边栏 (`.sidebar-nav`)，聊天列表项 (`.chat-list-item`, active状态)
    *   主聊天区域 (`.chat-area`)，聊天头部 (`.chat-header-main`)
    *   消息气泡（发送 `.message.sent`，接收 `.message.received`，系统消息 `.message.system`）
    *   输入区域 (`.chat-input-container`)，输入框 (`#messageInput`)，发送按钮 (`#sendButtonMain`)
    *   按钮 (`.btn`, `.btn-primary` 等)
    *   模态框 (`.modal-content`)
    *   滚动条
    *   占位符/空状态提示
5. 其它细节
    *   不要改变.app-container 的最大高度与宽度
    *   自动连接的开关打开时使用全开

输出要求：
请提供完整的CSS文件内容。在CSS变量部分清晰定义所有颜色和关键尺寸。在角色特定样式部分，请明确注释出是为哪个角色设计的。

为了帮助你更好地理解 "[星穹铁道]" 的视觉风格，以下是一些关键视觉元素/特征供参考（可选，如果提供更佳）：
*   主要角色及其代表色：[例如：海绵宝宝 - 黄色、棕色；派大星 - 粉色、绿色花纹裤子]
*   整体艺术风格描述：[例如：早期2D卡通，色彩鲜艳饱和，线条粗犷圆润]
*   是否有标志性纹理或图案：[例如：海绵宝宝身上的孔洞，派大星裤子上的花纹]
