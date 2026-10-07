import sqlite3
conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()
cursor.execute('SELECT name FROM sqlite_master WHERE type="table"')
print([r[0] for r in cursor.fetchall()])
cursor.execute('SELECT count(*) FROM cie_question_paper_scrutiny')
print('Scrutiny count:', cursor.fetchone())
cursor.execute('SELECT count(*) FROM vault_question_paper')
print('Vault count:', cursor.fetchone())

