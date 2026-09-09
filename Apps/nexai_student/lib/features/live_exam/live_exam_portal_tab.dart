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

  @override
  void initState() {
    super.initState();
    _fetchExams();
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
              ));
            }
          }
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
    ExamScheduleItem? activeExam;
    List<ExamScheduleItem> scheduledExams = [];

    for (var exam in _exams) {
      bool isActive = false;
      if (exam.examDate.isNotEmpty && exam.timeSlot.isNotEmpty) {
        try {
          final parts = exam.timeSlot.split('-');
          if (parts.length == 2) {
            final startParts = parts[0].trim().split(':');
            final endParts = parts[1].trim().split(':');
            if (startParts.length == 2 && endParts.length == 2) {
              final date = DateTime.parse(exam.examDate);
              final startDateTime = DateTime(date.year, date.month, date.day, int.parse(startParts[0]), int.parse(startParts[1]));
              final endDateTime = DateTime(date.year, date.month, date.day, int.parse(endParts[0]), int.parse(endParts[1]));
              
              if (now.isAfter(startDateTime.subtract(const Duration(minutes: 15))) && now.isBefore(endDateTime)) {
                isActive = true;
              }
            }
          }
        } catch (_) {}
      }
      
      if (isActive && activeExam == null) {
        activeExam = exam;
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
      body: SingleChildScrollView(
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
                const Text('Fall 2026', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
              ],
            ),
            const SizedBox(height: 12),

            // Card 1: Active Exam (Live Now)
            if (activeExam != null)
            Container(
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
                      Text(activeExam.deskNumber, style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.primaryDark, fontSize: 12)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    '${activeExam.courseCode}: ${activeExam.courseTitle}',
                    style: GoogleFonts.inter(fontWeight: FontWeight.w900, fontSize: 16),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${activeExam.hallNumber} • ${activeExam.timeSlot}',
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
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => BiometricFaceVerificationScreen(exam: activeExam!),
                          ),
                        );
                      },
                      icon: const Icon(Icons.face, size: 18),
                      label: const Text('Verify Face & Enter Proctor Mode 🔒', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
              ),
            ),

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
    );
  }
}
