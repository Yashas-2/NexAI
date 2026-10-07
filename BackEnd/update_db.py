import sqlite3
import json

conn = sqlite3.connect('db.sqlite3')
cur = conn.cursor()
paper_content = {
    'duration_mins': 60,
    'questions': [
        {
            'questionNumber': 1,
            'questionText': 'PM of India',
            'marks': 10,
            'type': 'THEORY',
            'options': []
        },
        {
            'questionNumber': 2,
            'questionText': 'CM',
            'marks': 10,
            'type': 'THEORY',
            'options': []
        }
    ]
}

cur.execute('UPDATE cie_ciequestionpaperscrutiny SET paper_content = ?', (json.dumps(paper_content),))
conn.commit()
cur.execute('SELECT id, status, paper_content FROM cie_ciequestionpaperscrutiny LIMIT 1')
print("DB UPDATE SUCCESS", cur.fetchall())
conn.close()
