from flask import Flask, render_template, jsonify, request
import os

app = Flask(__name__)

# Global high score (for demo; resets if server restarts)
HIGH_SCORE = 0


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/highscore", methods=["GET"])
def get_highscore():
    return jsonify({"highscore": HIGH_SCORE})


@app.route("/api/highscore", methods=["POST"])
def update_highscore():
    global HIGH_SCORE
    data = request.get_json(silent=True) or {}
    score = int(data.get("score", 0))
    if score > HIGH_SCORE:
        HIGH_SCORE = score
    return jsonify({"highscore": HIGH_SCORE})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
