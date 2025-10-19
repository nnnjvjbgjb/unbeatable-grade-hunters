export class TodoController {
    constructor(stateManager) {
        this.stateManager = stateManager;
    }

    // 更新待办状态
    updateTodoStatus(index) {
        const checkbox = document.getElementById(`todo-${index}`);
        const label = checkbox.nextElementSibling;
        const isCompleted = checkbox.checked;
        
        if (isCompleted) {
            label.parentElement.classList.add('completed');
            this.stateManager.updateTodoStatus(index, true);
        } else {
            label.parentElement.classList.remove('completed');
            this.stateManager.updateTodoStatus(index, false);
        }
        
        // 通知时间线管理器更新进度
        if (window.appController && window.appController.timelineManager) {
            window.appController.timelineManager.updateProgress();
        }
    }

    // 编辑待办事项
    editTodoItem(index) {
        const currentTodo = this.stateManager.currentTodos[index];
        const newTodo = prompt('编辑待办事项:', currentTodo);
        
        if (newTodo && newTodo.trim() !== '') {
            this.stateManager.currentTodos[index] = newTodo.trim();
            
            // 重新渲染时间线以更新待办事项
            if (window.appController && window.appController.timelineManager) {
                window.appController.timelineManager.renderTimeline();
            }
        }
    }

    // 添加新的待办事项
    addTodoItem(todoText) {
        if (todoText && todoText.trim() !== '') {
            this.stateManager.currentTodos.push(todoText.trim());
            
            // 重新渲染时间线以更新待办事项
            if (window.appController && window.appController.timelineManager) {
                window.appController.timelineManager.renderTimeline();
            }
        }
    }

    // 删除待办事项
    deleteTodoItem(index) {
        if (confirm('确定要删除这个待办事项吗？')) {
            this.stateManager.currentTodos.splice(index, 1);
            this.stateManager.todoStatus.delete(index);
            
            // 重新整理todoStatus的索引
            const newTodoStatus = new Map();
            this.stateManager.todoStatus.forEach((value, key) => {
                if (key > index) {
                    newTodoStatus.set(key - 1, value);
                } else if (key < index) {
                    newTodoStatus.set(key, value);
                }
            });
            this.stateManager.todoStatus = newTodoStatus;
            
            // 重新渲染时间线以更新待办事项
            if (window.appController && window.appController.timelineManager) {
                window.appController.timelineManager.renderTimeline();
            }
        }
    }

    // 下载待办清单
    downloadTodoList() {
        const timelineData = window.appController.timelineManager.getDefaultTimelineData();
        const completedCount = timelineData.filter(item => item.completed).length;
        const totalCount = timelineData.length;
        const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        
        const todoCompletedCount = Array.from(this.stateManager.todoStatus.values()).filter(status => status).length;
        const todoTotalCount = this.stateManager.currentTodos.length;
        const todoPercentage = todoTotalCount > 0 ? Math.round((todoCompletedCount / todoTotalCount) * 100) : 0;
        
        let content = `# 农业智能助手 - 工作清单\n\n`;
        content += `## 📊 总体进度\n`;
        content += `- 生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
        content += `- 时间线进度: ${completedCount}/${totalCount} (${progressPercentage}%)\n`;
        content += `- 待办事项进度: ${todoCompletedCount}/${todoTotalCount} (${todoPercentage}%)\n\n`;
        
        content += `## ⏰ 时间线任务\n\n`;
        
        // 按完成状态分组
        const completedTasks = timelineData.filter(item => item.completed);
        const pendingTasks = timelineData.filter(item => !item.completed);
        
        if (completedTasks.length > 0) {
            content += `### ✅ 已完成任务\n`;
            completedTasks.forEach((item, index) => {
                content += `${index + 1}. **${item.event}** - ${item.time}\n`;
                content += `   - 描述: ${item.description}\n`;
                if (item.tools && item.tools.length > 0) {
                    content += `   - 工具: ${item.tools.join(', ')}\n`;
                }
                content += `   - 耗时: ${item.duration}\n\n`;
            });
        }
        
        if (pendingTasks.length > 0) {
            content += `### ⏳ 待完成任务\n`;
            pendingTasks.forEach((item, index) => {
                const priorityIcon = item.priority === 'high' ? '🔴' : item.priority === 'medium' ? '🟡' : '🟢';
                const importantIcon = item.important ? '⭐ ' : '';
                content += `${index + 1}. ${importantIcon}${priorityIcon} **${item.event}** - ${item.time}\n`;
                content += `   - 描述: ${item.description}\n`;
                if (item.tools && item.tools.length > 0) {
                    content += `   - 工具: ${item.tools.join(', ')}\n`;
                }
                content += `   - 耗时: ${item.duration}\n\n`;
            });
        }
        
        content += `## 📝 待办事项\n\n`;
        
        if (this.stateManager.currentTodos.length > 0) {
            this.stateManager.currentTodos.forEach((todo, index) => {
                const isCompleted = this.stateManager.todoStatus.get(index) || false;
                const statusIcon = isCompleted ? '✅' : '⭕';
                content += `- [${isCompleted ? 'x' : ' '}] ${todo}\n`;
            });
        } else {
            content += `暂无待办事项\n`;
        }
        
        content += `\n## 💡 操作建议\n`;
        
        if (completedCount === totalCount && todoCompletedCount === todoTotalCount) {
            content += `🎉 恭喜！所有任务和待办事项都已完成！\n`;
        } else {
            const highPriorityPending = pendingTasks.filter(task => task.priority === 'high' && !task.completed);
            const importantPending = pendingTasks.filter(task => task.important && !task.completed);
            
            if (importantPending.length > 0) {
                content += `📋 **优先处理重要任务:**\n`;
                importantPending.forEach(task => {
                    content += `- ${task.event} (${task.time})\n`;
                });
                content += `\n`;
            }
            
            if (highPriorityPending.length > 0) {
                content += `🚨 **高优先级任务:**\n`;
                highPriorityPending.forEach(task => {
                    content += `- ${task.event} (${task.time})\n`;
                });
                content += `\n`;
            }
            
            const pendingTodos = Array.from(this.stateManager.todoStatus.entries())
                .filter(([index, completed]) => !completed)
                .map(([index]) => this.stateManager.currentTodos[index]);
                
            if (pendingTodos.length > 0) {
                content += `📝 **待办事项提醒:**\n`;
                pendingTodos.forEach(todo => {
                    content += `- ${todo}\n`;
                });
            }
        }

        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `农业工作清单_${new Date().toISOString().split('T')[0]}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }
}