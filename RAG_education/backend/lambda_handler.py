"""AWS Lambda エントリポイント（軽量版 - ChromaDB 不要）"""
import os
import json

# Lambda 環境設定
if os.getenv("APP_ENV") == "lambda":
    # Firebase サービスアカウントキーを環境変数から復元
    sa_json = os.getenv("FIREBASE_SA_JSON", "")
    if sa_json:
        sa_path = "/tmp/firebase-sa.json"
        if not os.path.exists(sa_path):
            with open(sa_path, "w") as f:
                f.write(sa_json)
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = sa_path

from mangum import Mangum
from main import app

handler = Mangum(app, lifespan="off")
