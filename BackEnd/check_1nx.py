import sqlite3
conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()
cursor.execute('SELECT * FROM users_student WHERE usn LIKE "%1NX%"')
print('Student 1NX:', cursor.fetchall())
cursor.execute('SELECT * FROM users_user WHERE full_name LIKE "%1NX%" OR email LIKE "%1NX%"')
print('User 1NX:', cursor.fetchall())

