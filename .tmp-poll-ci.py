import json, sys, time, urllib.request

RUN_ID = sys.argv[1]
url = f"https://api.github.com/repos/salmoshu/Catfish-Pi/actions/runs/{RUN_ID}"
jobs_url = f"{url}/jobs?per_page=20"

for attempt in range(60):
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            run = json.load(resp)
    except Exception as exc:
        print(f"poll {attempt}: api error {exc}", flush=True)
        time.sleep(30)
        continue
    status, conclusion = run["status"], run.get("conclusion")
    print(f"poll {attempt}: {status} {conclusion}", flush=True)
    if status == "completed":
        with urllib.request.urlopen(jobs_url, timeout=15) as resp:
            jobs = json.load(resp)["jobs"]
        for job in jobs:
            failed = [s["name"] for s in job["steps"] if s["conclusion"] == "failure"]
            print(f'  {job["name"]}: {job["conclusion"]}' + (f" | failed: {failed}" if failed else ""), flush=True)
        sys.exit(0 if conclusion == "success" else 1)
    time.sleep(30)
print("timeout waiting", flush=True)
sys.exit(2)
