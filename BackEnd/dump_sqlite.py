import sqlite3

conn = sqlite3.connect('db.sqlite3')
cur = conn.cursor()
cur.execute('SELECT status, paper_content FROM cie_question_paper_scrutiny;')
for row in cur.fetchall():
    print(f'Status: {row[0]}')
    print(row[1])
    print('-'*40)
