import re

# Update models.py
f1 = r'E:\NexAI\BackEnd\users\models.py'
data1 = open(f1, 'r', encoding='utf-8').read()
data1 = data1.replace(
    'default=UserRole.STUDENT,\n        db_index=True,\n    )', 
    'default=UserRole.STUDENT,\n        db_index=True,\n    )\n    historical_duties_count = models.IntegerField(default=0)'
)
open(f1, 'w', encoding='utf-8').write(data1)

# Update serializers.py
f2 = r'E:\NexAI\BackEnd\users\serializers.py'
data2 = open(f2, 'r', encoding='utf-8').read()
data2 = data2.replace(
    '\"department\", \"is_active\", \"created_at\", \"plain_password\"',
    '\"department\", \"is_active\", \"created_at\", \"plain_password\", \"historical_duties_count\"'
)
open(f2, 'w', encoding='utf-8').write(data2)

# Update AllocationWizard.tsx
f3 = r'E:\NexAI\FrontEnd\src\apps\coe\features\allocations\components\AllocationWizard.tsx'
data3 = open(f3, 'r', encoding='utf-8').read()
data3 = data3.replace(
    'historicalDutyCount: 0,',
    'historicalDutyCount: f.historical_duties_count || 0,'
)
open(f3, 'w', encoding='utf-8').write(data3)

# Update Step4InvigilatorRoster.tsx
f4 = r'E:\NexAI\FrontEnd\src\apps\coe\features\allocations\components\wizard\steps\Step4InvigilatorRoster.tsx'
data4 = open(f4, 'r', encoding='utf-8').read()
data4 = data4.replace(
    'historicalDutyCount: Math.floor(Math.random() * 5),',
    'historicalDutyCount: f.historicalDutyCount || 0,'
)
open(f4, 'w', encoding='utf-8').write(data4)

print('Updated successfully')
