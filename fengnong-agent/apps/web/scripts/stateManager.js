// 应用状态管理
export class StateManager {
    constructor() {
        this.currentRole = 'farmer';
        this.chatHistory = [];
        this.todoStatus = new Map();
        this.userPreferences = {
            farmer: { 
                region: '武汉', 
                crop: '水稻',
                priceSensitivity: 'medium'
            },
            consumer: { 
                region: '武汉', 
                priceRange: '8元以下',
                preference: '本地直发'
            }
        };
        this.evidenceData = [];
        this.timelineData = [];
        this.currentTodos = [];
        
        // 测试数据
        this.testTimelineData = [
            {
                id: '1',
                time: '今天',
                event: '施肥作业',
                completed: true,
                description: '使用氮磷钾复合肥料'
            },
            {
                id: '2', 
                time: '明天',
                event: '病虫害巡查',
                completed: false,
                description: '重点检查叶片和茎干'
            },
            {
                id: '3',
                time: '后天', 
                event: '喷药防治',
                completed: false,
                description: '选择生物农药，注意稀释比例'
            }
        ];
    }

    // 切换角色
    switchRole(role) {
        this.currentRole = role;
        this.notifyObservers('roleChanged', role);
    }

    // 添加聊天消息
    addMessage(text, sender, type = 'normal') {
        const message = { text, sender, type, timestamp: new Date() };
        this.chatHistory.push(message);
        this.notifyObservers('messageAdded', message);
    }

    // 更新待办状态
    updateTodoStatus(index, completed) {
        this.todoStatus.set(index, completed);
        this.notifyObservers('todoStatusChanged', { index, completed });
    }

    // 更新时间线数据
    updateTimelineData(data) {
        this.timelineData = data;
        this.notifyObservers('timelineUpdated', data);
    }

    // 更新证据数据
    updateEvidenceData(data) {
        this.evidenceData = data;
        this.notifyObservers('evidenceUpdated', data);
    }

    // 观察者模式
    observers = new Map();

    addObserver(event, callback) {
        if (!this.observers.has(event)) {
            this.observers.set(event, []);
        }
        this.observers.get(event).push(callback);
    }

    removeObserver(event, callback) {
        if (this.observers.has(event)) {
            const callbacks = this.observers.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    notifyObservers(event, data) {
        if (this.observers.has(event)) {
            this.observers.get(event).forEach(callback => {
                callback(data);
            });
        }
    }
}