import { StateManager } from './stateManager.js';
import { VoiceService } from './VoiceService.js';
import { AIService } from './aiService.js';
import { TimelineManager } from './timeline.js';
import { TodoController } from './todoController.js';

export class AppController {
    constructor() {
        this.stateManager = new StateManager();
        this.voiceService = new VoiceService();
        this.aiService = new AIService();
        this.timelineManager = new TimelineManager(this.stateManager);
        this.todoController = new TodoController(this.stateManager);
        
        this.isListening = false;
        this.init();
    }

    // 初始化应用
    init() {
        this.bindEvents();
        this.switchRole('farmer');
        this.timelineManager.renderTimeline();
        
        // 检查语音支持
        if (!this.voiceService.recognition) {
            document.getElementById('voiceButton').disabled = true;
            document.getElementById('voiceButton').style.background = '#ccc';
        }

        // 暴露到全局以便HTML调用
        window.appController = this;
    }

    // 绑定事件
    bindEvents() {
        // 角色切换
        document.querySelectorAll('.role-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchRole(e.target.dataset.role);
            });
        });

        // 发送消息
        document.getElementById('sendButton').addEventListener('click', () => {
            this.sendMessage();
        });

        // 回车发送
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // 语音输入
        document.getElementById('voiceButton').addEventListener('click', () => {
            this.toggleVoiceInput();
        });

        // 下载
        document.getElementById('downloadButton').addEventListener('click', () => {
            this.todoController.downloadTodoList();
        });
    }

    // 切换角色
    switchRole(role) {
        this.stateManager.switchRole(role);
        const buttons = document.querySelectorAll('.role-btn');
        buttons.forEach(btn => {
            btn.style.opacity = '0.6';
        });
        document.querySelector(`.role-${role}`).style.opacity = '1';
        
        this.addSystemMessage(`已切换到${role === 'farmer' ? '农民' : '消费者'}模式`);
        this.updateDefaultPreferences();
    }

    // 更新默认偏好显示
    updateDefaultPreferences() {
        const prefs = this.stateManager.userPreferences[this.stateManager.currentRole];
        let html = '';
        
        if (this.stateManager.currentRole === 'farmer') {
            html = `
                <p class="preference-item"><strong>🌾 农民模式</strong></p>
                <p class="preference-item">地区：${prefs.region}</p>
                <p class="preference-item">作物：${prefs.crop}</p>
                <p class="preference-item"><em>可以询问：天气提醒、种植建议、商品上架</em></p>
            `;
        } else {
            html = `
                <p class="preference-item"><strong>🛒 消费者模式</strong></p>
                <p class="preference-item">地区：${prefs.region}</p>
                <p class="preference-item">价格偏好：${prefs.priceRange}</p>
                <p class="preference-item"><em>可以询问：商品搜索、价格对比、订单生成</em></p>
            `;
        }
        
        document.getElementById('summaryContent').innerHTML = html;
    }

    // 发送消息
    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message) return;

        this.addMessage(message, 'user');
        input.value = '';

        // 禁用输入区域
        document.querySelector('.input-area').classList.add('loading');

        try {
            const response = await this.aiService.sendChatMessage(message, this.stateManager.currentRole);
            
            this.addMessage(response.answer, 'ai');
            this.updatePanels(response.answer, response.evidence, response.timeline);
            
            // 语音播报AI回复
            this.voiceService.speakText(
                response.answer.replace('AI助手：', '').replace(/<strong>.*?<\/strong>/g, '')
            );
        } catch (error) {
            this.addMessage('抱歉，服务暂时不可用，请稍后重试。', 'ai');
        } finally {
            // 恢复输入区域
            document.querySelector('.input-area').classList.remove('loading');
        }
    }

    // 添加消息到聊天界面
    addMessage(text, sender, type = 'normal') {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        
        let className = `message ${sender}-message`;
        if (type === 'system') {
            className += ' system-message';
        }
        
        messageDiv.className = className;
        messageDiv.innerHTML = `<strong>${sender === 'user' ? '您' : 'AI助手'}：</strong> ${text}`;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        this.stateManager.addMessage(text, sender, type);
    }

    // 添加系统消息
    addSystemMessage(text) {
        this.addMessage(text, 'ai', 'system');
    }

    // 更新右侧面板
    updatePanels(answer, evidence, timeline) {
        // 更新结果摘要
        const summary = answer.split('<br>')[0].replace(/<strong>.*?<\/strong>/g, '');
        document.getElementById('summaryContent').innerHTML = `<p>${summary}</p>`;
        
        // 更新证据清单
        const evidenceContent = document.getElementById('evidenceContent');
        if (evidence && evidence.length > 0) {
            evidenceContent.innerHTML = evidence.map(item => 
                `<div class="evidence-item">${item}</div>`
            ).join('');
        } else {
            evidenceContent.innerHTML = '<div class="evidence-item">暂无证据数据</div>';
        }
        
        // 更新时间线
        this.timelineManager.renderTimeline(timeline);
    }

    // 切换语音输入
    toggleVoiceInput() {
        if (this.isListening) {
            this.voiceService.stopListening();
            this.isListening = false;
            document.getElementById('voiceButton').classList.remove('listening');
        } else {
            this.voiceService.startListening(
                (transcript) => {
                    document.getElementById('messageInput').value = transcript;
                    setTimeout(() => {
                        this.sendMessage();
                    }, 500);
                },
                (error) => {
                    this.updateVoiceStatus(error, 'error');
                },
                (message, type) => {
                    this.updateVoiceStatus(message, type);
                }
            );
            this.isListening = true;
        }
    }

    // 更新语音状态显示
    updateVoiceStatus(message, type) {
        const statusElement = document.getElementById('voiceStatus');
        statusElement.textContent = message;
        statusElement.className = 'voice-status';
        
        switch(type) {
            case 'listening':
                statusElement.classList.add('status-listening');
                document.getElementById('voiceButton').classList.add('listening');
                break;
            case 'error':
                statusElement.classList.add('status-error');
                document.getElementById('voiceButton').classList.remove('listening');
                this.isListening = false;
                break;
            case 'info':
                statusElement.classList.add('status-info');
                break;
        }
    }

    // 处理时间线任务切换（供HTML调用）
    handleToggleComplete(id) {
        this.timelineManager.handleToggleComplete(id);
    }

    // 更新待办状态（供HTML调用）
    updateTodoStatus(index) {
        this.todoController.updateTodoStatus(index);
    }
}