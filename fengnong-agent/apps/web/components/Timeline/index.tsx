// apps/web/components/Timeline/index.tsx
import React from 'react';
import './styles.css';

// 定义时间线事件的数据类型
export interface TimelineEvent {
  id: string;           // 每个事件的唯一标识
  time: string;         // 时间，比如"今天"、"明天"
  event: string;        // 事件内容，比如"施肥"、"喷药"
  completed: boolean;   // 是否完成
  description?: string; // 详细说明（可选）
}

// 定义组件的属性
interface TimelineProps {
  events: TimelineEvent[];          // 事件列表
  onToggleComplete?: (id: string) => void; // 点击切换完成状态的函数
  onExport?: () => void;            // 导出按钮点击函数
  title?: string;                   // 组件标题
}

// 时间线主组件
const Timeline: React.FC<TimelineProps> = ({ 
  events = [], 
  onToggleComplete,
  onExport,
  title = "⏰ 时间线" 
}) => {
  // 计算完成进度
  const completedCount = events.filter(e => e.completed).length;
  const totalCount = events.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // 动态生成下载内容
  const generateExportContent = () => {
    let content = `# 农业待办事项清单\\n\\n`;
    content += `## 进度概览\\n`;
    content += `- 完成进度: ${completedCount}/${totalCount} (${progressPercentage}%)\\n`;
    content += `- 生成时间: ${new Date().toLocaleString('zh-CN')}\\n\\n`;
    
    content += `## 待办事项详情\\n`;
    
    // 按事件显示
    events.forEach((item, index) => {
      const status = item.completed ? '✅' : '⭕';
      content += `### ${index + 1}. ${item.time} - ${item.event}\\n`;
      content += `- 状态: ${status} ${item.completed ? '已完成' : '待完成'}\\n`;
      if (item.description) {
        content += `- 说明: ${item.description}\\n`;
      }
      content += `\\n`;
    });
    
    content += `## 操作建议\\n`;
    if (completedCount === totalCount) {
      content += `🎉 恭喜！所有任务已完成！\\n`;
    } else {
      const pendingTasks = events.filter(item => !item.completed);
      content += `📋 接下来建议优先处理:\\n`;
      pendingTasks.forEach(task => {
        content += `- ${task.time}: ${task.event}\\n`;
      });
    }

    return content;
  };

  // 处理导出
  const handleExport = () => {
    const content = generateExportContent();
    
    // 创建下载
    const blob = new Blob([content.replace(/\\n/g, '\n')], { 
      type: 'text/markdown;charset=utf-8' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `农业待办清单_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // 调用外部传入的导出回调
    if (onExport) {
      onExport();
    }
  };

  return (
    <div className="timeline-panel">
      {/* 标题区域 */}
      <div className="timeline-header">
        <h3>{title}</h3>
        <div className="progress-info">
          <span className="progress-text">
            {completedCount}/{totalCount} 完成
          </span>
          {totalCount > 0 && (
            <span className="progress-percentage">({progressPercentage}%)</span>
          )}
        </div>
      </div>
      
      {/* 时间线内容区域 */}
      <div className="timeline-content">
        {events.length === 0 ? (
          // 没有数据时显示的空状态
          <div className="timeline-empty">
            <div className="empty-icon">📅</div>
            <p>暂无时间线数据</p>
            <small>开始对话后，这里会显示您的种植计划</small>
          </div>
        ) : (
          // 有数据时显示时间线列表
          events.map((event, index) => (
            <div key={event.id} className={`timeline-item ${event.completed ? 'completed' : ''}`}>
              {/* 左侧的时间线和圆点 */}
              <div className="timeline-line">
                <div 
                  className={`timeline-dot ${event.completed ? 'completed' : ''}`}
                  onClick={() => onToggleComplete && onToggleComplete(event.id)}
                >
                  {event.completed && <span className="checkmark">✓</span>}
                </div>
                {/* 连接线（除了最后一个） */}
                {index < events.length - 1 && <div className="timeline-connector"></div>}
              </div>
              
              {/* 右侧的事件内容 */}
              <div className="timeline-content-right">
                <div className="timeline-time">{event.time}</div>
                <div className={`timeline-event ${event.completed ? 'completed' : ''}`}>
                  {event.event}
                </div>
                {event.description && (
                  <div className="timeline-description">{event.description}</div>
                )}
                
                {/* 状态标签 */}
                <div className="status-tag">
                  {event.completed ? (
                    <span className="status-completed">✅ 已完成</span>
                  ) : (
                    <span className="status-pending">⏳ 待完成</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* 导出按钮 */}
      {events.length > 0 && (
        <button className="export-btn" onClick={handleExport}>
          <span className="export-icon">📥</span>
          下载待办清单
        </button>
      )}
    </div>
  );
};

export default Timeline;