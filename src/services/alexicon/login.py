from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token
import services.query_alexicon as query_alexicon
from datetime import timedelta

bp_alexicon_login = Blueprint('bp_alexicon_login', __name__)


@bp_alexicon_login.route('/login', methods=['POST'])
def login(): 
    data = request.json
    user_email = data.get('email')

    response = query_alexicon.login(data)

    if(response == "Correct login."):
        expires = timedelta(hours=24)
        access_token = create_access_token(identity=user_email, expires_delta=expires)
        user_data = query_alexicon.get_user_public_data("access_word", data["access_word"])
        print(user_data)
        return jsonify({"response": response, "user_data": user_data, "access_token": access_token})
    else:
        return jsonify({"response": response})