from flask import Flask, jsonify, request
from flask_cors import CORS

from market import MarketSimulator

app = Flask(__name__)
CORS(app)

sim = MarketSimulator(start_price=1000.0)
sim.start()


@app.get("/api/state")
def state():
    return jsonify(sim.get_state())


@app.get("/api/history")
def history():
    since = request.args.get("since", type=int)
    return jsonify(sim.get_history(since=since))


@app.post("/api/pause")
def pause():
    sim.set_paused(True)
    return jsonify({"ok": True, "paused": True})


@app.post("/api/resume")
def resume():
    sim.set_paused(False)
    return jsonify({"ok": True, "paused": False})


@app.post("/api/speed")
def speed():
    data = request.get_json(silent=True) or {}
    factor = data.get("factor", 1.0)
    sim.set_speed(factor)
    return jsonify({"ok": True, "speed": sim.speed})


@app.post("/api/reset")
def reset():
    global sim
    sim = MarketSimulator(start_price=1000.0)
    sim.start()
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True, use_reloader=False)
