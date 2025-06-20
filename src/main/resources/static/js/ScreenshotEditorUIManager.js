/**
 * @file ScreenshotEditorUIManager.js
 * @description
 * 该文件负责管理截图编辑器的用户界面 (UI) 和交互逻辑。
 * 它提供了图像裁剪和矩形标记（支持颜色选择）的核心功能。
 * 用户可以通过此模块对捕获的屏幕截图进行初步编辑，然后再进行后续处理。
 *
 * @module ScreenshotEditorUIManager
 *
 * @exports {object} ScreenshotEditorUIManager - ScreenshotEditorUIManager 的单例对象，提供所有公开方法。
 *
 * @property {function} init - 初始化编辑器，包括获取必要的 DOM 元素、设置 Canvas 上下文以及绑定所有相关的事件监听器。这是使用该模块的入口点。
 * @property {function} _handleRawScreenshot - (私有方法，由事件触发) 处理从 MediaManager 传来的原始截图数据，并准备编辑器界面。
 * @property {function} _showEditor - (私有方法) 显示编辑器模态框并将图像绘制到 Canvas 画布上。
 * @property {function} _confirmEdit - (私有方法) 用户确认编辑后调用，处理最终图像（应用裁剪和标记），并发出带有编辑后图像数据的事件。
 * @property {function} _cancelEdit - (私有方法) 用户取消编辑后调用，关闭编辑器并发出取消事件。
 * @property {function} _closeEditorAndStopStream - (私有方法) 关闭编辑器UI，并停止与截图过程关联的任何媒体流。
 *
 * @dependencies
 *  - Utils: 提供通用的工具函数，例如日志记录。
 *  - NotificationUIManager: 用于向用户显示通知信息（例如，操作成功、错误提示）。
 *  - EventEmitter: 用于模块间的事件发布和订阅机制，例如监听 `rawScreenshotCaptured` 事件以及发出 `screenshotEditingComplete` 或 `screenshotEditingCancelled` 事件。
 *
 * @listens {rawScreenshotCaptured} - 从 EventEmitter 监听此事件，以接收原始截图数据和媒体流。
 * @fires {screenshotEditingComplete} - 当编辑完成并确认后，通过 EventEmitter 发出此事件，携带编辑后的图像文件对象 (包含 dataUrl, blob 等)。
 * @fires {screenshotEditingCancelled} - 当编辑被用户取消后，通过 EventEmitter 发出此事件。
 */
const ScreenshotEditorUIManager = {
    // DOM 元素引用
    editorModalEl: null,      // 编辑器模态框元素
    canvasEl: null,           // Canvas 画布元素
    ctx: null,                // Canvas 2D 绘图上下文
    toolbarEl: null,          // 工具栏元素
    cropToolBtn: null,        // 裁剪工具按钮
    drawRectToolBtn: null,    // 绘制矩形工具按钮
    markColorPickerEl: null,  // 标记颜色选择器元素
    confirmBtn: null,         // 确认编辑按钮
    cancelBtn: null,          // 取消编辑按钮

    // 图像和流数据
    rawImage: null,           // 原始截图的 Image 对象
    originalStream: null,     // 截图时使用的原始媒体流 (例如屏幕共享流)

    // 编辑器状态
    isEditorActive: false,    // 编辑器是否处于活动状态
    currentTool: null,        // 当前选中的工具 ('crop', 'drawRect', null)

    // 裁剪相关状态
    isCropping: false,        // 用户是否正在绘制新的裁剪矩形
    isMovingCrop: false,      // 用户是否正在移动已有的裁剪矩形
    isResizingCrop: false,    // 用户是否正在通过控制点调整裁剪矩形大小
    cropRect: null,           // 当前裁剪矩形 {x, y, w, h}
    cropHandles: [],          // 裁剪矩形的控制点数组
    activeCropHandle: null,   // 当前活动的裁剪控制点ID
    minCropSize: 20,          // 裁剪矩形的最小尺寸 (宽/高)
    cropMoveOffsetX: 0,       // 移动裁剪框时，鼠标相对于裁剪框左上角的X轴偏移
    cropMoveOffsetY: 0,       // 移动裁剪框时，鼠标相对于裁剪框左上角的Y轴偏移

    // 标记相关状态
    isDrawingMark: false,     // 用户是否正在绘制新的标记矩形
    currentMarkRect: null,    // 当前正在绘制的标记矩形 {x, y, w, h}
    marks: [],                // 已确认的标记对象数组

    // 鼠标/触摸事件坐标
    startX: 0,                // 鼠标按下或触摸开始时的X坐标
    startY: 0,                // 鼠标按下或触摸开始时的Y坐标
    mouseX: 0,                // 当前鼠标X坐标
    mouseY: 0,                // 当前鼠标Y坐标

    // 标记样式常量和状态
    DEFAULT_MARK_COLOR: '#FF0000',      // 默认标记颜色 (红色)
    DEFAULT_MARK_LINE_WIDTH: 3,         // 默认标记线条宽度
    currentMarkColor: '#FF0000',        // 当前选中的标记颜色

    /**
     * 初始化截图编辑器UI管理器。
     * 获取必要的DOM元素引用，设置Canvas的2D绘图上下文，
     * 初始化默认标记颜色，并绑定所有事件监听器。
     * 如果关键DOM元素未找到，将记录错误并可能导致功能受限。
     * @public
     */
    init: function() {
        this.editorModalEl = document.getElementById('screenshotEditorModal');
        this.canvasEl = document.getElementById('screenshotEditorCanvas');
        this.toolbarEl = document.getElementById('screenshotEditorToolbar');
        this.cropToolBtn = document.getElementById('cropToolBtn');
        this.drawRectToolBtn = document.getElementById('drawRectToolBtn');
        this.markColorPickerEl = document.getElementById('markColorPicker');
        this.confirmBtn = document.getElementById('confirmScreenshotEditBtn');
        this.cancelBtn = document.getElementById('cancelScreenshotEditBtn');

        if (!this.editorModalEl || !this.canvasEl || !this.toolbarEl || !this.confirmBtn || !this.cancelBtn || !this.markColorPickerEl) {
            Utils.log('ScreenshotEditorUIManager: 初始化失败，部分编辑器DOM元素未找到。截图编辑功能可能无法使用。', Utils.logLevels.ERROR);
            return;
        }
        if (this.canvasEl) {
            this.ctx = this.canvasEl.getContext('2d');
        } else {
            Utils.log('ScreenshotEditorUIManager: Canvas元素未找到，无法获取2D上下文。', Utils.logLevels.ERROR);
            return;
        }
        this.currentMarkColor = this.markColorPickerEl.value || this.DEFAULT_MARK_COLOR;

        this._bindEvents();
        Utils.log('ScreenshotEditorUIManager initialized.', Utils.logLevels.INFO);
    },

    /**
     * 绑定编辑器内部及与其他模块交互所需的事件监听器。
     * 包括：
     * - 监听来自 EventEmitter 的 `rawScreenshotCaptured` 事件。
     * - 绑定编辑器内部按钮（确认、取消、工具选择）的点击事件。
     * - 绑定颜色选择器的输入事件。
     * - 绑定 Canvas 上的鼠标和触摸事件，用于绘图和交互。
     * @private
     */
    _bindEvents: function() {
        if (typeof EventEmitter !== 'undefined') {
            EventEmitter.on('rawScreenshotCaptured', this._handleRawScreenshot.bind(this));
        } else {
            Utils.log('ScreenshotEditorUIManager: EventEmitter 未定义，无法监听 rawScreenshotCaptured 事件。', Utils.logLevels.WARN);
        }

        if (this.confirmBtn) this.confirmBtn.addEventListener('click', this._confirmEdit.bind(this));
        if (this.cancelBtn) this.cancelBtn.addEventListener('click', this._cancelEdit.bind(this));
        if (this.cropToolBtn) this.cropToolBtn.addEventListener('click', this._activateCropTool.bind(this));
        if (this.drawRectToolBtn) this.drawRectToolBtn.addEventListener('click', this._activateDrawRectTool.bind(this));

        if (this.markColorPickerEl) {
            this.markColorPickerEl.addEventListener('input', (event) => {
                this.currentMarkColor = event.target.value;
                Utils.log(`Mark color changed to: ${this.currentMarkColor}`, Utils.logLevels.DEBUG);
            });
        }

        this.canvasEl.addEventListener('mousedown', this._handleCanvasMouseDown.bind(this));
        this.canvasEl.addEventListener('mousemove', this._handleCanvasMouseMove.bind(this));
        this.canvasEl.addEventListener('mouseup', this._handleCanvasMouseUp.bind(this));
        this.canvasEl.addEventListener('mouseleave', this._handleCanvasMouseLeave.bind(this));

        // 触摸事件绑定，passive: false 用于允许 e.preventDefault()
        this.canvasEl.addEventListener('touchstart', this._handleCanvasTouchStart.bind(this), { passive: false });
        this.canvasEl.addEventListener('touchmove', this._handleCanvasTouchMove.bind(this), { passive: false });
        this.canvasEl.addEventListener('touchend', this._handleCanvasTouchEnd.bind(this));
    },

    /**
     * 辅助函数，用于将一个矩形裁剪到指定的区域内。
     * 返回一个新的、位于全局坐标系下的裁剪后矩形 {x, y, w, h}，
     * 如果两个矩形没有重叠部分，则返回 null。
     * @private
     * @param {object} rect - 需要被裁剪的矩形，格式为 {x, y, w, h}。
     * @param {object} clipArea - 用于裁剪的区域，格式为 {x, y, w, h}。
     * @returns {object|null} 裁剪后的矩形对象，或在无重叠时返回 null。
     */
    _clipRectToArea: function(rect, clipArea) {
        if (!rect || !clipArea) return null;

        const finalX = Math.max(rect.x, clipArea.x);
        const finalY = Math.max(rect.y, clipArea.y);

        const rectRight = rect.x + rect.w;
        const rectBottom = rect.y + rect.h;
        const clipAreaRight = clipArea.x + clipArea.w;
        const clipAreaBottom = clipArea.y + clipArea.h;

        const finalRight = Math.min(rectRight, clipAreaRight);
        const finalBottom = Math.min(rectBottom, clipAreaBottom);

        const finalW = finalRight - finalX;
        const finalH = finalBottom - finalY;

        if (finalW <= 0 || finalH <= 0) {
            return null; // 没有重叠区域
        }
        return { x: finalX, y: finalY, w: finalW, h: finalH };
    },

    /**
     * 处理从 MediaManager (通过 EventEmitter) 接收到的原始截图数据。
     * @private
     * @param {object} detail - 事件传递的数据对象。
     * @param {string} detail.dataUrl - 原始截图的 Base64 Data URL。
     * @param {MediaStream} detail.originalStream - 截图时使用的原始媒体流。
     */
    _handleRawScreenshot: function(detail) {
        Utils.log('Raw screenshot received by ScreenshotEditorUIManager.', Utils.logLevels.DEBUG);
        if (!detail || !detail.dataUrl || !detail.originalStream) {
            NotificationUIManager.showNotification('接收截图数据不完整。', 'error');
            if (detail && detail.originalStream) {
                // 确保停止流，即使数据不完整
                detail.originalStream.getTracks().forEach(track => track.stop());
            }
            this.isEditorActive = false;
            return;
        }

        // 重置编辑器状态
        this.rawImage = null;
        this.originalStream = detail.originalStream;
        this.isEditorActive = true;
        this.currentTool = null;
        this.cropRect = null;
        this.marks = [];
        this.isCropping = false;
        this.isMovingCrop = false;
        this.isResizingCrop = false;
        this.isDrawingMark = false;
        this.currentMarkRect = null;
        this.cropHandles = [];
        this.activeCropHandle = null;

        // 重置颜色选择器为默认颜色
        if (this.markColorPickerEl) {
            this.markColorPickerEl.value = this.DEFAULT_MARK_COLOR;
            this.currentMarkColor = this.DEFAULT_MARK_COLOR;
        }

        const img = new Image();
        img.onload = () => {
            this.rawImage = img;
            this._showEditor(); // 图像加载成功后显示编辑器
        };
        img.onerror = () => {
            NotificationUIManager.showNotification('加载截图到编辑器失败。', 'error');
            Utils.log('ScreenshotEditorUIManager: 图片加载失败 (img.onerror)。', Utils.logLevels.ERROR);
            this._closeEditorAndStopStream(); // 加载失败则关闭编辑器并停止流
        };
        img.src = detail.dataUrl;
    },

    /**
     * 显示编辑器模态框，并将原始图像绘制到Canvas上。
     * @private
     */
    _showEditor: function() {
        if (!this.editorModalEl || !this.canvasEl || !this.ctx || !this.rawImage) {
            Utils.log('ScreenshotEditorUIManager._showEditor: 关键元素或数据缺失，无法显示编辑器。', Utils.logLevels.ERROR);
            this._closeEditorAndStopStream(); // 如果必要组件缺失，则关闭
            return;
        }

        // 设置 Canvas 尺寸与图像一致
        this.canvasEl.width = this.rawImage.width;
        this.canvasEl.height = this.rawImage.height;

        this._redrawCanvas(); // 初始绘制

        this.editorModalEl.style.display = 'flex'; // 显示模态框
        this._updateToolButtons(); // 更新工具栏按钮状态
        Utils.log('Screenshot editor shown with image.', Utils.logLevels.INFO);
        this._activateCropTool(); // 默认激活裁剪工具
    },

    /**
     * 重新绘制整个 Canvas 画布。
     * 包括背景图像、裁剪区域预览（如果存在）、所有已确认的标记，
     * 以及当前正在绘制的标记预览。
     * @private
     */
    _redrawCanvas: function() {
        if (!this.ctx || !this.rawImage) return;

        // 清空画布并绘制原始图像
        this.ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
        this.ctx.drawImage(this.rawImage, 0, 0);

        // 如果存在裁剪矩形 (cropRect)，则绘制半透明遮罩以形成“预览”效果
        // 无论当前激活的是什么工具，都会绘制这个遮罩，因为标记是基于这个预览的
        if (this.cropRect) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            // 绘制裁剪区域外的四个矩形遮罩
            // 顶部
            this.ctx.fillRect(0, 0, this.canvasEl.width, this.cropRect.y);
            // 底部
            this.ctx.fillRect(0, this.cropRect.y + this.cropRect.h, this.canvasEl.width, this.canvasEl.height - (this.cropRect.y + this.cropRect.h));
            // 左侧
            this.ctx.fillRect(0, this.cropRect.y, this.cropRect.x, this.cropRect.h);
            // 右侧
            this.ctx.fillRect(this.cropRect.x + this.cropRect.w, this.cropRect.y, this.canvasEl.width - (this.cropRect.x + this.cropRect.w), this.cropRect.h);

            // 如果当前工具是 'crop'，额外绘制裁剪框的边框和控制点
            if (this.currentTool === 'crop') {
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(this.cropRect.x, this.cropRect.y, this.cropRect.w, this.cropRect.h);
                // 仅当不是正在从头绘制新矩形，或者矩形具有非零尺寸时，才绘制控制点
                if (!this.isCropping || (this.cropRect.w !== 0 || this.cropRect.h !== 0)) {
                    this._drawCropHandles();
                }
            }
        }

        // 绘制所有已确认的标记。标记存储的是全局坐标。
        this.marks.forEach(mark => {
            if (mark.type === 'rect') {
                this.ctx.strokeStyle = mark.color || this.DEFAULT_MARK_COLOR;
                this.ctx.lineWidth = mark.lineWidth || this.DEFAULT_MARK_LINE_WIDTH;
                this.ctx.strokeRect(mark.x, mark.y, mark.w, mark.h);
            }
        });

        // 绘制当前正在绘制的标记（预览），可能会被裁剪到 cropRect 区域内。
        if (this.isDrawingMark && this.currentMarkRect && this.currentTool === 'drawRect') {
            let rectToDrawPreview = { ...this.currentMarkRect };

            // 如果绘制方向相反（w/h为负），先进行标准化，以便进行准确的裁剪逻辑判断。
            let normalizedPreview = { ...rectToDrawPreview };
            if (normalizedPreview.w < 0) { normalizedPreview.x += normalizedPreview.w; normalizedPreview.w *= -1; }
            if (normalizedPreview.h < 0) { normalizedPreview.y += normalizedPreview.h; normalizedPreview.h *= -1; }

            if (this.cropRect) { // 如果裁剪预览区域激活，将绘制中的标记预览裁剪到该区域。
                const clippedLivePreview = this._clipRectToArea(normalizedPreview, this.cropRect);
                if (clippedLivePreview) {
                    rectToDrawPreview = clippedLivePreview;
                } else {
                    rectToDrawPreview = null; // 当前绘制完全在裁剪区域之外，因此裁剪区域内无预览。
                }
            } else { // 没有裁剪区域，直接使用标准化的绘制矩形。
                rectToDrawPreview = normalizedPreview;
            }

            if (rectToDrawPreview && rectToDrawPreview.w > 0 && rectToDrawPreview.h > 0) { // 仅当矩形有效且有尺寸时绘制。
                this.ctx.strokeStyle = this.currentMarkColor;
                this.ctx.lineWidth = this.DEFAULT_MARK_LINE_WIDTH;
                this.ctx.strokeRect(rectToDrawPreview.x, rectToDrawPreview.y, rectToDrawPreview.w, rectToDrawPreview.h);
            }
        }
    },

    /**
     * 激活裁剪工具。
     * @private
     */
    _activateCropTool: function() {
        this.currentTool = 'crop';
        // 不重置已存在的 cropRect，用户可能想调整它。
        // 如果 cropRect 为 null，则用户需要绘制新的裁剪区域。
        this.isCropping = false; // 重置绘制状态
        this.isMovingCrop = false;
        this.isResizingCrop = false;
        this._redrawCanvas(); // 重绘以显示/更新裁剪框样式
        this._updateToolButtons(); // 更新工具按钮高亮状态
        // 光标样式将由 _updateCursorStyle 根据 cropRect 的存在和鼠标位置设置
        this._updateCursorStyle(this.mouseX, this.mouseY); // 立即更新光标
        if (this.markColorPickerEl) this.markColorPickerEl.style.display = 'none'; // 裁剪工具激活时隐藏颜色选择器
        NotificationUIManager.showNotification('裁剪工具已激活。请拖拽选择或调整裁剪区域。', 'info');
    },

    /**
     * 激活矩形标记工具。
     * @private
     */
    _activateDrawRectTool: function() {
        this.currentTool = 'drawRect';
        this._redrawCanvas(); // 重绘以确保裁剪预览（如有）正确显示（不带裁剪控制点）
        this._updateToolButtons(); // 更新工具按钮高亮状态
        this.canvasEl.style.cursor = 'crosshair'; // 设置标记工具的光标
        if (this.markColorPickerEl) this.markColorPickerEl.style.display = 'inline-block'; // 显示颜色选择器
        if (this.cropRect) {
            NotificationUIManager.showNotification('矩形标记工具已激活。请在选定区域内标记。', 'info');
        } else {
            NotificationUIManager.showNotification('矩形标记工具已激活。请标记。', 'info');
        }
    },

    /**
     * 更新工具栏按钮的激活（高亮）状态，以反映当前选中的工具。
     * 同时控制颜色选择器的显隐。
     * @private
     */
    _updateToolButtons: function() {
        if (this.cropToolBtn) this.cropToolBtn.classList.toggle('active', this.currentTool === 'crop');
        if (this.drawRectToolBtn) this.drawRectToolBtn.classList.toggle('active', this.currentTool === 'drawRect');
        if (this.markColorPickerEl) {
            // 仅当矩形标记工具激活时显示颜色选择器
            this.markColorPickerEl.style.display = (this.currentTool === 'drawRect') ? 'inline-block' : 'none';
        }
    },

    /**
     * 用户确认编辑操作。
     * 此方法从Canvas获取最终编辑后的图像（应用裁剪和标记），
     * 将其转换为Blob和DataURL，然后通过 EventEmitter 发出 `screenshotEditingComplete` 事件。
     * @private
     */
    _confirmEdit: function() {
        if (!this.isEditorActive || !this.canvasEl || !this.ctx || !this.rawImage) {
            Utils.log('Confirm edit called but editor is not active or canvas not ready.', Utils.logLevels.WARN);
            this._closeEditorAndStopStream(); // 确保清理
            return;
        }
        Utils.log('ScreenshotEditorUIManager._confirmEdit called.', Utils.logLevels.INFO);
        NotificationUIManager.showNotification('正在处理截图...', 'info');

        const finalCanvas = document.createElement('canvas'); // 创建一个新的离屏 Canvas
        const finalCtx = finalCanvas.getContext('2d');

        let sourceX = 0, sourceY = 0; // 源图像的裁剪起点
        let outputWidth = this.rawImage.width; // 输出图像的宽度
        let outputHeight = this.rawImage.height; // 输出图像的高度

        // 如果定义了有效的裁剪区域，则使用裁剪区域的尺寸和位置
        if (this.cropRect && this.cropRect.w > 0 && this.cropRect.h > 0) {
            sourceX = this.cropRect.x;
            sourceY = this.cropRect.y;
            outputWidth = this.cropRect.w;
            outputHeight = this.cropRect.h;
        }

        finalCanvas.width = outputWidth;
        finalCanvas.height = outputHeight;

        // 将原始图像的选定（或全部）区域绘制到离屏 Canvas
        finalCtx.drawImage(this.rawImage, sourceX, sourceY, outputWidth, outputHeight, 0, 0, outputWidth, outputHeight);

        // 在离屏 Canvas 上绘制所有标记
        this.marks.forEach(mark => {
            if (mark.type === 'rect') {
                // 将标记的全局坐标转换为相对于裁剪后图像的坐标
                const markXInFinal = mark.x - sourceX;
                const markYInFinal = mark.y - sourceY;
                // 由于标记在添加时已预先裁剪到 cropRect（如果激活），它们应大部分在边界内。
                // 此检查作为安全措施。
                if (markXInFinal + mark.w > 0 && markXInFinal < outputWidth &&
                    markYInFinal + mark.h > 0 && markYInFinal < outputHeight) {
                    finalCtx.strokeStyle = mark.color || this.DEFAULT_MARK_COLOR;
                    finalCtx.lineWidth = mark.lineWidth || this.DEFAULT_MARK_LINE_WIDTH;
                    finalCtx.strokeRect(markXInFinal, markYInFinal, mark.w, mark.h);
                }
            }
        });

        // 将离屏 Canvas 内容转换为 Blob
        finalCanvas.toBlob((blob) => {
            if (!blob) {
                NotificationUIManager.showNotification('处理截图失败：无法生成图片 Blob。', 'error');
                this._closeEditorAndStopStream();
                return;
            }
            // 使用 FileReader 将 Blob 转换为 Data URL
            const reader = new FileReader();
            reader.onloadend = () => {
                const editedDataUrl = reader.result;
                const fileName = `screenshot_edited_${Date.now()}.png`;
                const editedFile = {
                    data: editedDataUrl, blob: blob, type: 'image/png',
                    name: fileName, size: blob.size
                };
                EventEmitter.emit('screenshotEditingComplete', editedFile); // 发出完成事件
                this._closeEditorAndStopStream(); // 关闭编辑器
            };
            reader.onerror = () => {
                NotificationUIManager.showNotification('读取编辑后截图数据失败。', 'error');
                this._closeEditorAndStopStream();
            };
            reader.readAsDataURL(blob);
        }, 'image/png');
    },

    /**
     * 用户取消编辑操作。
     * 关闭编辑器模态框，并通过 EventEmitter 发出 `screenshotEditingCancelled` 事件。
     * @private
     */
    _cancelEdit: function() {
        Utils.log('ScreenshotEditorUIManager._cancelEdit called.', Utils.logLevels.INFO);
        EventEmitter.emit('screenshotEditingCancelled'); // 发出取消事件
        this._closeEditorAndStopStream(); // 关闭编辑器
    },

    /**
     * 关闭编辑器UI界面，并确保停止关联的媒体流（如屏幕共享流）。
     * 同时重置编辑器内部状态。
     * @private
     */
    _closeEditorAndStopStream: function() {
        if (this.editorModalEl) this.editorModalEl.style.display = 'none'; // 隐藏模态框
        if (this.ctx && this.canvasEl && this.rawImage) {
            // 清理画布，以防下次打开时显示旧内容 (虽然通常会重绘)
            this.ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
        }

        // 停止原始媒体流的轨道
        if (this.originalStream) {
            this.originalStream.getTracks().forEach(track => track.stop());
            Utils.log('Original media stream for screenshot stopped.', Utils.logLevels.INFO);
        }
        // 重置状态变量
        this.rawImage = null;
        this.originalStream = null;
        this.isEditorActive = false;
        this.currentTool = null;
        this.isCropping = false;
        this.isMovingCrop = false;
        this.isResizingCrop = false;
        this.isDrawingMark = false;
        this.cropRect = null;
        this.marks = [];
        this.cropHandles = [];
        this.activeCropHandle = null;
        if(this.canvasEl) this.canvasEl.style.cursor = 'default'; // 重置光标样式
        if(this.markColorPickerEl) this.markColorPickerEl.style.display = 'none'; // 隐藏颜色选择器
    },

    /**
     * 将事件的客户端坐标 (clientX, clientY) 转换为相对于 Canvas 元素的内部坐标。
     * 同时考虑了 Canvas 元素的 CSS 缩放。
     * @private
     * @param {MouseEvent|TouchEvent} e - 鼠标事件或触摸事件对象。
     * @returns {{x: number, y: number}} Canvas内部的坐标对象。
     */
    _getCanvasCoordinates: function(e) {
        const rect = this.canvasEl.getBoundingClientRect(); // 获取Canvas在视口中的位置和尺寸
        let clientX, clientY;

        // 兼容触摸事件和鼠标事件
        if (e.touches && e.touches.length > 0) { // Touch start/move
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) { // Touch end
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else { // Mouse event
            clientX = e.clientX;
            clientY = e.clientY;
        }

        // 计算缩放比例
        const scaleX = this.canvasEl.width / rect.width;
        const scaleY = this.canvasEl.height / rect.height;

        // 转换坐标
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    },

    /**
     * 处理 Canvas 上的鼠标按下 (mousedown) 事件。
     * 根据当前激活的工具，开始裁剪、移动/调整裁剪框大小或绘制标记。
     * @private
     * @param {MouseEvent} e - 鼠标事件对象。
     */
    _handleCanvasMouseDown: function(e) {
        if (!this.isEditorActive) return; // 编辑器未激活则不处理
        const { x, y } = this._getCanvasCoordinates(e); // 获取Canvas内部坐标
        this.startX = x; // 记录起始点X
        this.startY = y; // 记录起始点Y

        if (this.currentTool === 'crop') { // 如果当前是裁剪工具
            // 检查是否点在某个裁剪控制点上
            this.activeCropHandle = this.cropRect ? this._getHandleAt(x, y) : null;

            if (this.activeCropHandle) { // 点在控制点上，开始调整大小
                this.isResizingCrop = true;
                this.isCropping = false;
                this.isMovingCrop = false;
                this.canvasEl.style.cursor = this._getResizeCursor(this.activeCropHandle); // 设置调整大小的光标
            } else if (this.cropRect && this._isPointInRect(x, y, this.cropRect)) { // 点在裁剪框内部（但不在控制点上），开始移动
                this.isMovingCrop = true;
                this.isCropping = false;
                this.isResizingCrop = false;
                this.canvasEl.style.cursor = 'grabbing'; // 设置抓取光标
                // 计算鼠标相对于裁剪框左上角的偏移，用于平滑移动
                this.cropMoveOffsetX = x - this.cropRect.x;
                this.cropMoveOffsetY = y - this.cropRect.y;
            } else { // 点在裁剪框外部，或裁剪框不存在，开始绘制新的裁剪框
                this.isCropping = true;
                this.isMovingCrop = false;
                this.isResizingCrop = false;
                this.cropRect = { x: this.startX, y: this.startY, w: 0, h: 0 }; // 初始化新裁剪框
                this.activeCropHandle = null;
                this.cropHandles = []; // 清空旧的控制点
                this.canvasEl.style.cursor = 'crosshair'; // 设置十字线光标
            }
        } else if (this.currentTool === 'drawRect') { // 如果当前是绘制矩形标记工具
            this.isDrawingMark = true; // 开始绘制标记
            this.currentMarkRect = { x: this.startX, y: this.startY, w: 0, h: 0 }; // 初始化新标记矩形
        }
    },

    /**
     * 处理 Canvas 上的鼠标移动 (mousemove) 事件。
     * 根据当前状态（裁剪、移动、调整大小、绘制标记），更新相应的矩形尺寸和位置，并重绘Canvas。
     * 同时处理鼠标按钮未按下时的光标样式更新。
     * @private
     * @param {MouseEvent} e - 鼠标事件对象。
     */
    _handleCanvasMouseMove: function(e) {
        if (!this.isEditorActive) return;

        // e.buttons === 1 表示鼠标左键按下 (对于mousemove事件)
        // e.type.startsWith('touch') 表示这是一个由touchmove转换来的事件，触摸时默认认为"按下"
        const isMouseButtonDown = e.buttons === 1;
        const isTouchEvent = e.type.startsWith('touch'); // 用于触摸事件的特殊处理

        // 如果鼠标按钮在移动过程中意外松开（例如，鼠标移出窗口后松开再移回）
        // 或者是一个非拖拽的mousemove事件，但状态仍是拖拽中，则重置拖拽状态
        if (!isMouseButtonDown && !isTouchEvent && (this.isCropping || this.isMovingCrop || this.isResizingCrop || this.isDrawingMark)) {
            // 这段逻辑主要用于处理鼠标在画布外松开按钮再移回画布内的情况，确保状态被正确重置
            this.isCropping = false;
            this.isMovingCrop = false;
            this.isResizingCrop = false;
            this.activeCropHandle = null;
            this.isDrawingMark = false;

            const rect = this.canvasEl.getBoundingClientRect();
            const scaleX = this.canvasEl.width / rect.width;
            const scaleY = this.canvasEl.height / rect.height;
            const currentX = (e.clientX - rect.left) * scaleX;
            const currentY = (e.clientY - rect.top) * scaleY;
            this._updateCursorStyle(currentX, currentY); // 更新光标
            this._redrawCanvas(); // 重绘以清除可能残留的绘制预览
            return;
        }

        const { x, y } = this._getCanvasCoordinates(e); // 获取当前Canvas坐标
        this.mouseX = x; // 更新当前鼠标位置
        this.mouseY = y;

        let needsRedraw = false; // 标记是否需要重绘
        const isActiveDrag = isMouseButtonDown || isTouchEvent; // 判断是否为有效拖拽操作

        if (this.currentTool === 'crop') { // 裁剪工具逻辑
            if (this.isResizingCrop && this.activeCropHandle && isActiveDrag) { // 调整裁剪框大小
                this._resizeCropRect(x, y); // 调用调整大小的函数
                needsRedraw = true;
            } else if (this.isMovingCrop && this.cropRect && isActiveDrag) { // 移动裁剪框
                this.cropRect.x = x - this.cropMoveOffsetX;
                this.cropRect.y = y - this.cropMoveOffsetY;
                // 限制裁剪框在Canvas边界内
                this.cropRect.x = Math.max(0, Math.min(this.cropRect.x, this.canvasEl.width - this.cropRect.w));
                this.cropRect.y = Math.max(0, Math.min(this.cropRect.y, this.canvasEl.height - this.cropRect.h));
                this._updateCropHandles(); // 更新控制点位置
                needsRedraw = true;
            } else if (this.isCropping && isActiveDrag) { // 绘制新的裁剪框
                this.cropRect.w = x - this.startX;
                this.cropRect.h = y - this.startY;
                needsRedraw = true;
            } else if (!isActiveDrag) { // 如果鼠标未按下（即普通移动，非拖拽）
                this._updateCursorStyle(x, y); // 更新光标样式
            }
        } else if (this.currentTool === 'drawRect') { // 绘制矩形标记工具逻辑
            if (this.isDrawingMark && isActiveDrag) { // 绘制标记矩形
                this.currentMarkRect.w = x - this.startX;
                this.currentMarkRect.h = y - this.startY;
                needsRedraw = true;
            } else if (!isActiveDrag && !this.isDrawingMark) { // 鼠标未按下且未在绘制中
                this.canvasEl.style.cursor = 'crosshair'; // 保持十字线光标
            }
        }

        if (needsRedraw) {
            this._redrawCanvas(); // 如果有变化，则重绘Canvas
        }
    },

    /**
     * 根据当前鼠标位置和编辑器状态（例如是否有裁剪框，鼠标是否在控制点上）
     * 更新 Canvas 的光标样式。
     * 此函数在非拖拽状态下（鼠标移动但未按下时）调用。
     * @private
     * @param {number} mouseX - 当前鼠标在Canvas内的X坐标。
     * @param {number} mouseY - 当前鼠标在Canvas内的Y坐标。
     */
    _updateCursorStyle: function(mouseX, mouseY) {
        // 如果正在进行任何拖拽操作，光标样式已在 mousedown 或 drag 过程中设置，此处不应覆盖
        if (this.isCropping || this.isMovingCrop || this.isResizingCrop || this.isDrawingMark) {
            return;
        }

        if (this.currentTool === 'crop') { // 裁剪工具
            if (this.cropRect) { // 如果存在裁剪框
                const handle = this._getHandleAt(mouseX, mouseY); // 检查是否在控制点上
                if (handle) {
                    this.canvasEl.style.cursor = this._getResizeCursor(handle); // 设置调整大小光标
                } else if (this._isPointInRect(mouseX, mouseY, this.cropRect)) { // 是否在裁剪框内部
                    this.canvasEl.style.cursor = 'grab'; // 设置可抓取光标
                } else {
                    this.canvasEl.style.cursor = 'crosshair'; // 在外部，准备绘制新裁剪框的光标
                }
            } else { // 不存在裁剪框
                this.canvasEl.style.cursor = 'crosshair'; // 准备绘制新裁剪框的光标
            }
        } else if (this.currentTool === 'drawRect') { // 绘制矩形标记工具
            this.canvasEl.style.cursor = 'crosshair'; // 十字线光标
        } else { // 没有激活工具或未知工具
            this.canvasEl.style.cursor = 'default'; // 默认光标
        }
    },

    /**
     * 处理 Canvas 上的鼠标松开 (mouseup) 事件。
     * 完成当前的裁剪、移动/调整大小或绘制标记操作。
     * 对于裁剪，会进行尺寸合法性检查和标准化。
     * 对于标记，会将有效的标记添加到 `marks` 数组中，并考虑裁剪区域。
     * @private
     * @param {MouseEvent} e - 鼠标事件对象。
     */
    _handleCanvasMouseUp: function(e) {
        if (!this.isEditorActive) return;

        if (this.currentTool === 'crop' && (this.isCropping || this.isMovingCrop || this.isResizingCrop)) {
            // 裁剪操作结束
            if (this.cropRect) {
                // 标准化裁剪框，确保宽度和高度为正值
                if (this.cropRect.w < 0) { this.cropRect.x += this.cropRect.w; this.cropRect.w *= -1; }
                if (this.cropRect.h < 0) { this.cropRect.y += this.cropRect.h; this.cropRect.h *= -1; }

                // 检查裁剪框是否过小
                if (this.cropRect.w < this.minCropSize || this.cropRect.h < this.minCropSize) {
                    if (this.isCropping) { // 如果是新绘制的过小裁剪框
                        Utils.log("New crop rectangle is too small. Discarding crop.", Utils.logLevels.DEBUG);
                        // 仅当用户尝试裁剪一个比原图小的区域，或者明确裁剪出小于最小尺寸的区域时提示
                        if (this.rawImage && (this.cropRect.w < this.rawImage.width || this.cropRect.h < this.rawImage.height || this.cropRect.w < this.minCropSize || this.cropRect.h < this.minCropSize)) {
                            NotificationUIManager.showNotification('裁剪区域过小，请重新选择。', 'warn');
                        }
                        this.cropRect = null; // 抛弃过小的裁剪框
                        this.cropHandles = [];
                    } else { // 如果是通过调整大小或移动导致过小，则强制设为最小尺寸
                        this.cropRect.w = Math.max(this.minCropSize, this.cropRect.w);
                        this.cropRect.h = Math.max(this.minCropSize, this.cropRect.h);
                        // 确保调整后的矩形仍在画布内
                        this.cropRect.x = Math.max(0, Math.min(this.cropRect.x, this.canvasEl.width - this.cropRect.w));
                        this.cropRect.y = Math.max(0, Math.min(this.cropRect.y, this.canvasEl.height - this.cropRect.h));
                    }
                }
            }
            if (this.cropRect) { // 如果裁剪框有效，更新控制点
                this._updateCropHandles();
            }
        } else if (this.currentTool === 'drawRect' && this.isDrawingMark && this.currentMarkRect) {
            // 标记绘制操作结束
            // 标准化标记矩形
            if (this.currentMarkRect.w < 0) { this.currentMarkRect.x += this.currentMarkRect.w; this.currentMarkRect.w *= -1; }
            if (this.currentMarkRect.h < 0) { this.currentMarkRect.y += this.currentMarkRect.h; this.currentMarkRect.h *= -1; }

            let markToAdd = {
                ...this.currentMarkRect,
                color: this.currentMarkColor,
                lineWidth: this.DEFAULT_MARK_LINE_WIDTH,
                type: 'rect' // 标记类型
            };

            // 如果存在裁剪区域，则将标记裁剪到该区域内
            if (this.cropRect) {
                const clippedMark = this._clipRectToArea(markToAdd, this.cropRect);
                if (clippedMark) {
                    markToAdd = { ...clippedMark, color: markToAdd.color, lineWidth: markToAdd.lineWidth, type: 'rect' };
                } else {
                    markToAdd = null; // 标记完全在裁剪区域之外
                }
            }

            // 仅添加有效尺寸的标记 (大于5x5像素)
            if (markToAdd && markToAdd.w > 5 && markToAdd.h > 5) {
                this.marks.push(markToAdd);
            } else if (markToAdd) { // 标记过小（可能因裁剪导致）
                Utils.log("Mark rectangle too small (possibly after clipping), not added.", Utils.logLevels.DEBUG);
            } else if (this.cropRect) { // 标记在裁剪区外
                Utils.log("Mark was outside crop area, not added.", Utils.logLevels.DEBUG);
            }
            this.currentMarkRect = null; // 清空当前绘制的标记矩形
        }

        // 重置所有拖拽/绘制状态
        this.isCropping = false;
        this.isMovingCrop = false;
        this.isResizingCrop = false;
        this.activeCropHandle = null;
        this.isDrawingMark = false;

        // 更新光标样式
        const { x, y } = this._getCanvasCoordinates(e);
        this._updateCursorStyle(x, y);

        this._redrawCanvas(); // 最终重绘Canvas
    },

    /**
     * 处理 Canvas 上的鼠标离开 (mouseleave) 事件。
     * 如果鼠标在按下状态下离开Canvas，则视为操作结束（等同于mouseup）。
     * 否则，如果鼠标在非拖拽状态下移出，则重置光标为默认。
     * @private
     * @param {MouseEvent} e - 鼠标事件对象。
     */
    _handleCanvasMouseLeave: function(e) {
        if (!this.isEditorActive) return;
        // e.buttons === 1 表示鼠标左键仍处于按下状态
        // !e.type.startsWith('touch') 确保这不是触摸事件（触摸事件有自己的 touchend）
        if (e.buttons === 1 && !e.type.startsWith('touch')) { // 鼠标按下状态离开画布
            // 如果正在进行任何拖拽操作，则模拟一次 mouseup 来结束操作
            if (this.isCropping || this.isMovingCrop || this.isResizingCrop || this.isDrawingMark) {
                this._handleCanvasMouseUp(e);
            }
        }
        // 如果不是任何拖拽状态（例如，只是普通鼠标悬停移出）
        if (!this.isDrawingMark && !this.isCropping && !this.isMovingCrop && !this.isResizingCrop) {
            const { x, y } = this._getCanvasCoordinates(e); // 获取坐标判断是否真的移出
            // 确保坐标确实超出了画布范围才重置光标，因为 mouseleave 可能在画布边缘附近触发
            if (x < 0 || x > this.canvasEl.width || y < 0 || y > this.canvasEl.height) {
                this.canvasEl.style.cursor = 'default'; // 重置光标为默认
            } else {
                // 如果仍在画布内（可能是由于事件触发顺序或精度问题），则尝试更新光标
                this._updateCursorStyle(x,y);
            }
        }
    },

    /**
     * 处理 Canvas 上的触摸开始 (touchstart) 事件。
     * 阻止默认行为（如页面滚动），并将事件传递给鼠标按下处理逻辑。
     * @private
     * @param {TouchEvent} e - 触摸事件对象。
     */
    _handleCanvasTouchStart: function(e) {
        if (e.touches.length === 1) { // 仅处理单点触摸
            e.preventDefault(); // 阻止默认的触摸行为 (如滚动、缩放)
            this._handleCanvasMouseDown(e.touches[0]); // 将第一个触点信息传递给 mousedown 处理器
        }
    },
    /**
     * 处理 Canvas 上的触摸移动 (touchmove) 事件。
     * 阻止默认行为，并将事件传递给鼠标移动处理逻辑。
     * @private
     * @param {TouchEvent} e - 触摸事件对象。
     */
    _handleCanvasTouchMove: function(e) {
        if (e.touches.length === 1) { // 仅处理单点触摸
            e.preventDefault(); // 阻止默认的触摸行为
            this._handleCanvasMouseMove(e.touches[0]); // 将第一个触点信息传递给 mousemove 处理器
        }
    },
    /**
     * 处理 Canvas 上的触摸结束 (touchend) 事件。
     * 阻止默认行为，并将事件传递给鼠标松开处理逻辑。
     * @private
     * @param {TouchEvent} e - 触摸事件对象。
     */
    _handleCanvasTouchEnd: function(e) {
        if (e.changedTouches.length === 1) { // 通常 touchend 使用 changedTouches
            e.preventDefault(); // 阻止默认的触摸行为
            this._handleCanvasMouseUp(e.changedTouches[0]); // 将变化的触点信息传递给 mouseup 处理器
        }
    },

    /**
     * 根据当前的 `cropRect` 更新裁剪框的8个控制点的位置。
     * 控制点用于调整裁剪框的大小。
     * @private
     */
    _updateCropHandles: function() {
        if (!this.cropRect) { // 如果没有裁剪框，则清空控制点
            this.cropHandles = [];
            return;
        }
        const { x, y, w, h } = this.cropRect;
        // 定义8个控制点及其ID和坐标
        this.cropHandles = [
            { id: 'tl', x: x, y: y },                         // Top-Left (左上)
            { id: 'tm', x: x + w / 2, y: y },                 // Top-Middle (上中)
            { id: 'tr', x: x + w, y: y },                     // Top-Right (右上)
            { id: 'ml', x: x, y: y + h / 2 },                 // Middle-Left (左中)
            { id: 'mr', x: x + w, y: y + h / 2 },             // Middle-Right (右中)
            { id: 'bl', x: x, y: y + h },                     // Bottom-Left (左下)
            { id: 'bm', x: x + w / 2, y: y + h },             // Bottom-Middle (下中)
            { id: 'br', x: x + w, y: y + h }                  // Bottom-Right (右下)
        ];
    },
    /**
     * 在 Canvas 上绘制裁剪框的控制点。
     * 仅当裁剪工具激活且存在裁剪框时绘制。
     * @private
     */
    _drawCropHandles: function() {
        // 如果没有裁剪框，或控制点未计算，或当前工具不是裁剪，则不绘制
        if (!this.cropRect || !this.cropHandles || this.cropHandles.length === 0 || this.currentTool !== 'crop') return;
        // 如果正在从头绘制新裁剪框且其宽或高为0，则不绘制控制点（避免在起始点绘制）
        if (this.isCropping && (this.cropRect.w === 0 || this.cropRect.h === 0)) return;

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // 控制点填充色
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';    // 控制点边框色
        this.ctx.lineWidth = 1;                         // 控制点边框宽度
        const handleSize = 8;                           // 控制点大小 (像素)

        this.cropHandles.forEach(handle => {
            // 绘制小方块作为控制点
            this.ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
            this.ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
        });
    },
    /**
     * 根据给定的鼠标坐标，判断是否位于某个裁剪控制点上。
     * @private
     * @param {number} mouseX - 鼠标X坐标。
     * @param {number} mouseY - 鼠标Y坐标。
     * @returns {string|null} 如果在控制点上，返回控制点ID (如 'tl', 'br')；否则返回 null。
     */
    _getHandleAt: function(mouseX, mouseY) {
        // 仅在裁剪工具激活、存在控制点且非初始绘制状态时检查
        if (this.currentTool !== 'crop' || !this.cropHandles || this.cropHandles.length === 0) return null;
        if (this.isCropping) return null; // 如果正在绘制新裁剪框，不应响应控制点

        const handleSize = 12; // 判定区域比实际绘制的控制点稍大，以提高可点击性
        for (const handle of this.cropHandles) {
            // 检查鼠标坐标是否在控制点的感应区域内
            if (Math.abs(mouseX - handle.x) < handleSize / 2 && Math.abs(mouseY - handle.y) < handleSize / 2) {
                return handle.id; // 返回控制点ID
            }
        }
        return null; // 未命中任何控制点
    },
    /**
     * 检查一个点 (px, py) 是否位于一个矩形 (rect) 内部。
     * @private
     * @param {number} px - 点的X坐标。
     * @param {number} py - 点的Y坐标。
     * @param {object} rect - 矩形对象 {x, y, w, h}。
     * @returns {boolean} 如果点在矩形内，则为 true；否则为 false。
     */
    _isPointInRect: function(px, py, rect) {
        return rect && px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
    },
    /**
     * 根据活动的裁剪控制点ID，返回对应的CSS光标样式。
     * @private
     * @param {string} handleId - 控制点ID (例如 'tl', 'tm', 'br')。
     * @returns {string} CSS cursor 属性值。
     */
    _getResizeCursor: function(handleId) {
        switch (handleId) {
            case 'tl': case 'br': return 'nwse-resize'; // 左上和右下角：西北-东南方向调整
            case 'tr': case 'bl': return 'nesw-resize'; // 右上和左下角：东北-西南方向调整
            case 'tm': case 'bm': return 'ns-resize';   // 上中和下中：南北方向调整
            case 'ml': case 'mr': return 'ew-resize';   // 左中和右中：东西方向调整
            default: return 'default';                  // 默认光标
        }
    },
    /**
     * 根据鼠标当前位置和活动的控制点，调整裁剪矩形 (this.cropRect) 的大小和位置。
     * @private
     * @param {number} mouseX - 当前鼠标在Canvas内的X坐标。
     * @param {number} mouseY - 当前鼠标在Canvas内的Y坐标。
     */
    _resizeCropRect: function(mouseX, mouseY) {
        if (!this.activeCropHandle || !this.cropRect) return; // 无活动控制点或无裁剪框则返回

        // 解构赋值获取原始裁剪框属性
        const { x: originalX, y: originalY, w: originalW, h: originalH } = this.cropRect;

        // 初始化新的矩形属性为原始值
        let newX = originalX, newY = originalY, newW = originalW, newH = originalH;

        // 根据活动的控制点调整矩形属性
        switch (this.activeCropHandle) {
            case 'tl': // 左上角
                newW = originalX + originalW - mouseX; newH = originalY + originalH - mouseY;
                newX = mouseX; newY = mouseY;
                break;
            case 'tm': // 上中
                newH = originalY + originalH - mouseY; newY = mouseY;
                break;
            case 'tr': // 右上角
                newW = mouseX - originalX; newH = originalY + originalH - mouseY;
                newY = mouseY;
                break;
            case 'ml': // 左中
                newW = originalX + originalW - mouseX; newX = mouseX;
                break;
            case 'mr': // 右中
                newW = mouseX - originalX;
                break;
            case 'bl': // 左下角
                newW = originalX + originalW - mouseX; newH = mouseY - originalY;
                newX = mouseX;
                break;
            case 'bm': // 下中
                newH = mouseY - originalY;
                break;
            case 'br': // 右下角
                newW = mouseX - originalX; newH = mouseY - originalY;
                break;
        }

        // 临时变量用于处理负宽高和边界限制
        let tempX = newX, tempY = newY, tempW = newW, tempH = newH;

        // 如果宽度为负，调整x坐标并取绝对值
        if (tempW < 0) { tempX = tempX + tempW; tempW = Math.abs(tempW); }
        // 如果高度为负，调整y坐标并取绝对值
        if (tempH < 0) { tempY = tempY + tempH; tempH = Math.abs(tempH); }

        // 限制最小尺寸
        if (tempW < this.minCropSize) tempW = this.minCropSize;
        if (tempH < this.minCropSize) tempH = this.minCropSize;

        // 限制在Canvas边界内 - 左边界和上边界
        tempX = Math.max(0, tempX);
        tempY = Math.max(0, tempY);

        // 限制在Canvas边界内 - 右边界和下边界 (通过调整宽高)
        if (tempX + tempW > this.canvasEl.width) tempW = this.canvasEl.width - tempX;
        if (tempY + tempH > this.canvasEl.height) tempH = this.canvasEl.height - tempY;

        // 在边界限制后，再次确保不小于最小尺寸（因为边界限制可能导致尺寸再次变小）
        tempW = Math.max(this.minCropSize, tempW);
        tempH = Math.max(this.minCropSize, tempH);

        // 如果调整宽高后超出边界（例如，minCropSize导致），则反向调整X,Y坐标
        if (tempX + tempW > this.canvasEl.width) tempX = this.canvasEl.width - tempW;
        if (tempY + tempH > this.canvasEl.height) tempY = this.canvasEl.height - tempH;

        // 更新裁剪框的实际属性
        this.cropRect.x = tempX;
        this.cropRect.y = tempY;
        this.cropRect.w = tempW;
        this.cropRect.h = tempH;

        this._updateCropHandles(); // 更新控制点位置
    }
};