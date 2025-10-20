import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional

class UserMemory:
    def __init__(self, memory_dir: str = "apps/web/sandbox/memory"):
        self.memory_dir = memory_dir
        os.makedirs(memory_dir, exist_ok=True)
    
    def get_memory_file(self, user_id: str) -> str:
        return os.path.join(self.memory_dir, f"{user_id}.json")
    
    def read_memory(self, user_id: str) -> Dict[str, Any]:
        """读取用户记忆"""
        memory_file = self.get_memory_file(user_id)
        if not os.path.exists(memory_file):
            return self._get_default_memory()
        
        try:
            with open(memory_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"读取记忆失败: {e}")
            return self._get_default_memory()
    
    def write_memory(self, user_id: str, memory: Dict[str, Any]) -> bool:
        """写入用户记忆"""
        try:
            memory_file = self.get_memory_file(user_id)
            memory["last_updated"] = datetime.now().isoformat()
            
            with open(memory_file, 'w', encoding='utf-8') as f:
                json.dump(memory, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"写入记忆失败: {e}")
            return False
    
    def update_preferences(self, user_id: str, preferences: Dict[str, Any]) -> bool:
        """更新用户偏好"""
        memory = self.read_memory(user_id)
        memory["preferences"].update(preferences)
        memory["preferences"]["last_updated"] = datetime.now().isoformat()
        return self.write_memory(user_id, memory)
    
    def add_search_history(self, user_id: str, query: str, results: List[Dict]) -> bool:
        """添加搜索历史"""
        memory = self.read_memory(user_id)
        memory["search_history"].append({
            "query": query,
            "results_count": len(results),
            "timestamp": datetime.now().isoformat()
        })
        # 保留最近50条记录
        memory["search_history"] = memory["search_history"][-50:]
        return self.write_memory(user_id, memory)
    
    def add_purchase_intent(self, user_id: str, intent: str, products: List[str]) -> bool:
        """添加购买意图"""
        memory = self.read_memory(user_id)
        memory["purchase_intents"].append({
            "intent": intent,
            "products": products,
            "timestamp": datetime.now().isoformat()
        })
        return self.write_memory(user_id, memory)

    def add_conversation_summary(self, user_id: str, question: str, plan: str, conclusion: str, max_keep: int = 10) -> bool:
        """追加一条短期对话摘要（问题→计划→结论），仅保留最近 max_keep 条"""
        memory = self.read_memory(user_id)
        if "short_term_summaries" not in memory or not isinstance(memory.get("short_term_summaries"), list):
            memory["short_term_summaries"] = []
        summary_item = {
            "question": question,
            "plan": plan,
            "conclusion": conclusion,
            "timestamp": datetime.now().isoformat()
        }
        memory["short_term_summaries"].append(summary_item)
        memory["short_term_summaries"] = memory["short_term_summaries"][-max_keep:]
        return self.write_memory(user_id, memory)

    def get_recent_summaries(self, user_id: str, n: int = 5) -> List[Dict[str, Any]]:
        """读取最近 n 条短期对话摘要"""
        memory = self.read_memory(user_id)
        return memory.get("short_term_summaries", [])[-n:]
    
    def _get_default_memory(self) -> Dict[str, Any]:
        """获取默认记忆结构"""
        return {
            "user_id": "",
            "preferences": {
                "preferred_categories": [],
                "price_sensitivity": "medium",  # low, medium, high（越高越倾向低价）
                "preferred_regions": ["本地"],
                "preferred_crops": [],  # 作物/食材偏好关键词
                "allergies": [],  # 过敏原，如 花生、坚果、乳制品
                "diet": "auto",  # auto, vegetarian, vegan, keto, halal, etc.
                "budget_level": "medium",  # low, medium, high（影响价格权重）
                "max_price": None,  # 单品心理价位上限（数值或 None）
                "organic_preference": "auto",  # always, never, auto
                "seasonal_preference": True,
                "last_updated": datetime.now().isoformat()
            },
            "search_history": [],
            "purchase_intents": [],
            "short_term_summaries": [],
            "saved_items": [],
            "created_at": datetime.now().isoformat(),
            "last_updated": datetime.now().isoformat()
        }