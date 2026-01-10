import os
import sqlite3
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

DB_PATH = "scores.db"


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            score INTEGER NOT NULL
        )
    """)
    conn.commit()
    conn.close()

def startup():
    init_db()


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/score", methods=["POST"])
def save_score():
    data = request.get_json(force=True)
    name = data.get("name", "Player")[:24]
    score = int(data.get("score", 0))

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("INSERT INTO scores(name, score) VALUES(?, ?)", (name, score))
    conn.commit()
    conn.close()

    return jsonify({"ok": True})


@app.route("/api/leaderboard", methods=["GET"])
def leaderboard():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT name, score FROM scores ORDER BY score DESC LIMIT 10")
    rows = cur.fetchall()
    conn.close()

    return jsonify([{"name": r[0], "score": r[1]} for r in rows])


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
