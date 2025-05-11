import sys
import json
import pandas as pd
from sklearn.ensemble import IsolationForest

def detect_anomalies(data):
    if not data:
        return []
    df = pd.DataFrame(data)
    model = IsolationForest(contamination=0.1)
    preds = model.fit_predict(df[["sensorValue", "humidity", "temp"]])
    return (preds == -1).tolist()

input_data = json.loads(sys.stdin.read())

moisture_results = detect_anomalies(input_data.get("moisture", []))
ultrasonic_results = detect_anomalies(input_data.get("ultrasonic", []))
print(json.dumps({
    "moisture": moisture_results,
    "ultrasonic": ultrasonic_results
}))