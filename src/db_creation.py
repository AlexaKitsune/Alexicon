import mysql.connector, json
from dotenv import load_dotenv
import os

load_dotenv()

HOST = os.getenv("DB_HOST")
USER = os.getenv("DB_USER")
PASS = os.getenv("DB_PASS")

def create_database():
    try:
        connection = mysql.connector.connect(
            host=HOST,
            user=USER,
            password=PASS
        )
        cursor = connection.cursor()

        with open('schema.sql', 'r', encoding='utf-8') as file:
            sql_script = file.read()

        for statement in sql_script.split("$$"):
            statement = statement.strip()
            if statement:
                cursor.execute(statement)

        connection.commit()
        print("SQL script executed successfully.")

    except Exception as e:
        print(f"Error executing SQL file: {str(e)}")
        
    finally:
        cursor.close()
        connection.close()