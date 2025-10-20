import pandas as pd
import json
import re
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
try:
    from .db import load_products_df
except Exception:
    def load_products_df(*args, **kwargs):  # type: ignore
        return None

class ProductRAG:
    def __init__(self, products_file: str = "data/products.csv", 
                 crops_file: str = "data/crops.json",
                 faq_file: str = "data/faq.md"):
        self.products_file = products_file
        self.crops_file = crops_file
        self.faq_file = faq_file
        self.products_df = None
        self.crops_data = None
        self.faq_content = None
        self.alias_map = {}
        
        self._load_data()
        self._build_alias_map()
    
    def _load_data(self):
        """加载所有数据源"""
        # 加载商品数据（优先SQLite，其次CSV）
        df = load_products_df()
        if df is None:
            df = pd.read_csv(self.products_file)
        self.products_df = df
        # 规范化别名列：确保为list
        self.products_df['aliases'] = self.products_df['aliases'].fillna('')
        self.products_df['aliases'] = self.products_df['aliases'].apply(lambda x: [s.strip() for s in str(x).split(',') if str(s).strip()])
        # 价格容错：转为数值，无效设为NaN
        self.products_df['price'] = pd.to_numeric(self.products_df['price'], errors='coerce')
        
        # 加载作物季节数据
        with open(self.crops_file, 'r', encoding='utf-8') as f:
            self.crops_data = json.load(f)
        
        # 加载FAQ数据
        with open(self.faq_file, 'r', encoding='utf-8') as f:
            self.faq_content = f.read()
        # 解析FAQ最后更新时间（若有）
        self.faq_last_updated = None
        for line in self.faq_content.split('\n')[:5]:
            if '最后更新时间' in line:
                self.faq_last_updated = line.strip().replace('最后更新时间:', '').strip()
                break
    
    def _build_alias_map(self):
        """构建别名映射"""
        for _, row in self.products_df.iterrows():
            main_name = row['name']
            aliases = row['aliases']
            
            self.alias_map[main_name] = main_name
            for alias in aliases:
                if alias.strip():
                    self.alias_map[alias.strip()] = main_name
    
    def search_products(self, query: str, user_region: str = "北京", 
                       current_season: str = None,
                       preferences: Optional[Dict[str, Any]] = None,
                       evidence_top_k: int = 5) -> Tuple[List[Dict], List[Dict]]:
        """搜索商品并返回结果和证据（支持偏好加权与证据Top-k）"""
        if current_season is None:
            current_season = self._get_current_season()
        
        # 提取查询中的关键词
        keywords = self._extract_keywords(query)
        
        # 搜索商品
        products = self._find_products(keywords, user_region, current_season, preferences or {})
        
        # 收集证据
        evidence = self._collect_evidence(keywords, user_region, current_season, products)
        if evidence_top_k is not None and evidence_top_k > 0:
            evidence = evidence[:evidence_top_k]
        
        return products, evidence
    
    def _extract_keywords(self, query: str) -> List[str]:
        """从查询中提取关键词"""
        # 简单的关键词提取，实际可以使用更复杂的NLP技术
        words = re.findall(r'[\w]+', query.lower())
        
        # 映射别名
        mapped_keywords = []
        for word in words:
            if word in self.alias_map:
                mapped_keywords.append(self.alias_map[word])
            else:
                mapped_keywords.append(word)
        
        return list(set(mapped_keywords))
    
    def _find_products(self, keywords: List[str], user_region: str, current_season: str, preferences: Dict[str, Any]) -> List[Dict]:
        """根据关键词查找商品，并按用户偏好加权打分"""
        results = []
        
        for _, product in self.products_df.iterrows():
            score = 0
            
            # 名称匹配
            name = product['name'].lower()
            if any(keyword in name for keyword in keywords):
                score += 3
            
            # 别名匹配
            aliases = [alias.lower() for alias in product['aliases']]
            if any(any(keyword in alias for alias in aliases) for keyword in keywords):
                score += 2
            
            # 类别匹配
            category = product['category'].lower()
            if any(keyword in category for keyword in keywords):
                score += 1
            
            # 地域偏好（本地优先 + 用户偏好地区）
            if product['region'] == user_region:
                score += 2
            preferred_regions = set(preferences.get('preferred_regions', []))
            if preferred_regions and product['region'] in preferred_regions:
                score += 1
            
            # 季节匹配（可被 seasonal_preference 强化）
            if current_season in product['season']:
                score += 1
                if preferences.get('seasonal_preference', True):
                    score += 1

            # 有机偏好
            organic_pref = preferences.get('organic_preference', 'auto')
            if organic_pref == 'always' and str(product.get('is_organic', '')).lower() in ['true', '1', 'yes']:
                score += 1
            if organic_pref == 'never' and str(product.get('is_organic', '')).lower() in ['false', '0', 'no']:
                score += 1

            # 预算与价格敏感度
            max_price = preferences.get('max_price', None)
            if max_price is not None:
                try:
                    if float(product['price']) <= float(max_price):
                        score += 1
                except Exception:
                    pass
            price_sensitivity = preferences.get('price_sensitivity', 'medium')
            try:
                price_value = float(product['price'])
                if price_sensitivity == 'high' and price_value <= 15:
                    score += 1
                elif price_sensitivity == 'low' and price_value >= 20:
                    score += 1
            except Exception:
                pass

            # 作物/食材偏好关键词
            preferred_crops = [str(x).lower() for x in preferences.get('preferred_crops', [])]
            if preferred_crops and (any(pc in name for pc in preferred_crops) or any(pc in category for pc in preferred_crops)):
                score += 1
            
            if score > 0:
                product_dict = product.to_dict()
                product_dict['relevance_score'] = score
                results.append(product_dict)
        
        # 按相关性排序
        results.sort(key=lambda x: x['relevance_score'], reverse=True)
        return results
    
    def _collect_evidence(self, keywords: List[str], user_region: str, 
                         current_season: str, products: List[Dict]) -> List[Dict]:
        """收集相关证据"""
        evidence = []
        
        # 商品命中详情（字段与片段）
        if products:
            product_hits = []
            for product in products[:5]:  # 只记录前5个的命中详情
                matches = self._match_product_fields(product, keywords)
                if matches:
                    product_hits.append({
                        "id": product.get("id"),
                        "name": product.get("name"),
                        "matched_fields": [m["field"] for m in matches],
                        "snippets": [m["snippet"] for m in matches],
                        "update_time": product.get("update_time")
                    })
            if product_hits:
                # 标注来源与更新时间（取首条或混合）
                updated = product_hits[0].get("update_time") or "unknown"
                evidence.append({
                    "type": "product_matches",
                    "content": json.dumps(product_hits, ensure_ascii=False),
                    "source": f"products.csv(updated:{updated})"
                })

        # 添加季节证据
        seasonal_crops = self.crops_data['seasonal_crops'].get(current_season, [])
        if any(keyword in ' '.join(seasonal_crops) for keyword in keywords):
            evidence.append({
                "type": "seasonal_info",
                "content": f"{current_season}季当季作物: {', '.join(seasonal_crops)}",
                "source": f"crops.json(updated:{self.crops_data.get('last_updated','unknown')})"
            })
        
        # 添加地域证据
        regional_specialties = self.crops_data['regional_specialties'].get(user_region, [])
        if regional_specialties:
            evidence.append({
                "type": "regional_info",
                "content": f"{user_region}特产: {', '.join(regional_specialties)}",
                "source": f"crops.json(updated:{self.crops_data.get('last_updated','unknown')})"
            })
        
        # 添加价格对比证据
        if products:
            price_evidence = self._generate_price_evidence(products)
            if price_evidence:
                evidence.append(price_evidence)
        
        # 添加FAQ证据
        faq_evidence = self._extract_faq_evidence(keywords)
        evidence.extend(faq_evidence)
        
        return evidence
    
    def _generate_price_evidence(self, products: List[Dict]) -> Dict[str, Any]:
        """生成价格对比证据"""
        if len(products) < 2:
            return None
        
        # 计算同类商品平均价格
        categories = {}
        for product in products:
            category = product['category']
            if category not in categories:
                categories[category] = []
            categories[category].append(product['price'])
        
        evidence_lines = []
        for category, prices in categories.items():
            if len(prices) > 1:
                avg_price = sum(prices) / len(prices)
                min_price = min(prices)
                evidence_lines.append(
                    f"{category}均价: {avg_price:.1f}元，最低{min_price:.1f}元"
                )
        
        if evidence_lines:
            return {
                "type": "price_comparison",
                "content": " | ".join(evidence_lines),
                "source": "products.csv"
            }
        return None
    
    def _extract_faq_evidence(self, keywords: List[str]) -> List[Dict]:
        """从FAQ中提取相关证据"""
        evidence = []
        lines = self.faq_content.split('\n')
        
        current_question = None
        current_answer = []
        
        for line in lines:
            if line.startswith('Q: '):
                if current_question and current_answer:
                    # 检查是否匹配关键词
                    content = ' '.join([current_question] + current_answer)
                    if any(keyword in content.lower() for keyword in keywords):
                        evidence.append({
                            "type": "faq",
                            "content": f"{current_question} {''.join(current_answer)}",
                            "source": f"faq.md(updated:{self.faq_last_updated or 'unknown'})"
                        })
                
                current_question = line[3:].strip()
                current_answer = []
            elif line.startswith('A: '):
                current_answer.append(line[3:].strip())
        
        return evidence

    def _match_product_fields(self, product: Dict[str, Any], keywords: List[str]) -> List[Dict[str, str]]:
        """返回商品命中字段与片段：[{field, snippet}]"""
        matches = []
        # 名称
        name_val = str(product.get('name', '')).lower()
        if any(k in name_val for k in keywords):
            matches.append({"field": "name", "snippet": product.get('name', '')})
        # 别名
        aliases_val = product.get('aliases', [])
        try:
            alias_list = [str(a).lower() for a in aliases_val]
        except Exception:
            alias_list = [str(aliases_val).lower()]
        if any(k in a for a in alias_list for k in keywords):
            matches.append({"field": "aliases", "snippet": ','.join(product.get('aliases', [])) if isinstance(product.get('aliases', []), list) else str(product.get('aliases', ''))})
        # 类别
        category_val = str(product.get('category', '')).lower()
        if any(k in category_val for k in keywords):
            matches.append({"field": "category", "snippet": product.get('category', '')})
        # 地域
        region_val = str(product.get('region', '')).lower()
        if any(k in region_val for k in keywords):
            matches.append({"field": "region", "snippet": product.get('region', '')})
        # 季节
        season_val = str(product.get('season', '')).lower()
        if any(k in season_val for k in keywords):
            matches.append({"field": "season", "snippet": product.get('season', '')})
        return matches
    
    def _get_current_season(self) -> str:
        """获取当前季节"""
        month = datetime.now().month
        if month in [3, 4, 5]:
            return "春"
        elif month in [6, 7, 8]:
            return "夏"
        elif month in [9, 10, 11]:
            return "秋"
        else:
            return "冬"