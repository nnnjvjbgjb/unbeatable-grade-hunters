from apps.web.lib.search_api import db_setup_and_seed
db_setup_and_seed()  # 成功后后续搜索将优先读 SQLite

from apps.web.lib.search_api import (
    search_products,
    update_user_preferences,
    answer_with_evidence_first,
)


if __name__ == "__main__":
    # 搜索示例
    result = search_products("今晚做沙拉，想买当季有机番茄", "user123", "北京")

    print("找到商品:", result["result_count"])
    for product in result["products"]:
        print(f"- {product['name']}: {product['price']}元")

    print("\n证据:")
    for evidence in result["evidence"]:
        print(f"- [{evidence['type']}] {evidence['content']}")

    # 更新用户偏好
    update_user_preferences("user123", {
        "organic_preference": "always",
        "preferred_regions": ["北京", "本地"]
    })

    # evidence-first 输出示例
    print("\n=== Evidence First ===")
    ans = answer_with_evidence_first("今晚做沙拉，想买当季有机番茄", "user123", "北京", evidence_top_k=5)
    print("证据:")
    for ev in ans["evidence"]:
        print(f"- [{ev['type']}] {ev['content']} (from {ev['source']})")
    print("结论:", ans["conclusion"])

    # DB 功能已移除（可选模块），此处不再演示