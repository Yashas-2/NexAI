import sqlite3
conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()
cursor.execute('SELECT count(*) FROM cie_configuration')
print('CIE config count:', cursor.fetchone())

