# schema_extractor.py
import json
import mysql.connector
from mysql.connector import Error

# --- KONFIGURASI DATABASE ---
# TODO: Ganti nilai-nilai ini dengan kredensial database replika lokal Anda.
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "SKripsifelina123//",
    "database": "sim_testgeluran",
}

# --- NAMA FILE OUTPUT ---
OUTPUT_FILENAME = "erp_schema.json"


def get_schema_details(cursor, db_name):
    """Mengekstrak semua tabel beserta kolom, tipe data, dan info primary key."""
    print(f"Mengekstrak skema tabel dari database '{db_name}'...")
    
    # Query untuk mengambil detail kolom dari semua tabel dalam satu database
    query = """
    SELECT
        TABLE_NAME,
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_KEY
    FROM
        information_schema.COLUMNS
    WHERE
        TABLE_SCHEMA = %s
    ORDER BY
        TABLE_NAME, ORDINAL_POSITION;
    """
    cursor.execute(query, (db_name,))
    
    tables = {}
    for row in cursor.fetchall():
        table_name, column_name, data_type, is_nullable, column_key = row
        
        if table_name not in tables:
            tables[table_name] = {"columns": []}
            
        tables[table_name]["columns"].append({
            "name": column_name,
            "type": data_type,
            "notNull": is_nullable == "NO",
            "isPk": column_key == "PRI"
        })
        
    print(f"Ditemukan {len(tables)} tabel.")
    return tables

def get_relationships(cursor, db_name):
    """Mengekstrak semua relasi foreign key."""
    print("Mengekstrak relasi (foreign keys)...")
    
    # Query untuk mengambil detail foreign key
    query = """
    SELECT
        kcu.CONSTRAINT_NAME,
        kcu.TABLE_NAME as from_table,
        kcu.COLUMN_NAME as from_column,
        kcu.REFERENCED_TABLE_NAME as to_table,
        kcu.REFERENCED_COLUMN_NAME as to_column
    FROM
        information_schema.KEY_COLUMN_USAGE as kcu
    JOIN
        information_schema.TABLE_CONSTRAINTS as tc
        ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME AND kcu.TABLE_SCHEMA = tc.TABLE_SCHEMA
    WHERE
        kcu.TABLE_SCHEMA = %s
        AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL;
    """
    cursor.execute(query, (db_name,))
    
    relationships = []
    for row in cursor.fetchall():
        constraint, from_table, from_column, to_table, to_column = row
        relationships.append({
            "name": constraint,
            "fromTable": from_table,
            "fromColumn": from_column,
            "toTable": to_table,
            "toColumn": to_column,
        })
        
    print(f"Ditemukan {len(relationships)} relasi.")
    return relationships

def main():
    """Fungsi utama untuk menjalankan proses ekstraksi skema."""
    connection = None
    try:
        # Menghubungkan ke database MySQL
        connection = mysql.connector.connect(**DB_CONFIG)
        
        if connection.is_connected():
            print("Berhasil terhubung ke database MySQL.")
            cursor = connection.cursor()
            db_name = DB_CONFIG["database"]
            
            # 1. Ekstrak detail tabel dan kolom
            tables_data = get_schema_details(cursor, db_name)
            
            # 2. Ekstrak relasi foreign key
            relationships_data = get_relationships(cursor, db_name)
            
            # 3. Gabungkan semua data menjadi satu struktur JSON
            final_schema = {
                "tables": tables_data,
                "relationships": relationships_data
            }
            
            # 4. Tulis ke file JSON
            with open(OUTPUT_FILENAME, "w", encoding="utf-8") as f:
                json.dump(final_schema, f, indent=4, ensure_ascii=False)
                
            print(f"\nSkema database berhasil diekspor ke '{OUTPUT_FILENAME}'.")
            
            cursor.close()
            
    except Error as e:
        print(f"Error saat terhubung ke MySQL: {e}")
    finally:
        if connection and connection.is_connected():
            connection.close()
            print("Koneksi MySQL ditutup.")

if __name__ == "__main__":
    main()