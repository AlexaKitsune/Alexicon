import mysql.connector, json
from dotenv import load_dotenv
import json
import os
import datetime

load_dotenv()

HOST = os.getenv("DB_HOST")
USER = os.getenv("DB_USER")
PASS = os.getenv("DB_PASS")
DATABASE = "alexicon"


def create_post(owner_id, data_):
    if "content" not in data_:
        return "Empty content."
    media_json = json.dumps(data_["media"])

    try:
        conn = mysql.connector.connect(
            host=HOST,
            user=USER,
            password=PASS,
            database=DATABASE
        )
        cursor = conn.cursor(dictionary=True)

        if data_["share_id"] != 0:
            select_query = "SELECT shared_by_list FROM posts WHERE id = %s"
            cursor.execute(select_query, (data_["share_id"],))
            result = cursor.fetchone()
            if result:
                shared_by_list = json.loads(result['shared_by_list'])
                if owner_id not in shared_by_list:
                    shared_by_list.append(owner_id)
                    update_query = "UPDATE posts SET shared_by_list = %s WHERE id = %s"
                    cursor.execute(update_query, (json.dumps(shared_by_list), data_["share_id"]))
                    conn.commit()
                else:
                    cursor.close()
                    conn.close()
                    return "Already shared."

        query = """
        INSERT INTO posts (owner_id, content, media, share_id, private_post, nsfw_post)
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        values = (
            owner_id,
            data_["content"],
            media_json,
            data_["share_id"],
            data_["private_post"],
            data_["nsfw_post"]
        )

        cursor.execute(query, values)
        conn.commit()
        post_id = cursor.lastrowid
        
        cursor.close()
        conn.close()

        return {"response": "Post added successfully", "post_added": post_id}
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        return False
    

def list_posts(target_owner_id, my_id):
    try:
        conn = mysql.connector.connect(
            host=HOST,
            user=USER,
            password=PASS,
            database=DATABASE
        )
        cursor = conn.cursor(dictionary=True)

        query = """
        SELECT p.*, u.name, u.surname, u.nickname, u.at_sign, u.current_profile_pic 
        FROM posts p
        JOIN users u ON p.owner_id = u.id
        WHERE p.owner_id = %s {}
        ORDER BY p.post_date DESC
        """.format('AND p.private_post = 0' if target_owner_id != my_id else '')
        
        cursor.execute(query, (target_owner_id,))
        result = cursor.fetchall()

        for row in result:
            if 'post_date' in row and isinstance(row['post_date'], datetime.datetime):
                row['post_date'] = row['post_date'].isoformat()

        cursor.close()
        conn.close()

        return result
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        return False
    

def get_single_post(id_):
    try:
        conn = mysql.connector.connect(
            host=HOST,
            user=USER,
            password=PASS,
            database=DATABASE
        )
        cursor = conn.cursor()

        query = """
        SELECT 
            posts.*, 
            users.name, 
            users.surname, 
            users.nickname, 
            users.at_sign,
            users.current_profile_pic 
        FROM posts
        LEFT JOIN users ON posts.owner_id = users.id
        WHERE posts.id = %s
        """
        cursor.execute(query, (id_,))

        post_data = cursor.fetchone()

        if post_data:
            post = {
                "id": post_data[0],
                "owner_id": post_data[1],
                "content": post_data[2],
                "media": post_data[3],
                "shared_by_list": post_data[4],
                "share_id": post_data[5],
                "private_post": post_data[6],
                "nsfw_post": post_data[7],
                "comment_count": post_data[8],
                "list_vote_heart": post_data[9],
                "list_vote_up": post_data[10],
                "list_vote_down": post_data[11],
                "post_date": post_data[12],
                "name": post_data[14],
                "surname": post_data[15],
                "nickname": post_data[16],
                "at_sign": post_data[17],
                "current_profile_pic": post_data[18],
            }
            return post
        else:
            return "Post not found."

    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        return False
    

def create_comment(post_id, owner_id, data_):
    if "content" not in data_:
        return "Empty content."
    media_json = json.dumps(data_.get("media", []))

    try:
        conn = mysql.connector.connect(
            host=HOST, user=USER, password=PASS, database=DATABASE
        )
        cursor = conn.cursor(dictionary=True)

        insert_query = """
            INSERT INTO comments (post_id, owner_id, content, media)
            VALUES (%s, %s, %s, %s)
        """
        cursor.execute(insert_query, (post_id, owner_id, data_["content"], media_json))
        comment_id = cursor.lastrowid

        select_query = """
            SELECT c.id, c.post_id, c.owner_id, c.content, c.media, c.comment_date, c.list_vote_heart, c.list_vote_up, c.list_vote_down, u.name, u.surname, u.nickname, u.at_sign, u.current_profile_pic
            FROM comments c
            LEFT JOIN users u ON c.owner_id = u.id
            WHERE c.id = %s
        """
        cursor.execute(select_query, (comment_id,))
        inserted_comment = cursor.fetchone()

        conn.commit()

        return {"response": "Comment added", "comment": inserted_comment}
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        return False
    finally:
        cursor.close()
        conn.close()