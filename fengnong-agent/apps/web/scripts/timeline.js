export class TimelineManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.currentFilter = 'all'; // all, pending, completed, important
        this.init();
    }

    // 初始化
    init() {
        this.bindEvents();
    }

    // 绑定事件
    bindEvents() {
        // 过滤器事件将在渲染时动态绑定
    }

    // 渲染时间线
    renderTimeline(timelineData = [], todos = []) {
        const timelineContent = document.getElementById('timelineContent');
        
        if (!timelineData || timelineData.length === 0) {
            timelineData = this.getDefaultTimelineData();
        }
        
        let contentHTML = this.renderFilters();
        
        const filteredData = this.filterTimelineData(timelineData);
        
        if (filteredData.length === 0) {
            contentHTML += this.renderEmptyState();
        } else {
            contentHTML += filteredData.map((item, index) => this.renderTimelineItem(item, index, filteredData.length)).join('');
        }
        
        // 渲染待办事项
        if (todos && todos.length > 0) {
            this.stateManager.currentTodos = todos;
            contentHTML += this.renderTodoSection(todos);
        }
        
        timelineContent.innerHTML = contentHTML;
        this.updateProgress();
        this.bindFilterEvents();
    }

    // 获取默认时间线数据
    getDefaultTimelineData() {
        return [
            {
                id: '1',
                time: '今天 09:00',
                event: '施肥作业',
                completed: true,
                description: '使用氮磷钾复合肥料，每亩用量20kg',
                priority: 'high',
                important: false,
                duration: '2小时',
                tools: ['施肥机', '防护装备']
            },
            {
                id: '2', 
                time: '今天 14:00',
                event: '病虫害巡查',
                completed: false,
                description: '重点检查叶片和茎干，记录病虫害情况',
                priority: 'high',
                important: true,
                duration: '1小时',
                tools: ['放大镜', '记录本']
            },
            {
                id: '3',
                time: '明天 08:00', 
                event: '喷药防治',
                completed: false,
                description: '选择生物农药，注意稀释比例和安全间隔期',
                priority: 'medium',
                important: false,
                duration: '3小时',
                tools: ['喷雾器', '防护服']
            },
            {
                id: '4',
                time: '后天 10:00',
                event: '土壤检测',
                completed: false,
                description: '采集土壤样本送检，分析养分含量',
                priority: 'low',
                important: false,
                duration: '1.5小时',
                tools: ['土壤采样器', '样本袋']
            }
        ];
    }

    // 渲染过滤器
    renderFilters() {
        return `
            <div class="timeline-filters">
                <button class="filter-btn ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">全部</button>
                <button class="filter-btn ${this.currentFilter === 'pending' ? 'active' : ''}" data-filter="pending">待完成</button>
                <button class="filter-btn ${this.currentFilter === 'completed' ? 'active' : ''}" data-filter="completed">已完成</button>
                <button class="filter-btn ${this.currentFilter === 'important' ? 'active' : ''}" data-filter="important">重要</button>
            </div>
        `;
    }

    // 渲染时间线项
    renderTimelineItem(item, index, totalLength) {
        const isLast = index === totalLength - 1;
        const priorityClass = item.priority ? `priority-${item.priority}` : '';
        const dotClass = `timeline-dot ${item.completed ? 'completed' : ''} ${item.important ? 'important' : ''}`;
        const eventClass = `timeline-event ${item.completed ? 'completed' : ''}`;
        
        return `
            <div class="timeline-item ${item.completed ? 'completed' : ''}">
                <div class="timeline-line">
                    <div class="${dotClass}" onclick="appController.toggleTimelineItem('${item.id}')">
                        ${item.completed ? '✓' : (index + 1)}
                    </div>
                    ${!isLast ? `<div class="timeline-connector ${item.completed ? 'completed' : ''}"></div>` : ''}
                </div>
                <div class="timeline-content-right">
                    <div class="timeline-time">
                        ${item.time}
                        ${item.important ? '<span class="status-tag status-important">⭐ 重要</span>' : ''}
                        <span class="priority-indicator ${priorityClass}"></span>
                    </div>
                    <div class="${eventClass}">
                        ${item.event}
                        ${item.duration ? `<span style="font-size: 11px; color: #666;">(${item.duration})</span>` : ''}
                    </div>
                    ${item.description ? `<div class="timeline-description">${item.description}</div>` : ''}
                    <div class="timeline-meta">
                        <span class="status-tag ${item.completed ? 'status-completed' : 'status-pending'}">
                            ${item.completed ? '✅ 已完成' : '⏳ 待完成'}
                        </span>
                        ${item.tools && item.tools.length > 0 ? 
                            `<span>🛠️ ${item.tools.join(', ')}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // 渲染待办事项区域
    renderTodoSection(todos) {
        return `
            <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong>📝 待办事项</strong>
                    <span style="font-size: 11px; color: #666;">${this.getTodoProgress(todos)}</span>
                </div>
                ${todos.map((todo, index) => this.renderTodoItem(todo, index)).join('')}
            </div>
        `;
    }

    // 渲染待办事项项
    renderTodoItem(todo, index) {
        const isCompleted = this.stateManager.todoStatus.get(index) || false;
        return `
            <div class="todo-item ${isCompleted ? 'completed' : ''}">
                <input type="checkbox" id="todo-${index}" ${isCompleted ? 'checked' : ''} 
                       onchange="appController.updateTodoStatus(${index})">
                <label for="todo-${index}">${todo}</label>
                <button class="todo-edit-btn" onclick="appController.editTodoItem(${index})" 
                        style="margin-left: auto; background: none; border: none; cursor: pointer; font-size: 12px; color: #666;">
                    ✏️
                </button>
            </div>
        `;
    }

    // 渲染空状态
    renderEmptyState() {
        return `
            <div class="timeline-empty">
                <div class="empty-icon">📅</div>
                <div class="empty-text">暂无时间线数据</div>
                <div class="empty-subtext">开始对话后，时间线将显示在这里</div>
            </div>
        `;
    }

    // 过滤时间线数据
    filterTimelineData(data) {
        switch (this.currentFilter) {
            case 'pending':
                return data.filter(item => !item.completed);
            case 'completed':
                return data.filter(item => item.completed);
            case 'important':
                return data.filter(item => item.important);
            default:
                return data;
        }
    }

    // 绑定过滤器事件
    bindFilterEvents() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                this.setFilter(filter);
            });
        });
    }

    // 设置过滤器
    setFilter(filter) {
        this.currentFilter = filter;
        this.renderTimeline();
    }

    // 切换时间线项目状态
    toggleTimelineItem(id) {
        const timelineData = this.getDefaultTimelineData();
        const itemIndex = timelineData.findIndex(item => item.id === id);
        if (itemIndex !== -1) {
            timelineData[itemIndex].completed = !timelineData[itemIndex].completed;
            this.renderTimeline(timelineData);
        }
    }

    // 获取待办事项进度
    getTodoProgress(todos) {
        const completedCount = Array.from(this.stateManager.todoStatus.values()).filter(status => status).length;
        const totalCount = todos.length;
        const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        return `${completedCount}/${totalCount} (${percentage}%)`;
    }

    // 更新进度显示
    updateProgress() {
        const timelineData = this.getDefaultTimelineData();
        const completedCount = timelineData.filter(item => item.completed).length;
        const totalCount = timelineData.length;
        const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        
        const progressText = document.getElementById('progressText');
        const progressFill = document.getElementById('progressFill');
        
        if (progressText) {
            progressText.textContent = `${completedCount}/${totalCount} 完成 (${percentage}%)`;
        }
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
    }

    // 导出时间线数据
    exportTimelineData() {
        const timelineData = this.getDefaultTimelineData();
        const exportData = {
            timeline: timelineData,
            todos: this.stateManager.currentTodos,
            todoStatus: Object.fromEntries(this.stateManager.todoStatus),
            exportTime: new Date().toISOString(),
            progress: {
                completed: timelineData.filter(item => item.completed).length,
                total: timelineData.length,
                percentage: Math.round((timelineData.filter(item => item.completed).length / timelineData.length) * 100)
            }
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timeline_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}