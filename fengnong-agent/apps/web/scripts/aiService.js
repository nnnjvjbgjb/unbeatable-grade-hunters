// Mock API 服务
export class AIService {
    constructor() {
        this.baseURL = '/api';
    }

    // 模拟聊天API调用
    async sendChatMessage(message, role) {
        try {
            // 模拟网络延迟
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 调用Mock API
            const response = await fetch(`${this.baseURL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: message,
                    role: role
                })
            });

            if (!response.ok) {
                throw new Error(`API错误: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API调用失败:', error);
            // 返回模拟数据作为fallback
            return this.getMockResponse(message, role);
        }
    }

    // 获取模拟响应
    getMockResponse(message, role) {
        let response = {
            answer: '',
            timeline: [],
            artifacts: [],
            evidence: []
        };

        if (role === 'farmer') {
            if (message.includes('天气')) {
                response.answer = `🌤️ <strong>武汉未来7天天气预报：</strong><br>
                - 今天：晴，15-25°C<br>
                - 明天：多云，16-26°C<br>
                - 建议：适宜施肥，避开中午高温时段`;
                response.timeline = ['获取天气数据', '分析种植建议', '生成提醒'];
                response.evidence = ['中国天气网-武汉7天预报', '历史同期气温数据'];
            } else if (message.includes('上架')) {
                response.answer = `📦 <strong>上架草稿已生成：</strong><br>
                - 商品：麻花鸡蛋<br>
                - 价格：108元/箱<br>
                - 库存：100箱<br>
                - 建议卖点：农家散养，新鲜直达`;
                response.timeline = ['解析商品信息', '生成上架草稿', '价格建议分析'];
                response.evidence = ['平台价格参考数据', '同类商品销售数据'];
            } else if (message.includes('水稻') || message.includes('日历')) {
                response.answer = `📅 <strong>水稻分蘖期未来两周种植日历：</strong><br>
                - 第1-3天：追肥，保持浅水层<br>
                - 第4-7天：病虫害巡查<br>
                - 第8-14天：除草，控制水位`;
                response.timeline = ['分析作物阶段', '生成日历', '创建待办清单'];
                response.evidence = ['水稻生长周期数据', '当地气候数据', '农业专家建议'];
            } else {
                response.answer = `我理解您的需求了。作为农民助手，我可以帮您：<br>
                1. 查看天气和种植建议<br>
                2. 生成商品上架草稿<br>
                3. 管理作物日历和待办事项<br>
                4. 获取病虫害防治建议`;
            }
        } else {
            if (message.includes('番茄') || message.includes('搜索')) {
                response.answer = `🛒 <strong>找到3款武汉本地的有机番茄：</strong><br>
                - 有机番茄A：6.5元/斤，产地：黄陂<br>
                - 有机番茄B：7.2元/斤，产地：江夏<br>
                - 有机番茄C：7.8元/斤，产地：新洲<br>
                已为您生成订单草稿，请查看右侧面板`;
                response.timeline = ['搜索商品', '筛选结果', '生成订单草稿'];
                response.evidence = ['本地商品数据库', '价格对比数据', '用户评价数据'];
            } else {
                response.answer = `我理解您的需求了。作为消费助手，我可以帮您：<br>
                1. 搜索本地优质商品<br>
                2. 比价和生成订单<br>
                3. 查看商品溯源信息<br>
                4. 获取配送时效预估`;
            }
        }

        return response;
    }

    // 下载文件
    async downloadFile(filename) {
        try {
            const response = await fetch(`${this.baseURL}/download?filename=${filename}`);
            
            if (!response.ok) {
                throw new Error(`下载错误: ${response.status}`);
            }

            return await response.blob();
        } catch (error) {
            console.error('下载失败:', error);
            // 创建模拟文件作为fallback
            return this.createMockFile(filename);
        }
    }

    // 创建模拟文件
    createMockFile(filename) {
        const content = `# 农业待办事项清单\n\n生成时间：${new Date().toLocaleString()}\n\n## 待办事项\n- [ ] 施肥作业\n- [ ] 病虫害巡查\n- [ ] 喷药防治\n\n## 备注\n这是一个模拟的下载文件。`;
        return new Blob([content], { type: 'text/markdown' });
    }
}