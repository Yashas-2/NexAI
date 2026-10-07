import sqlite3
conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()
cursor.execute('SELECT usn, full_name, email FROM users_student JOIN users_user ON users_student.user_id = users_user.id')
for row in cursor.fetchall():
    if 'aarav' in row[1].lower():
        print(row)

