import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';
import '../../services/api_service.dart';
import '../../models/student_models.dart';
import 'biometric_face_verification_screen.dart';

class LiveExamPortalTab extends StatefulWidget {
  const LiveExamPortalTab({super.key});

  @override
  State<LiveExamPortalTab> createState() => _LiveExamPortalTabState();
}

class _LiveExamPortalTabState extends State<LiveExamPortalTab> {
  bool _isLoading = true;
  List<ExamScheduleItem> _exams = [];
  Timer? _refreshTimer;
  bool _isStartingExam = false;

  @override
  void initState() {
    super.initState();
    _fetchExams();
    // Auto-refresh every 30 seconds to detect newly active exams
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) _fetchExams();
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

Future<void> _fetchExams() async {
    try {
      final ticketsData = await ApiService.get('/student/portal/my_hall_tickets/');
      if (mounted) {
        final List<ExamScheduleItem> loadedExams = [];
        if (ticketsData is List) {
          for (final ticket in ticketsData) {
            final schedule = ticket['schedule'] ?? ticket['slots'] ?? [];
            for (final slot in schedule) {
              // Only exams with a published schedule — no "TBA" placeholders.
              final examDate = slot['exam_date'] ?? slot['date'];
              if (examDate == null || '$examDate'.trim().isEmpty) continue;
              final startTime = slot['start_time'];
              final endTime = slot['end_time'];
              final examTime = slot['exam_time'] ??
                  (startTime != null && endTime != null ? '$startTime - $endTime' : '');
              final eligible = slot['eligible'];
              loadedExams.add(ExamScheduleItem(
                courseCode: slot['subject_code'] ?? '',
                courseTitle: slot['subject_name'] ?? slot['subject_title'] ?? '',
                examDate: '$examDate',
                timeSlot: examTime,
                hallNumber: slot['room'] ?? slot['room_number'] ?? '',
                deskNumber: slot['seat'] ?? slot['desk_number'] ?? '',
                eligibilityStatus: eligible == true
                    ? 'ELIGIBLE'
                    : (eligible == false ? 'NOT ELIGIBLE' : 'PENDING'),
                qrPayload: slot['subject_code'] ?? '',
                questionPaperId: slot['question_paper_id'],
                slotId: slot['slot_id'],
                sessionName: ticket['exam_session_name'],
                isCie: slot['is_cie'] != false,
              ));
            }
          }
          
          // Fetch exam attempt status for each exam
          for (var exam in loadedExams) {
            if (exam.slotId != null) {
              try {
                final statusData = await ApiService.get('/student/portal/exam_attempt_status/?slot_id=${exam.slotId}');
                if (mounted) {
                  // Find the exam in the list and update its status
                  final idx = loadedExams.indexWhere((e) => e.slotId == exam.slotId);
                  if (idx != -1) {
                    loadedExams[idx] = ExamScheduleItem(
                      courseCode: exam.courseCode,
                      courseTitle: exam.courseTitle,
                      examDate: exam.examDate,
                      timeSlot: exam.timeSlot,
                      hallNumber: exam.hallNumber,
                      deskNumber: exam.deskNumber,
                      eligibilityStatus: exam.eligibilityStatus,
                      qrPayload: exam.qrPayload,
                      questionPaperId: exam.questionPaperId,
                      slotId: exam.slotId,
                      sessionName: exam.sessionName,
                      isCie: exam.isCie,
                      attemptCompleted: statusData['is_completed'] == true,
                      attemptSubmittedAt: statusData['submitted_at'] != null 
                          ? DateTime.tryParse(statusData['submitted_at']) : null,
                      isLocked: statusData['is_locked'] == true,
                      attemptId: statusData['attempt_id'],
                      examEnded: statusData['exam_ended'] == true,
                    );
                  }
                }
              } catch (e) {
                // If status check fails, keep original exam with default values
                debugPrint('Failed to fetch exam status for ${exam.slotId}: $e');
              }
            }
          }
          
          loadedExams.sort((a, b) {
            DateTime? dateA, dateB;
            try {
              dateA = DateTime.parse('${a.examDate} ${a.timeSlot.split('-')[0].trim()}');
            } catch (_) {
              try { dateA = DateTime.parse(a.examDate); } catch (_) {}
            }
            try {
              dateB = DateTime.parse('${b.examDate} ${b.timeSlot.split('-')[0].trim()}');
            } catch (_) {
              try { dateB = DateTime.parse(b.examDate); } catch (_) {}
            }
            
            if (dateA != null && dateB != null) {
              return dateA.compareTo(dateB);
            }
            return a.examDate.compareTo(b.examDate);
          });

          // Drop exams that have already ended — the terminal only lists
          // upcoming and currently-active exams.
          final now = DateTime.now();
          loadedExams.removeWhere((e) {
            final end = _examEnd(e);
            return end != null && now.isAfter(end);
          });
        }
        setState(() {
          _exams = loadedExams;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  /// End datetime of an exam, or null when the schedule is not published yet.
  static DateTime? _examEnd(ExamScheduleItem exam) {
    if (exam.examDate.isEmpty || exam.timeSlot.isEmpty) return null;
    try {
      final parts = exam.timeSlot.split('-');
      if (parts.length != 2) return null;
      final endParts = parts[1].trim().split(':');
      if (endParts.length != 2) return null;
      final date = DateTime.parse(exam.examDate);
      var end = DateTime(date.year, date.month, date.day,
          int.parse(endParts[0]), int.parse(endParts[1]));
      final startParts = parts[0].trim().split(':');
      if (startParts.length == 2) {
        final start = DateTime(date.year, date.month, date.day,
            int.parse(startParts[0]), int.parse(startParts[1]));
        if (end.isBefore(start)) end = end.add(const Duration(days: 1));
      }
      return end;
    } catch (_) {
      return null;
    }
  }

  /// Parse time slot and check if the exam is currently active.
  /// Returns true if current time is within [start - 15min, end].
  bool _isExamActive(ExamScheduleItem exam, DateTime now) {
    if (exam.examDate.isEmpty || exam.timeSlot.isEmpty) return false;
    try {
      final parts = exam.timeSlot.split('-');
      if (parts.length != 2) return false;
      final startParts = parts[0].trim().split(':');
      final endParts = parts[1].trim().split(':');
      if (startParts.length != 2 || endParts.length != 2) return false;
      final date = DateTime.parse(exam.examDate);
      final startDateTime = DateTime(date.year, date.month, date.day, int.parse(startParts[0]), int.parse(startParts[1]));
      var endDateTime = DateTime(date.year, date.month, date.day, int.parse(endParts[0]), int.parse(endParts[1]));
      if (endDateTime.isBefore(startDateTime)) {
        endDateTime = endDateTime.add(const Duration(days: 1));
      }
      return now.isAfter(startDateTime.subtract(const Duration(minutes: 15))) && now.isBefore(endDateTime);
    } catch (_) {
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        backgroundColor: AppTheme.bgBase,
        appBar: AppBar(title: const Text('AI Proctored Exam Terminal')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    
    if (_exams.isEmpty) {
      return Scaffold(
        backgroundColor: AppTheme.bgBase,
        appBar: AppBar(title: const Text('AI Proctored Exam Terminal')),
        body: const Center(child: Text('No upcoming exams scheduled.', style: TextStyle(color: Colors.white))),
      );
    }

    final now = DateTime.now();
    // Exams that are currently in their time window AND not completed/ended get the Start button
    List<ExamScheduleItem> activeExams = [];
    List<ExamScheduleItem> scheduledExams = [];

    for (var exam in _exams) {
      final isCompleted = exam.attemptCompleted || exam.isLocked;
      final isEnded = exam.examEnded;
      final isActive = _isExamActive(exam, now) && !exam.attemptCompleted && !exam.isLocked && !exam.examEnded;
      
      if (isActive) {
        activeExams.add(exam);
      } else {
        scheduledExams.add(exam);
      }
    }

    final sessionNames = <String>{};
    for (final e in _exams) {
      final name = e.sessionName;
      if (name != null && name.isNotEmpty) sessionNames.add(name);
    }
    final sessionLabel = sessionNames.isEmpty ? 'No session' : sessionNames.join(' • ');

    return Scaffold(
      backgroundColor: AppTheme.bgBase,
      appBar: AppBar(
        title: Row(
          children: [
            const Icon(Icons.verified_user, color: AppTheme.primary, size: 20),
            const SizedBox(width: 8),
            Text(
              'AI Proctored Exam Terminal',
              style: GoogleFonts.inter(fontWeight: FontWeight.w900, fontSize: 16),
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _fetchExams,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 96),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Top Security & Kiosk Readiness Banner ──
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF4ADE80).withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xFF4ADE80).withValues(alpha: 0.5)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.shield, color: Color(0xFF4ADE80), size: 12),
                            SizedBox(width: 4),
                            Text('KIOSK SECURITY ACTIVE', style: TextStyle(color: Color(0xFF4ADE80), fontSize: 10, fontWeight: FontWeight.w800)),
                          ],
                        ),
                      ),
                      const Text('NexAI FaceNet v2.4', style: TextStyle(color: Colors.white60, fontSize: 10, fontWeight: FontWeight.w700)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'AI Real-Time Proctoring & Biometric Gate',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Selecting an active exam will initiate mandatory pre-exam face verification and lock your phone in AI proctored mode.',
                    style: TextStyle(color: Colors.white70, fontSize: 11, height: 1.3),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // ── Active / Scheduled Exams Section ──
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Upcoming Degree Examinations (${_exams.length})',
                  style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 14),
                ),
                Text(
                  activeExams.isNotEmpty ? '${activeExams.length} LIVE' : sessionLabel,
                  style: TextStyle(
                    fontSize: 11,
                    color: activeExams.isNotEmpty ? AppTheme.accentGreen : AppTheme.textSecondary,
                    fontWeight: activeExams.isNotEmpty ? FontWeight.w800 : FontWeight.normal,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Active Exam Cards (ALL exams currently in their time window)
            ...activeExams.map((exam) => _buildActiveExamCard(exam)),

            const SizedBox(height: 16),

            // Remaining Upcoming Exams
            ...scheduledExams.map((exam) {
              final isCompleted = exam.attemptCompleted || exam.isLocked;
              final isEnded = exam.examEnded;
              final canStart = exam.isButtonEnabled;
              
              Color borderColor = canStart ? AppTheme.cardBorder : AppTheme.textSecondary.withValues(alpha: 0.3);
              Color badgeColor = canStart ? const Color(0xFFEFF6FF) : const Color(0xFFF1F5F9);
              Color badgeTextColor = canStart ? AppTheme.accentBlue : AppTheme.textSecondary;
              String badgeText = exam.statusText;

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.bgSurface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: borderColor),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: badgeColor,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        canStart ? Icons.lock_clock : Icons.lock,
                        color: badgeTextColor,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${exam.courseCode}: ${exam.courseTitle}', style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 13)),
                          const SizedBox(height: 2),
                          Text('${exam.examDate} • ${exam.timeSlot}', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
                          const SizedBox(height: 2),
                          Text(exam.hallNumber.isEmpty ? '—' : exam.hallNumber, style: const TextStyle(color: AppTheme.accentBlue, fontSize: 11, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: badgeColor,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        badgeText,
                        style: TextStyle(
                          color: badgeTextColor,
                          fontWeight: FontWeight.w800,
                          fontSize: 10,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
      ),
    );
  }

  Widget _buildActiveExamCard(ExamScheduleItem exam) {
    // Determine card styling based on exam status
    final isCompleted = exam.attemptCompleted || exam.isLocked;
    final isEnded = exam.examEnded;
    final canStart = exam.isButtonEnabled;
    
    Color borderColor = canStart ? AppTheme.primary : AppTheme.textSecondary.withValues(alpha: 0.5);
    Color badgeColor = canStart ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9);
    Color badgeTextColor = canStart ? const Color(0xFF166534) : AppTheme.textSecondary;
    IconData badgeIcon = canStart ? Icons.circle : Icons.lock;
    String badgeText = exam.statusText;
    Color badgeTextColor2 = canStart ? const Color(0xFF166534) : AppTheme.textSecondary;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: borderColor, width: canStart ? 1.8 : 1),
        boxShadow: canStart ? [
          BoxShadow(
            color: AppTheme.primary.withValues(alpha: 0.12),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ] : [],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: badgeColor,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(badgeIcon, color: badgeTextColor, size: 8),
                    const SizedBox(width: 4),
                    Text(badgeText, style: TextStyle(color: badgeTextColor2, fontWeight: FontWeight.w900, fontSize: 10)),
                  ],
                ),
              ),
              Text(exam.deskNumber.isEmpty ? '—' : exam.deskNumber, style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.primaryDark, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '${exam.courseCode}: ${exam.courseTitle}',
            style: GoogleFonts.inter(fontWeight: FontWeight.w900, fontSize: 16),
          ),
          const SizedBox(height: 4),
          Text(
            '${exam.hallNumber.isEmpty ? '—' : exam.hallNumber} • ${exam.timeSlot}',
            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 16),
          const Divider(height: 1),
          const SizedBox(height: 16),

          // Start Exam Button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              onPressed: canStart && !_isStartingExam ? () => _startExam(exam) : null,
              icon: _isStartingExam 
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.face, size: 18),
              label: Text(
                _isStartingExam ? 'Checking Attendance...' : exam.buttonText, 
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: canStart ? AppTheme.primary : AppTheme.textSecondary.withValues(alpha: 0.3),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _startExam(ExamScheduleItem exam) async {
    if (_isStartingExam) return;
    if (exam.slotId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error: slot_id is missing')));
      return;
    }
    
    setState(() {
      _isStartingExam = true;
    });

    bool isDialogShowing = true;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: AppTheme.bgSurface,
        title: const Text('Checking Attendance', style: TextStyle(color: AppTheme.textPrimary)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: const [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Please wait for the invigilator to mark you as present...', style: TextStyle(color: AppTheme.textSecondary), textAlign: TextAlign.center),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              isDialogShowing = false;
              if (mounted) setState(() => _isStartingExam = false);
              Navigator.pop(context);
            },
            child: const Text('Cancel', style: TextStyle(color: AppTheme.primary)),
          )
        ],
      ),
    ).then((_) {
      isDialogShowing = false;
      if (mounted) setState(() => _isStartingExam = false);
    });
    
    try {
      bool isPresent = false;
      for (int i = 0; i < 30; i++) {
        if (!isDialogShowing) break;
        final res = await ApiService.get('/student/portal/my_attendance/?slot_id=${exam.slotId}');
        if (res['is_present'] == true) {
          isPresent = true;
          break;
        }
        await Future.delayed(const Duration(seconds: 2));
      }
      
      if (!mounted) return;
      
      if (isDialogShowing) {
        Navigator.pop(context);
        isDialogShowing = false;
      }
      
      if (isPresent) {
        if (mounted) setState(() => _isStartingExam = false);
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => BiometricFaceVerificationScreen(exam: exam),
          ),
        );
      } else if (!isPresent && isDialogShowing) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Invigilator has not marked you present yet. Please try again.')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      if (isDialogShowing) {
        Navigator.pop(context);
      }
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _isStartingExam = false);
    }
  }
}
