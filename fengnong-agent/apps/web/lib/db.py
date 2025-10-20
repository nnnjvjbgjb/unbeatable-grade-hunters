import os
import json
import sqlite3
from typing import Optional, Dict, Any

import pandas as pd


DEFAULT_DB_PATH = "data/app.db"


def _connect(db_path: Optional[str] = None) -> sqlite3.Connection:
    path = db_path or DEFAULT_DB_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Optional[str] = None) -> None:
    conn = _connect(db_path)
    try:
        cur = conn.cursor()
        # products 表（与 CSV 基本对齐）
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS products (
              id INTEGER PRIMARY KEY,
              name TEXT,
              aliases TEXT,
              category TEXT,
              price REAL,
              region TEXT,
              season TEXT,
              is_organic INTEGER,
              is_local INTEGER,
              store TEXT,
              update_time TEXT
            )
            """
        )

        # 订单日志
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS order_logs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id TEXT,
              product_id INTEGER,
              quantity REAL,
              price REAL,
              note TEXT,
              created_at TEXT DEFAULT (datetime('now'))
            )
            """
        )

        # 上架/变更日志
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS listing_logs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              product_id INTEGER,
              action TEXT,           -- create/update/delete
              fields TEXT,           -- JSON of changed fields
              note TEXT,
              created_at TEXT DEFAULT (datetime('now'))
            )
            """
        )

        conn.commit()
    finally:
        conn.close()


def seed_products_from_csv(csv_path: str, db_path: Optional[str] = None) -> int:
    df = pd.read_csv(csv_path)
    conn = _connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM products")

        inserted = 0
        for _, row in df.iterrows():
            cur.execute(
                """
                INSERT INTO products (
                  id, name, aliases, category, price, region, season, is_organic, is_local, store, update_time
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    int(row["id"]),
                    str(row["name"]),
                    str(row.get("aliases", "")),
                    str(row.get("category", "")),
                    float(row.get("price", 0) if pd.notna(row.get("price")) else 0.0),
                    str(row.get("region", "")),
                    str(row.get("season", "")),
                    1 if str(row.get("is_organic", "")).lower() in ["true", "1", "yes"] else 0,
                    1 if str(row.get("is_local", "")).lower() in ["true", "1", "yes"] else 0,
                    str(row.get("store", "")),
                    str(row.get("update_time", "")),
                ),
            )
            inserted += 1
        conn.commit()
        return inserted
    finally:
        conn.close()


def has_products_table(db_path: Optional[str] = None) -> bool:
    conn = _connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='products'")
        return cur.fetchone() is not None
    finally:
        conn.close()


def load_products_df(db_path: Optional[str] = None) -> Optional[pd.DataFrame]:
    if not os.path.exists((db_path or DEFAULT_DB_PATH)):
        return None
    if not has_products_table(db_path):
        return None
    conn = _connect(db_path)
    try:
        return pd.read_sql_query("SELECT * FROM products", conn)
    finally:
        conn.close()


def write_order_log(user_id: str, product_id: int, quantity: float, price: float, note: str = "", db_path: Optional[str] = None) -> bool:
    conn = _connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO order_logs (user_id, product_id, quantity, price, note)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id, product_id, quantity, price, note),
        )
        conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()


def write_listing_log(product_id: int, action: str, fields: Dict[str, Any], note: str = "", db_path: Optional[str] = None) -> bool:
    conn = _connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO listing_logs (product_id, action, fields, note)
            VALUES (?, ?, ?, ?)
            """,
            (product_id, action, json.dumps(fields, ensure_ascii=False), note),
        )
        conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()


