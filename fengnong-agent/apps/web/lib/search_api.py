from typing import Dict, List, Any, Tuple
from .rag import ProductRAG
from ..sandbox.memory.user_memory import UserMemory
try:
    from .db import init_db, seed_products_from_csv, write_order_log, write_listing_log
except Exception:
    init_db = None
    seed_products_from_csv = None
    write_order_log = None
    write_listing_log = None
try:
    from .db import init_db, seed_products_from_csv, write_order_log, write_listing_log
except Exception:
    init_db = None
    seed_products_from_csv = None
    write_order_log = None
    write_listing_log = None

# 全局实例
rag_engine = ProductRAG()
memory_engine = UserMemory()

def search_products(query: str, user_id: str = "default", user_region: str = "北京") -> Dict[str, Any]:
    """
    商品搜索主接口
    """
    # 读取用户记忆
    user_memory = memory_engine.read_memory(user_id)
    
    # 搜索商品
    products, evidence = rag_engine.search_products(
        query,
        user_region=user_region,
        preferences=user_memory.get("preferences", {}),
        evidence_top_k=5
    )
    
    # 更新搜索历史
    memory_engine.add_search_history(user_id, query, products)
    
    # 识别购买意图并更新
    intent = _extract_purchase_intent(query)
    if intent:
        product_names = [p['name'] for p in products[:3]]
        memory_engine.add_purchase_intent(user_id, intent, product_names)
    
    return {
        "products": products[:10],  # 返回前10个结果
        "evidence": evidence,
        "query": query,
        "user_region": user_region,
        "result_count": len(products)
    }

def answer_with_evidence_first(query: str, user_id: str = "default", user_region: str = "北京", evidence_top_k: int = 5) -> Dict[str, Any]:
    """
    evidence-first 的回答接口：
    - 基于用户偏好与地域/季节，检索 products / faq / crops 证据 Top-k
    - 输出结构固定为：evidence 在前，conclusion 在后
    """
    user_memory = memory_engine.read_memory(user_id)

    products, evidence = rag_engine.search_products(
        query,
        user_region=user_region,
        preferences=user_memory.get("preferences", {}),
        evidence_top_k=evidence_top_k
    )

    # 结论草案（基于 Top 结果简单生成，真实应用中可交给LLM）
    top_items = [f"{p['name']}（¥{p['price']}）" for p in products[:3]]
    conclusion = "；".join(top_items) if top_items else "未找到合适商品"

    # 写短期对话摘要（问题→计划→结论）
    plan = "检索相关商品与FAQ/作物信息，结合用户偏好进行加权排序"
    memory_engine.add_conversation_summary(user_id, question=query, plan=plan, conclusion=conclusion)

    return {
        "evidence": evidence,
        "conclusion": conclusion,
        "products": products[:10],
        "query": query,
        "user_region": user_region,
        "result_count": len(products)
    }

def db_setup_and_seed() -> Dict[str, Any]:
    """初始化SQLite并从CSV导入products（幂等，接口保持简单）"""
    return {"error": "db module not available"}


def log_order(user_id: str, product_id: int, quantity: float, price: float, note: str = "") -> bool:
    """记录订单日志（供调用方使用）"""
    return False


def log_listing(product_id: int, action: str, fields: Dict[str, Any], note: str = "") -> bool:
    """记录上架/变更日志（供调用方使用）"""
    return False


def get_user_preferences(user_id: str) -> Dict[str, Any]:
    """
    获取用户偏好
    """
    memory = memory_engine.read_memory(user_id)
    return memory["preferences"]


def update_user_preferences(user_id: str, preferences: Dict[str, Any]) -> bool:
    """
    更新用户偏好
    """
    return memory_engine.update_preferences(user_id, preferences)


def _extract_purchase_intent(query: str) -> str:
    """
    从查询中提取购买意图
    """
    query_lower = query.lower()
    
    if any(word in query_lower for word in ['沙拉', '凉拌']):
        return "制作沙拉"
    elif any(word in query_lower for word in ['炒菜', '烹饪', '做饭']):
        return "家常炒菜"
    elif any(word in query_lower for word in ['火锅', '涮锅']):
        return "火锅食材"
    elif any(word in query_lower for word in ['零食', '点心']):
        return "零食采购"
    
    return "日常采购"