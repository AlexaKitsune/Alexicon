from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from db_creation import create_database

from services.alexicon.login import bp_alexicon_login
from services.alexicon.register import bp_alexicon_register
from services.yipnet.post import bp_yipnet_post

app = Flask(__name__)
CORS(app)
app.config['JWT_SECRET_KEY'] = 'tu_clave_secreta_aqui'
jwt = JWTManager(app)

create_database()

# Routes:
app.register_blueprint(bp_alexicon_login)
app.register_blueprint(bp_alexicon_register)
app.register_blueprint(bp_yipnet_post)
    
# Run:
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
