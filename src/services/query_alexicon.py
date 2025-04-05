import mysql.connector, json
from functions import validate_string, generate_random_key
from dotenv import load_dotenv
import bcrypt
import os

load_dotenv()

HOST = os.getenv("DB_HOST")
USER = os.getenv("DB_USER")
PASS = os.getenv("DB_PASS")
DATABASE = "alexicon"


def user_exists(email=None, at_sign=None):
    if not email and not at_sign:
        return "You must provide an email or at_sign to search for the user."
    try:
        conn = mysql.connector.connect(
            host=HOST,
            user=USER,
            password=PASS,
            database=DATABASE
        )
        cursor = conn.cursor()
        
        query = "SELECT id FROM users WHERE email = %s OR at_sign = %s"
        cursor.execute(query, (email, at_sign))
        result = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        return result is not None
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        return False
    

def get_user_public_data(get_by, data_):
    try:
        conn = mysql.connector.connect(
            host=HOST,
            user=USER,
            password=PASS,
            database=DATABASE
        )
        cursor = conn.cursor()

        if(get_by == "access_word"):
            cursor.execute("SELECT * FROM users WHERE email = %s OR at_sign = %s", (data_, data_))
        else:
            cursor.execute("SELECT * FROM users WHERE id = %s", (data_,))
        user_data = cursor.fetchone()

        if user_data is None:
            cursor.close()
            conn.close()
            return "User does not exist."
        
        user_json = {
            "id": user_data[0],
            "name": user_data[1],
            "surname": user_data[2],
            "nickname": user_data[3],
            "at_sign": user_data[4],
            "birthday": user_data[5],
            "gender": user_data[6],
            "description": user_data[7],
            "current_profile_pic": user_data[10],
            "current_cover_pic": user_data[11],
            "list_positive": user_data[12],
            "list_negative": user_data[13],
            "list_positive_external": user_data[14],
            "list_negative_external": user_data[15],
            "api_code" : 0 if user_data[16] in (None, "") else 1,
        }
        
        cursor.close()
        conn.close()

        return user_json
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        return "Database error."
    

def add_user(data_):
    required_fields = {
        "email": "email",
        "password": "password",
        "name": "username",
        "surname": "username",
        "nickname": "username",
        "birthday": "date",
        "gender": "alphabet"
    }
    
    for field, validation_type in required_fields.items():
        if field not in data_ or not validate_string(validation_type, data_[field]):
            return f"No {field}."

    try:
        conn = mysql.connector.connect(
            host=HOST,
            user=USER,
            password=PASS,
            database=DATABASE
        )
        cursor = conn.cursor()

        hashed_password = bcrypt.hashpw(data_["password"].encode('utf-8'), bcrypt.gensalt())
        verify_key = generate_random_key()
        
        query = """
        INSERT INTO users (email, password, name, surname, nickname, birthday, gender, verify_key)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            data_["email"],
            hashed_password,
            data_["name"],
            data_["surname"],
            data_["nickname"],
            data_["birthday"],
            data_["gender"],
            verify_key
        )
        
        cursor.execute(query, values)
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return "User added successfully."
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        return "Database error."
    

def login(data_):
    if "access_word" not in data_ or "password" not in data_:
        return "Empty email or password."
    try:
        conn = mysql.connector.connect(
            host=HOST,
            user=USER,
            password=PASS,
            database=DATABASE
        )
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM users WHERE email = %s OR at_sign = %s", (data_["access_word"], data_["access_word"]))
        user_data = cursor.fetchone()

        if user_data is None:
            cursor.close()
            conn.close()
            return "User does not exist."
        
        password_database = user_data[9]
        if bcrypt.checkpw(data_["password"].encode('utf-8'), password_database.encode('utf-8')):
            return "Correct login."
        else:
            return "Incorrect email or password."
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        return "Database error."


def update_pics(id_, pic_type, pic_name):
    try:
        conn = mysql.connector.connect(
            host=HOST,
            user=USER,
            password=PASS,
            database=DATABASE
        )
        cursor = conn.cursor()

        if pic_type == 'profile':
            column_to_update = 'current_profile_pic'
        elif pic_type == 'cover':
            column_to_update = 'current_cover_pic'
        else:
            return "Invalid pic type"
        
        query = f"UPDATE users SET {column_to_update} = %s WHERE id = %s"
        cursor.execute(query, (pic_name, id_))
        conn.commit()

        return {"response": "Image updated successfully", "image_added": pic_name}
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        return "Database error."
    finally:
        cursor.close()
        conn.close()


def update_profile(id_, data_):
    required_fields = {
        "name": "username",
        "surname": "username",
        "nickname": "username",
        "birthday": "date",
        "gender": "alphabet"
    }
    
    for field, validation_type in required_fields.items():
        if field not in data_ or not validate_string(validation_type, data_[field]):
            return f"No {field}."
        
    new_name = data_["name"]
    new_surname = data_["surname"]
    new_nickname = data_["nickname"]
    new_birthday = data_["birthday"]
    new_gender = data_["gender"]
    new_description = data_["description"]

    try:
        conn = mysql.connector.connect(
            host=HOST,
            user=USER,
            password=PASS,
            database=DATABASE
        )
        cursor = conn.cursor()

        query = """
        UPDATE users 
        SET name = %s, surname = %s, nickname = %s, birthday = %s, gender = %s, description = %s
        WHERE id = %s
        """
        cursor.execute(query, (new_name, new_surname, new_nickname, new_birthday, new_gender, new_description, id_))
        conn.commit()

        return {
            "name": new_name,
            "surname": new_surname,
            "nickname": new_nickname,
            "birthday": new_birthday,
            "gender": new_gender,
            "description": new_description
        }
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        return "Database error."
    finally:
        cursor.close()
        conn.close()


def update_pass(id_, old_pass, new_pass):
    try:
        conn = mysql.connector.connect(
            host=HOST,
            user=USER,
            password=PASS,
            database=DATABASE
        )
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT password FROM users WHERE id = %s", (id_,))
        user = cursor.fetchone()

        if not user:
            return "User does not exist."
        if not bcrypt.checkpw(old_pass.encode('utf-8'), user['password'].encode('utf-8')):
            return "Incorrect old password."
        if not validate_string("password", new_pass):
            return "New password does not meet the required criteria."
        
        hashed_new_pass = bcrypt.hashpw(new_pass.encode('utf-8'), bcrypt.gensalt())

        cursor.execute("UPDATE users SET password = %s WHERE id = %s", (hashed_new_pass, id_))
        conn.commit()

        return "Password updated successfully."
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        return "Database error."
    finally:
        cursor.close()
        conn.close()
