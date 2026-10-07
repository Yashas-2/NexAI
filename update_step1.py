import re

f1 = r'E:\NexAI\FrontEnd\src\apps\coe\features\allocations\components\wizard\steps\Step1ScopeSchedule.tsx'
data1 = open(f1, 'r', encoding='utf-8').read()
data1 = data1.replace('Exam Start Date', 'Exam Cycle Start Date')
data1 = data1.replace('Exam End Date', 'Exam Cycle End Date')
open(f1, 'w', encoding='utf-8').write(data1)

print('Updated Step1 successfully')
