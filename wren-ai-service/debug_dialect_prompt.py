# wren-ai-service/debug_dialect_prompt.py

# Langkah 1.1: Menyalin aturan dasar dan membuat data uji
# Aturan ini disalin langsung dari 'wren-ai-service/src/pipelines/generation/utils/sql.py'
TEXT_TO_SQL_RULES = """
### SQL RULES ###
- ONLY USE SELECT statements, NO DELETE, UPDATE OR INSERT etc. statements that might change the data in the database.
- ONLY USE the tables and columns mentioned in the database schema.
- ALWAYS QUALIFY column names with their table name or table alias to avoid ambiguity (e.g., orders.OrderId, o.OrderId)
- ALWAYS CAST the date/time related field to "TIMESTAMP WITH TIME ZONE" type when using them in the query
    - example 1: CAST(properties_closedate AS TIMESTAMP WITH TIME ZONE)
    - example 2: CAST('2024-11-09 00:00:00' AS TIMESTAMP WITH TIME ZONE)
"""

# Data uji untuk mensimulasikan MDL dari berbagai database
mdl_simcore = {"dataSource": "mysql"}
mdl_mysql_asli = {"dataSource": "mysql"}
mdl_postgres = {"dataSource": "postgres"}
mdl_bigquery = {"dataSource": "bigquery"}
mdl_kosong = {}


# Langkah 1.2: Mengimplementasikan fungsi dinamis
def get_sql_generation_system_prompt(dialect: str = "") -> str:
    """
    Constructs the system prompt for SQL generation,
    dynamically adding dialect-specific rules if needed.
    """
    dialect_specific_rules = ""
    # Hanya tambahkan aturan spesifik jika dialeknya adalah mysql
    if dialect == "mysql":
        dialect_specific_rules = """
### MYSQL DIALECT RULES ###
- For table and column identifiers, YOU MUST USE backticks (`) instead of double quotes ("). Example: `orders`.`order_id`
- To extract parts of a date, USE date functions like `YEAR(date_column)`, `QUARTER(date_column)`, `MONTH(date_column)`. DO NOT USE the `EXTRACT(PART FROM date)` syntax.
- DO NOT USE `CAST(... AS TIMESTAMP WITH TIME ZONE)`. MySQL handles TIMESTAMP differently. If you need to compare dates, use a simple `CAST(date_column AS DATETIME)` or `CAST(date_column AS DATE)`.
"""
    
    # Gabungkan aturan-aturan menjadi satu
    full_text_to_sql_rules = f"""
{TEXT_TO_SQL_RULES}

{dialect_specific_rules}
""".strip()

    return f"""
You are a helpful assistant that converts natural language queries into ANSI SQL queries.
...
{full_text_to_sql_rules}
...
### FINAL ANSWER FORMAT ###
{{
    "sql": <SQL_QUERY_STRING>
}}
"""


# Langkah 1.3: Membuat fungsi uji
def main():
    """Menjalankan semua skenario pengujian dan mencetak hasilnya."""
    
    print("--- 1. Testing SIMCORE (should have MySQL rules) ---")
    simcore_dialect = mdl_simcore.get("dataSource", "")
    prompt_simcore = get_sql_generation_system_prompt(simcore_dialect)
    print(prompt_simcore)
    assert "MYSQL DIALECT RULES" in prompt_simcore, "Test 1 FAILED: SIMCORE should have MySQL rules."
    print("\n[OK] Test 1 Passed.\n")

    print("--- 2. Testing Original MySQL (should have MySQL rules) ---")
    mysql_dialect = mdl_mysql_asli.get("dataSource", "")
    prompt_mysql = get_sql_generation_system_prompt(mysql_dialect)
    print(prompt_mysql)
    assert "MYSQL DIALECT RULES" in prompt_mysql, "Test 2 FAILED: MySQL should have MySQL rules."
    print("\n[OK] Test 2 Passed.\n")
    
    print("--- 3. Testing PostgreSQL (should NOT have MySQL rules) ---")
    postgres_dialect = mdl_postgres.get("dataSource", "")
    prompt_postgres = get_sql_generation_system_prompt(postgres_dialect)
    print(prompt_postgres)
    assert "MYSQL DIALECT RULES" not in prompt_postgres, "Test 3 FAILED: PostgreSQL should NOT have MySQL rules."
    print("\n[OK] Test 3 Passed.\n")

    print("--- 4. Testing BigQuery (should NOT have MySQL rules) ---")
    bigquery_dialect = mdl_bigquery.get("dataSource", "")
    prompt_bigquery = get_sql_generation_system_prompt(bigquery_dialect)
    print(prompt_bigquery)
    assert "MYSQL DIALECT RULES" not in prompt_bigquery, "Test 4 FAILED: BigQuery should NOT have MySQL rules."
    print("\n[OK] Test 4 Passed.\n")

    print("--- 5. Testing Empty Dialect (should NOT have MySQL rules) ---")
    empty_dialect = mdl_kosong.get("dataSource", "")
    prompt_empty = get_sql_generation_system_prompt(empty_dialect)
    print(prompt_empty)
    assert "MYSQL DIALECT RULES" not in prompt_empty, "Test 5 FAILED: Empty dialect should NOT have MySQL rules."
    print("\n[OK] Test 5 Passed.\n")

    print("======================================")
    print("ALL ISOLATED TESTS PASSED SUCCESSFULLY!")
    print("======================================")


# Langkah 1.4: Menjalankan skrip
if __name__ == "__main__":
    main()