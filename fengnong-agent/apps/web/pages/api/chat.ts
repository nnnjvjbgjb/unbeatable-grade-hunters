import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// ==================== 类型定义 ====================
interface ChatRequest {
  query: string;
  userId?: string;
}

interface ChatResponse {
  answer: string;
  timeline: TimelineStep[];
  artifacts: string[];
  evidence: string[];
}

interface TimelineStep {
  name: string;
  ok: boolean;
  latency_ms: number;
  summary: string;
  artifact?: string;
  error?: string;
}

interface PlanStep {
  reason: string;
  tool: string;
  args: Record<string, any>;
}

interface ExecutionPlan {
  steps: PlanStep[];
  guardrails: {
    write_to_sandbox_only: boolean;
    include_disclaimer?: boolean;
  };
}

interface ToolResult {
  success: boolean;
  output: any;
  evidence: string[];
  artifact?: string;
}

// ==================== Memory 服务 ====================
class MemoryService {
  private static memoryPath = path.join(process.cwd(), 'apps/web/sandbox/memory');
  
  static async loadUserPreferences(userId?: string): Promise<Record<string, any>> {
    if (!userId) return {};
    
    try {
      const filePath = path.join(this.memoryPath, `${userId}.json`);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('读取用户记忆失败:', error);
    }
    
    // 默认偏好
    return {
      region: '武汉',
      role: 'farmer', // farmer | consumer
      preferences: {
        local_first: true,
        seasonal_first: true,
        price_sensitive: true
      }
    };
  }
  
  static async saveConversation(userId: string, query: string, plan: ExecutionPlan, answer: string) {
    if (!userId) return;
    
    try {
      const filePath = path.join(this.memoryPath, `${userId}.json`);
      const existing = await this.loadUserPreferences(userId);
      
      const conversation = {
        timestamp: new Date().toISOString(),
        query,
        steps: plan.steps.map(step => step.tool),
        answer_summary: answer.substring(0, 100) + '...'
      };
      
      const updatedData = {
        ...existing,
        last_conversation: conversation,
        conversation_history: [
          conversation,
          ...(existing.conversation_history || []).slice(0, 9) // 保留最�?10�?
        ]
      };
      
      // 确保目录存在
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2));
    } catch (error) {
      console.error('保存对话记忆失败:', error);
    }
  }
}

// ==================== 计划�? (Planner) ====================
class Planner {
  static createPlan(query: string, userPreferences: Record<string, any>): ExecutionPlan {
    const lowerQuery = query.toLowerCase();
    const steps: PlanStep[] = [];
    let includeDisclaimer = false;

    // 规则1: 天气驱动的种植提�?
    if (this.isWeatherAdviceQuery(lowerQuery, userPreferences)) {
      includeDisclaimer = true;
      const city = this.extractCity(query) || userPreferences.region || '武汉';
      
      steps.push({
        reason: '获取天气信息以提供种植建�?',
        tool: 'weather.get_forecast',
        args: { city, days: 7 }
      });
      
      steps.push({
        reason: '基于天气和作物信息生成农业建�?',
        tool: 'agro.generate_advice',
        args: { 
          city,
          crop: this.extractCrop(query),
          stage: this.extractGrowthStage(query)
        }
      });
    }
    
    // 规则2: 物美价廉推荐 + 订单草稿
    else if (this.isShoppingQuery(lowerQuery)) {
      const region = userPreferences.region || '武汉';
      const maxPrice = this.extractPrice(query);
      
      steps.push({
        reason: '搜索符合条件的商�?',
        tool: 'commerce.catalog_search',
        args: { 
          query: this.extractProductQuery(query),
          region,
          max_price: maxPrice,
          local_first: userPreferences.preferences?.local_first ?? true,
          seasonal_first: userPreferences.preferences?.seasonal_first ?? true
        }
      });
      
      steps.push({
        reason: '为选中的商品生成订单草�?',
        tool: 'commerce.create_order_draft',
        args: {
          buyer: userPreferences.userId || 'default_user',
          items: [], // 将由执行器填�?
          address: `${region}市`
        }
      });
    }
    
    // 规则3: 一键上架草�?
    else if (this.isListingQuery(lowerQuery)) {
      const productInfo = this.extractProductInfo(query);
      
      steps.push({
        reason: '生成商品上架草稿',
        tool: 'commerce.create_listing_draft',
        args: {
          seller: userPreferences.userId || 'default_farmer',
          title: productInfo.title,
          price: productInfo.price,
          stock: productInfo.stock,
          origin: userPreferences.region || '武汉',
          description: productInfo.description
        }
      });
    }
    
    // 规则4: 作物日历和待�?
    else if (this.isCropCalendarQuery(lowerQuery)) {
      includeDisclaimer = true;
      
      steps.push({
        reason: '获取作物生长阶段信息',
        tool: 'agro.get_crop_calendar',
        args: {
          crop: this.extractCrop(query),
          stage: this.extractGrowthStage(query),
          days: 14
        }
      });
    }
    
    // 默认规则: 通用查询
    else {
      steps.push({
        reason: '分析用户意图并寻找合适工�?',
        tool: 'general.analyze_intent',
        args: { query, user_preferences: userPreferences }
      });
      
      steps.push({
        reason: '执行核心任务',
        tool: 'general.execute_task',
        args: { query, context: 'agriculture_commerce' }
      });
    }

    // 确保不超�?4�?
    const finalSteps = steps.slice(0, 4);
    
    return {
      steps: finalSteps,
      guardrails: {
        write_to_sandbox_only: true,
        include_disclaimer: includeDisclaimer
      }
    };
  }

  // ==================== 查询分类方法 ====================
  private static isWeatherAdviceQuery(query: string, preferences: any): boolean {
    const weatherWords = ['天气', '下雨', '暴雨', '高温', '霜冻', '施肥', '喷药', '种植'];
    const cropWords = ['水稻', '番茄', '蔬菜', '作物', '种植'];
    
    return weatherWords.some(word => query.includes(word)) && 
           (cropWords.some(word => query.includes(word)) || preferences.role === 'farmer');
  }

  private static isShoppingQuery(query: string): boolean {
    const shoppingWords = ['�?', '购买', '�?', '搜索', '推荐', '订单', '番茄', '蔬菜', '水果'];
    return shoppingWords.some(word => query.includes(word));
  }

  private static isListingQuery(query: string): boolean {
    const listingWords = ['上架', '出售', '�?', '发布', '商品', '麻花', '鸡蛋', '�?'];
    return listingWords.some(word => query.includes(word));
  }

  private static isCropCalendarQuery(query: string): boolean {
    const calendarWords = ['日历', '待办', '日程', '计划', '分蘖�?', '播种', '施肥'];
    return calendarWords.some(word => query.includes(word));
  }

  // ==================== 信息提取方法 ====================
  private static extractCity(query: string): string | null {
    const cities = ['北京', '上海', '广州', '深圳', '武汉', '杭州', '成都', '南京'];
    return cities.find(city => query.includes(city)) || null;
  }

  private static extractCrop(query: string): string {
    const crops = ['水稻', '番茄', '蔬菜', '水果', '玉米', '小麦'];
    return crops.find(crop => query.includes(crop)) || '作物';
  }

  private static extractGrowthStage(query: string): string {
    if (query.includes('分蘖�?')) return '分蘖�?';
    if (query.includes('播种')) return '播种�?';
    if (query.includes('收获')) return '成熟�?';
    return '生长�?';
  }

  private static extractPrice(query: string): number | undefined {
    const priceMatch = query.match(/(\d+(?:\.\d+)?)\s*�?/);
    return priceMatch ? parseFloat(priceMatch[1]) : undefined;
  }

  private static extractProductQuery(query: string): string {
    // 提取商品关键�?
    const products = ['番茄', '鸡蛋', '麻花', '蔬菜', '水果', '大米'];
    const found = products.find(product => query.includes(product));
    return found || '商品';
  }

  private static extractProductInfo(query: string): { title: string; price: number; stock: number; description: string } {
    const priceMatch = query.match(/(\d+)\s*�?/);
    const stockMatch = query.match(/(\d+)\s*�?/);
    
    return {
      title: this.extractProductQuery(query),
      price: priceMatch ? parseInt(priceMatch[1]) : 100,
      stock: stockMatch ? parseInt(stockMatch[1]) : 10,
      description: '新鲜农产�?'
    };
  }
}

// ==================== 执行�? (Executor) ====================
class Executor {
  private static circuitBreaker = new Map<string, { failures: number; lastFailure: number }>();
  private static readonly MAX_RETRIES = 2;
  private static readonly TIMEOUT_MS = 30000;

  static async executePlan(plan: ExecutionPlan, userId?: string): Promise<{
    results: ToolResult[];
    timeline: TimelineStep[];
  }> {
    const results: ToolResult[] = [];
    const timeline: TimelineStep[] = [];

    for (const step of plan.steps) {
      const startTime = Date.now();
      let stepResult: ToolResult;
      
      try {
        // 参数校验
        this.validateStep(step);
        
        // 检查熔断器
        if (this.isCircuitOpen(step.tool)) {
          throw new Error(`工具 ${step.tool} 暂时不可用（熔断状态）`);
        }

        // 执行工具（带重试机制�?
        stepResult = await this.executeWithRetry(step, userId);
        
        // 沙盒写入校验
        if (stepResult.artifact && !this.validateSandboxWrite(stepResult.artifact)) {
          throw new Error(`沙盒写入路径不合�?: ${stepResult.artifact}`);
        }
        
        // 记录成功
        this.recordSuccess(step.tool);
        
        timeline.push({
          name: step.tool,
          ok: true,
          latency_ms: Date.now() - startTime,
          summary: this.generateSummary(step, stepResult),
          artifact: stepResult.artifact
        });

      } catch (error) {
        // 记录失败
        this.recordFailure(step.tool);
        
        stepResult = {
          success: false,
          output: null,
          evidence: [`错误: ${error instanceof Error ? error.message : '未知错误'}`],
          artifact: undefined
        };
        
        timeline.push({
          name: step.tool,
          ok: false,
          latency_ms: Date.now() - startTime,
          summary: `执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
      
      results.push(stepResult);
    }

    return { results, timeline };
  }

  private static async executeWithRetry(step: PlanStep, userId?: string): Promise<ToolResult> {
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await this.executeSingleStep(step, userId);
      } catch (error) {
        if (attempt === this.MAX_RETRIES) {
          throw error;
        }
        // 等待后重�?
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    throw new Error('重试次数用尽');
  }

  private static async executeSingleStep(step: PlanStep, userId?: string): Promise<ToolResult> {
    // 模拟 MCP 工具调用 - 实际项目中这里会调用真实�? MCP 服务�?
    return await this.withTimeout(
      this.mockToolCall(step, userId),
      this.TIMEOUT_MS,
      `工具 ${step.tool} 执行超时`
    );
  }

  private static async mockToolCall(step: PlanStep, userId?: string): Promise<ToolResult> {
    // 模拟工具执行时间
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    const toolHandlers: Record<string, (args: any) => ToolResult> = {
      'weather.get_forecast': (args) => this.mockWeatherForecast(args),
      'commerce.catalog_search': (args) => this.mockCatalogSearch(args),
      'commerce.create_order_draft': (args) => this.mockCreateOrderDraft(args, userId),
      'commerce.create_listing_draft': (args) => this.mockCreateListingDraft(args, userId),
      'agro.generate_advice': (args) => this.mockGenerateAdvice(args),
      'agro.get_crop_calendar': (args) => this.mockGetCropCalendar(args),
      'general.analyze_intent': (args) => this.mockAnalyzeIntent(args),
      'general.execute_task': (args) => this.mockExecuteTask(args)
    };

    const handler = toolHandlers[step.tool] || this.mockGenericTool;
    return handler(step.args);
  }

  // ==================== Mock 工具实现 ====================
  private static mockWeatherForecast(args: any): ToolResult {
    return {
      success: true,
      output: {
        city: args.city,
        days: args.days,
        forecast: [
          { date: '2024-01-20', condition: '�?', temp: '15-25°C' },
          { date: '2024-01-21', condition: '多云', temp: '16-26°C' }
        ],
        mock: true
      },
      evidence: [`weather(${args.city}) mock=true`],
      artifact: undefined
    };
  }

  private static mockCatalogSearch(args: any): ToolResult {
    const items = [
      {
        id: '1',
        title: '武汉本地有机番茄',
        price: 7.5,
        origin: '武汉',
        tags: ['本地直发', '有机', '当季'],
        premium: -6.25 // 比均价便�?6.25%
      },
      {
        id: '2', 
        title: '新鲜番茄',
        price: 8.0,
        origin: '周边',
        tags: ['新鲜'],
        premium: 0
      }
    ].filter(item => 
      (!args.max_price || item.price <= args.max_price) &&
      (!args.region || item.origin.includes(args.region))
    );

    return {
      success: true,
      output: { items, total: items.length },
      evidence: ['products.csv(updated:2024-01-18)'],
      artifact: undefined
    };
  }

  private static mockCreateOrderDraft(args: any, userId?: string): ToolResult {
    const artifactPath = `apps/web/sandbox/orders/DRAFT-${userId}-${Date.now()}.json`;
    
    // 模拟写入文件
    const orderData = {
      buyer: args.buyer,
      items: args.items || [{ id: '1', title: '有机番茄', price: 7.5, quantity: 1 }],
      address: args.address,
      total_amount: 7.5,
      created_at: new Date().toISOString()
    };
    
    this.writeToSandbox(artifactPath, orderData);
    
    return {
      success: true,
      output: { path: artifactPath, amount: 7.5 },
      evidence: ['order_draft_created'],
      artifact: artifactPath
    };
  }

  private static mockCreateListingDraft(args: any, userId?: string): ToolResult {
    const artifactPath = `apps/web/sandbox/listings/LIST-${userId}-${Date.now()}.json`;
    
    const listingData = {
      seller: args.seller,
      title: args.title,
      price: args.price,
      stock: args.stock,
      origin: args.origin,
      description: args.description,
      created_at: new Date().toISOString(),
      status: 'draft'
    };
    
    this.writeToSandbox(artifactPath, listingData);
    
    return {
      success: true,
      output: { path: artifactPath },
      evidence: ['listing_draft_created'],
      artifact: artifactPath
    };
  }

  private static mockGenerateAdvice(args: any): ToolResult {
    const artifactPath = `apps/web/sandbox/notes/advice-${Date.now()}.md`;
    
    const advice = `# 农业建议 - ${args.city} - ${args.crop}

## 当前天气情况
- 未来7天以晴好天气为主
- 温度适宜，适合${args.crop}生长

## 种植建议
1. 近期可进行追肥作�?
2. 注意田间水分管理
3. 定期巡查病虫害情�?

## 免责声明
本建议仅供参考，具体操作请咨询专业农技师。`;
    
    this.writeToSandbox(artifactPath, advice);
    
    return {
      success: true,
      output: { advice: advice.substring(0, 200) + '...' },
      evidence: [`weather(${args.city})`, 'crops.json'],
      artifact: artifactPath
    };
  }

  private static mockGetCropCalendar(args: any): ToolResult {
    const artifactPath = `apps/web/sandbox/notes/calendar-${Date.now()}.md`;
    
    const calendar = `# ${args.crop} ${args.stage} 作物日历 - 未来${args.days}�?

## 每日待办清单
- �?1�?: 田间巡查，检查水分状�?
- �?2�?: 追肥作业
- �?3�?: 病虫害预�?
- ...

## 注意事项
- 根据天气调整作业时间
- 记录作业情况和效�?

## 免责声明
本日历仅供参考，具体操作请咨询专业农技师。`;
    
    this.writeToSandbox(artifactPath, calendar);
    
    return {
      success: true,
      output: { calendar: calendar.substring(0, 200) + '...' },
      evidence: ['crops.json'],
      artifact: artifactPath
    };
  }

  private static mockAnalyzeIntent(args: any): ToolResult {
    return {
      success: true,
      output: { intent: 'general_query', confidence: 0.8 },
      evidence: ['intent_analysis'],
      artifact: undefined
    };
  }

  private static mockExecuteTask(args: any): ToolResult {
    return {
      success: true,
      output: { result: '任务执行完成', details: args.query },
      evidence: ['general_execution'],
      artifact: undefined
    };
  }

  private static mockGenericTool(args: any): ToolResult {
    return {
      success: true,
      output: { status: 'completed', tool_args: args },
      evidence: ['generic_tool'],
      artifact: undefined
    };
  }

  // ==================== 工具方法 ====================
  private static validateStep(step: PlanStep): void {
    if (!step.tool || !step.reason) {
      throw new Error('步骤缺少必要字段: tool �? reason');
    }
    
    // 工具特定的参数校�?
    const validators: Record<string, (args: any) => void> = {
      'weather.get_forecast': (args) => {
        if (!args.city) throw new Error('缺少必要参数: city');
      },
      'commerce.catalog_search': (args) => {
        if (!args.query) throw new Error('缺少必要参数: query');
      }
    };
    
    const validator = validators[step.tool];
    if (validator) {
      validator(step.args);
    }
  }

  private static withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
      )
    ]);
  }

  private static isCircuitOpen(tool: string): boolean {
    const state = this.circuitBreaker.get(tool);
    if (!state) return false;
    
    // 5分钟内失�?3次以上则熔断
    if (state.failures >= 3 && Date.now() - state.lastFailure < 300000) {
      return true;
    }
    
    return false;
  }

  private static recordFailure(tool: string): void {
    const state = this.circuitBreaker.get(tool) || { failures: 0, lastFailure: 0 };
    state.failures++;
    state.lastFailure = Date.now();
    this.circuitBreaker.set(tool, state);
  }

  private static recordSuccess(tool: string): void {
    this.circuitBreaker.delete(tool);
  }

  private static validateSandboxWrite(path: string): boolean {
    const allowedPaths = [
      'apps/web/sandbox/orders/',
      'apps/web/sandbox/listings/', 
      'apps/web/sandbox/notes/',
      'apps/web/sandbox/memory/'
    ];
    return allowedPaths.some(allowed => path.startsWith(allowed));
  }

  private static writeToSandbox(filePath: string, data: any): void {
    const fullPath = path.join(process.cwd(), filePath);
    const dir = path.dirname(fullPath);
    
    // 确保目录存在
    fs.mkdirSync(dir, { recursive: true });
    
    // 写入文件
    if (typeof data === 'string') {
      fs.writeFileSync(fullPath, data, 'utf8');
    } else {
      fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
    }
  }

  private static generateSummary(step: PlanStep, result: ToolResult): string {
    const summaries: Record<string, (args: any, output: any) => string> = {
      'weather.get_forecast': (args, output) => 
        `获取${args.city}${args.days}天天气预报`,
      'commerce.catalog_search': (args, output) => 
        `搜索"${args.query}"，找�?${output.items?.length || 0}个商品`,
      'commerce.create_order_draft': (args, output) => 
        `生成订单草稿，总金�?${output.amount}元`,
      'commerce.create_listing_draft': (args, output) => 
        `创建"${args.title}"上架草稿`,
      'agro.generate_advice': (args, output) => 
        `生成${args.crop}种植建议`,
      'agro.get_crop_calendar': (args, output) => 
        `生成${args.crop}${args.days}天作物日历`,
      'general.analyze_intent': (args, output) => 
        `分析用户意图: ${output.intent}`,
      'general.execute_task': (args, output) => 
        `执行通用任务`
    };

    const summaryFn = summaries[step.tool] || ((args, output) => `执行 ${step.tool}`);
    return summaryFn(step.args, result.output);
  }
}

// ==================== 回答生成�? ====================
class AnswerGenerator {
  static generateAnswer(
    query: string, 
    plan: ExecutionPlan, 
    results: ToolResult[], 
    timeline: TimelineStep[]
  ): string {
    const successfulSteps = timeline.filter(step => step.ok);
    
    if (successfulSteps.length === 0) {
      return '抱歉，任务执行失败。请检查网络连接或稍后重试�?';
    }

    // 根据任务类型生成不同的回�?
    if (plan.steps.some(step => step.tool === 'agro.generate_advice')) {
      const weatherResult = results.find(r => 
        timeline.find(t => t.name === 'weather.get_forecast' && t.ok)
      );
      const adviceResult = results.find(r => 
        timeline.find(t => t.name === 'agro.generate_advice' && t.ok)
      );
      
      return `根据${weatherResult?.output?.city || '当地'}的天气情况，为您生成种植建议。建议已保存，请查看详细内容�?${
        plan.guardrails.include_disclaimer ? '\n\n免责声明：本建议仅供参考，具体操作请咨询专业农技师�?' : ''
      }`;
    }

    if (plan.steps.some(step => step.tool === 'commerce.catalog_search')) {
      const searchResult = results.find(r => 
        timeline.find(t => t.name === 'commerce.catalog_search' && t.ok)
      );
      const orderResult = results.find(r => 
        timeline.find(t => t.name === 'commerce.create_order_draft' && t.ok)
      );
      
      const itemCount = searchResult?.output?.items?.length || 0;
      return `为您找到${itemCount}个符合条件的商品，已生成订单草稿。请确认订单信息后提交。`;
    }

    if (plan.steps.some(step => step.tool === 'commerce.create_listing_draft')) {
      const listingResult = results.find(r => 
        timeline.find(t => t.name === 'commerce.create_listing_draft' && t.ok)
      );
      
      return '商品上架草稿已生成，请查看并确认信息后发布�?';
    }

    if (plan.steps.some(step => step.tool === 'agro.get_crop_calendar')) {
      return '作物日历和待办清单已生成，请查看详细安排�?';
    }

    return `已完成您的请�?"${query}"。共执行${successfulSteps.length}个步骤，全部成功完成。`;
  }

  static collectEvidence(results: ToolResult[]): string[] {
    const evidence: string[] = [];
    
    for (const result of results) {
      if (result.evidence) {
        evidence.push(...result.evidence);
      }
    }
    
    // 去重并添加时间戳
    const uniqueEvidence = [...new Set(evidence)];
    return uniqueEvidence.map(ev => 
      ev.includes('mock=') ? ev : `${ev}(processed:${new Date().toISOString().split('T')[0]})`
    );
  }

  static collectArtifacts(results: ToolResult[]): string[] {
    const artifacts: string[] = [];
    
    for (const result of results) {
      if (result.artifact) {
        artifacts.push(result.artifact);
      }
    }
    
    return artifacts;
  }
}

// ==================== �? Handler 函数 ====================
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponse>
) {
  // 设置响应�?
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // 方法检�?
  if (req.method !== 'POST') {
    return res.status(405).json({
      answer: '只支�? POST 请求',
      timeline: [],
      artifacts: [],
      evidence: []
    });
  }

  try {
    const { query, userId }: ChatRequest = req.body;

    // 输入验证
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        answer: '请提供有效的查询内容',
        timeline: [],
        artifacts: [],
        evidence: []
      });
    }

    const timeline: TimelineStep[] = [];
    timeline.push({
      name: 'request_received',
      ok: true,
      latency_ms: 0,
      summary: '收到用户请求'
    });

    // 1. 加载用户记忆和偏�?
    const userPreferences = await MemoryService.loadUserPreferences(userId);
    timeline.push({
      name: 'memory_loaded',
      ok: true,
      latency_ms: 50,
      summary: `加载用户偏好: ${userPreferences.region || '默认地区'}`
    });

    // 2. 创建执行计划
    const plan = Planner.createPlan(query, userPreferences);
    timeline.push({
      name: 'plan_created',
      ok: true,
      latency_ms: 100,
      summary: `生成${plan.steps.length}步执行计划`
    });

    // 3. 执行计划
    const { results, timeline: executionTimeline } = await Executor.executePlan(plan, userId);
    timeline.push(...executionTimeline);

    // 4. 生成最终回�?
    const answer = AnswerGenerator.generateAnswer(query, plan, results, timeline);
    
    // 5. 收集证据和产�?
    const evidence = AnswerGenerator.collectEvidence(results);
    const artifacts = AnswerGenerator.collectArtifacts(results);

    // 6. 保存对话记忆
    if (userId) {
      await MemoryService.saveConversation(userId, query, plan, answer);
    }

    // 7. 返回最终响�?
    const response: ChatResponse = {
      answer,
      timeline,
      artifacts,
      evidence
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('API Error:', error);
    
    const errorTimeline: TimelineStep[] = [{
      name: 'error_occurred',
      ok: false,
      latency_ms: 0,
      summary: '处理过程中发生错�?',
      error: error instanceof Error ? error.message : '未知错误'
    }];

    res.status(500).json({
      answer: '处理请求时发生错误，请稍后重�?',
      timeline: errorTimeline,
      artifacts: [],
      evidence: [`错误详情: ${error instanceof Error ? error.message : '未知错误'}`]
    });
  }
}

// ==================== 测试用例 ====================
// 在浏览器控制台测�?
const testQueries = [
  { query: '我在武汉种水稻，最近要不要施肥？有啥要注意的？', userId: 'farmer_001' },
  { query: '找武汉本地直发的有机番茄，≤8�?/斤，帮我生成订单草稿', userId: 'consumer_001' },
  { query: '我有麻花鸡蛋100�?108/箱，今天上架，先生成草稿给我�?', userId: 'farmer_002' },
  { query: '我现在在种水稻（分蘖期），请为我生成未来两周的作物日�?', userId: 'farmer_001' }
];

// 测试函数
async function testQuery(testCase: { query: string; userId: string }) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCase)
    });
    
    const result = await response.json();
    console.log('测试结果:', testCase.query);
    console.log('回答:', result.answer);
    console.log('时间线步�?:', result.timeline.length);
    console.log('产物:', result.artifacts);
    console.log('证据:', result.evidence);
    console.log('---');
    
    return result;
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 执行测试
// testQueries.forEach(testQuery);