import re

# Update Step1ScopeSchedule.tsx
f1 = r'E:\NexAI\FrontEnd\src\apps\coe\features\allocations\components\wizard\steps\Step1ScopeSchedule.tsx'
data1 = open(f1, 'r', encoding='utf-8').read()
data1 = data1.replace('>Exam Start Date<', '>Exam Cycle Start Date<')
data1 = data1.replace('>Exam End Date<', '>Exam Cycle End Date<')
open(f1, 'w', encoding='utf-8').write(data1)

# Update Step2SubjectMatrix.tsx
f2 = r'E:\NexAI\FrontEnd\src\apps\coe\features\allocations\components\wizard\steps\Step2SubjectMatrix.tsx'
data2 = open(f2, 'r', encoding='utf-8').read()

target_div = '''                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>SEE Written</span>
              </div>'''

replacement = target_div + '''
              {isSelected && (
                <div style={{ marginTop: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }} onClick={e => e.stopPropagation()}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px', color: '#1E293B' }}>Subject Exam Date (Must be within Cycle)</label>
                  <input
                    type="date"
                    min={scopeConfig.startDate}
                    max={scopeConfig.endDate}
                    value={selectedSubjects.find(s => s.code === sub.code)?.examDate || ''}
                    onChange={e => {
                      const newDate = e.target.value;
                      onSubjectsChange(selectedSubjects.map(s => s.code === sub.code ? { ...s, examDate: newDate } : s));
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.8rem',
                      outline: 'none',
                    }}
                  />
                </div>
              )}'''

data2 = data2.replace(target_div, replacement)
open(f2, 'w', encoding='utf-8').write(data2)

print('Updated successfully')
