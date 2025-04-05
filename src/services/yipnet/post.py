from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
import services.query_alexicon as query_alexicon
import services.query_yip_net as query_yip_net

bp_yipnet_post = Blueprint('bp_yipnet_post', __name__)


@bp_yipnet_post.route('/post', methods=['POST'])
@jwt_required()
def create_post():
    try:
        data = request.json
        print("Data received:", data)
        current_user_email = get_jwt_identity()
        print("Current User Email:", current_user_email)
        
        user_id = query_alexicon.get_user_public_data("access_word", current_user_email)
        response = query_yip_net.create_post(user_id, data)

        return jsonify({"response": response})
    except Exception as e:
        print("Error occurred:", e)
        return jsonify({"msg": "An error occurred while processing the request"}), 500


