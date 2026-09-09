import urllib.request, json
req = urllib.request.Request('http://127.0.0.1:8000/api/v1/scheduling/exam-sessions/?status=ACTIVE')
try:
    with urllib.request.urlopen(req) as res:
        print(res.read().decode())
except Exception as e:
    print(e)
