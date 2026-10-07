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
              loadedExams.add(ExamScheduleItem(
                courseCode: slot['subject_code'] ?? '',
                courseTitle: slot['subject_name'] ?? slot['subject_title'] ?? '',
                examDate: slot['exam_date'] ?? slot['date'] ?? '',
                timeSlot: slot['exam_time'] ?? '${slot['start_time'] ?? ''} - ${slot['end_time'] ?? ''}',
                hallNumber: slot['room'] ?? slot['room_number'] ?? '',
                deskNumber: slot['seat'] ?? slot['desk_number'] ?? '',
                eligibilityStatus: 'ELIGIBLE',
                qrPayload: slot['subject_code'] ?? '',
                questionPaperId: slot['question_paper_id'],
                slotId: slot['slot_id'],
              ));
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
    // ALL exams that are currently active (time window open) get the Start button
    List<ExamScheduleItem> activeExams = [];
    List<ExamScheduleItem> scheduledExams = [];

    for (var exam in _exams) {
      if (_isExamActive(exam, now)) {
        activeExams.add(exam);
      } else {
        scheduledExams.add(exam);
      }
    }

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
                  activeExams.isNotEmpty ? '${activeExams.length} LIVE' : 'Fall 2026',
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
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.bgSurface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.cardBorder),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppTheme.bgBase,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.lock_clock, color: AppTheme.textSecondary),
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
                          Text(exam.hallNumber, style: const TextStyle(color: AppTheme.accentBlue, fontSize: 11, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text('SCHEDULED', style: TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.w800, fontSize: 10)),
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
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppTheme.bgSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.primary, width: 1.8),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primary.withValues(alpha: 0.12),
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
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.circle, color: AppTheme.accentGreen, size: 8),
                    SizedBox(width: 4),
                    Text('LIVE NOW • READY TO START', style: TextStyle(color: Color(0xFF166534), fontWeight: FontWeight.w900, fontSize: 10)),
                  ],
                ),
              ),
              Text(exam.deskNumber, style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.primaryDark, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '${exam.courseCode}: ${exam.courseTitle}',
            style: GoogleFonts.inter(fontWeight: FontWeight.w900, fontSize: 16),
          ),
          const SizedBox(height: 4),
          Text(
            '${exam.hallNumber} • ${exam.timeSlot}',
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
              onPressed: _isStartingExam ? null : () => _startExam(exam),
              icon: _isStartingExam 
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.face, size: 18),
              label: Text(
                _isStartingExam ? 'Checking Attendance...' : 'Verify Face & Enter Proctor Mode 🔒', 
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
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
