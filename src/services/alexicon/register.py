from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token
import services.query_alexicon as query_alexicon

bp_alexicon_register = Blueprint('bp_alexicon_register', __name__)


@bp_alexicon_register.route('/register', methods=['POST'])
def register():
    data = request.json
    user_exists = query_alexicon.user_exists(email=data["email"])

    if(user_exists):
        return jsonify({"response": "User exists"})
    else:
        register_user = query_alexicon.add_user(data)
        if register_user == "User added successfully.":
            user_data = query_alexicon.get_user_public_data("access_word", data["email"])
    
    return jsonify({"response": register_user, "user_data": user_data})