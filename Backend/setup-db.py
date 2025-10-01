import os
import mysql.connector
from dotenv import load_dotenv
load_dotenv()
DEFAULT_FREE_SECONDS = 30

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST"),
        user=os.getenv("MYSQL_USER"),
        password=os.getenv("MYSQL_PASSWORD"),
        database=os.getenv("MYSQL_DATABASE"),
        port=int(os.getenv("MYSQL_PORT", 3306))
    )

def mysql_query():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
        """ALTER TABLE user_history
            MODIFY transcription LONGTEXT; """)
        conn.commit()
    finally:
        print("Sql Query has been executed!!")
        cursor.close()
        conn.close()

mysql_query()