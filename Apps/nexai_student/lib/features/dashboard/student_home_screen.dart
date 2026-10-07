import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';
import '../../services/api_service.dart';
import '../auth/login_screen.dart';
import '../admit_card/admit_card_screen.dart';
import '../courses/courses_attendance_cie_screen.dart';
import '../live_exam/live_exam_portal_tab.dart';
import '../results/results_ledger_screen.dart';

class StudentHomeScreen extends StatefulWidget {
  const StudentHomeScreen({super.key});

  @override
  State<StudentHomeScreen> createState() => _StudentHomeScreenState();
}

class _StudentHomeScreenState extends State<StudentHomeScreen> {
  int _currentIndex = 0;

  final List<_NavDestinationItem> _navItems = const [
    _NavDestinationItem(
      label: 'Exams',
      icon: Icons.dashboard_outlined,
      activeIcon: Icons.dashboard_rounded,
    ),
    _NavDestinationItem(
      label: 'Courses',
      icon: Icons.menu_book_outlined,
      activeIcon: Icons.menu_book_rounded,
    ),
    _NavDestinationItem(
      label: 'Ticket',
      icon: Icons.badge_outlined,
      activeIcon: Icons.badge_rounded,
    ),
    _NavDestinationItem(
      label: 'Live Exam',
      icon: Icons.videocam_outlined,
      activeIcon: Icons.videocam_rounded,
    ),
    _NavDestinationItem(
      label: 'Results',
      icon: Icons.grade_outlined,
      activeIcon: Icons.grade_rounded,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgBase,
      body: Stack(
        children: [
          // Screen Viewport
          Positioned.fill(
            child: IndexedStack(
              index: _currentIndex,
              children: const [
                _StudentDashboardTab(),
                CoursesAttendanceCieScreen(),
                AdmitCardScreen(),
                LiveExamPortalTab(),
                ResultsLedgerScreen(),
              ],
            ),
          ),

          // ── Modern Floating Island Task Bar ──
          Positioned(
            left: 14,
            right: 14,
            bottom: 16,
            child: Container(
              height: 64,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A).withValues(alpha: 0.94),
                borderRadius: BorderRadius.circular(32),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.15),
                  width: 1.2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.35),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                  BoxShadow(
                    color: AppTheme.primary.withValues(alpha: 0.15),
                    blurRadius: 16,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: List.generate(_navItems.length, (idx) {
                  final item = _navItems[idx];
                  final isSelected = _currentIndex == idx;

                  return InkWell(
                    onTap: () => setState(() => _currentIndex = idx),
                    borderRadius: BorderRadius.circular(24),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      curve: Curves.easeOutCubic,
                      padding: EdgeInsets.symmetric(
                        horizontal: isSelected ? 12 : 8,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppTheme.primary
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: isSelected
                            ? [
                                BoxShadow(
                                  color: AppTheme.primary.withValues(alpha: 0.4),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ]
                            : null,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isSelected ? item.activeIcon : item.icon,
                            size: 20,
                            color: isSelected ? Colors.white : Colors.white60,
                          ),
                          if (isSelected) ...[
                            const SizedBox(width: 6),
                            Text(
                              item.label,
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                }),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NavDestinationItem {
  final String label;
  final IconData icon;
  final IconData activeIcon;

  const _NavDestinationItem({
    required this.label,
    required this.icon,
    required this.activeIcon,
  });
}

class _StudentDashboardTab extends StatefulWidget {
  const _StudentDashboardTab();

  @override
  State<_StudentDashboardTab> createState() => _StudentDashboardTabState();
}

class _StudentDashboardTabState extends State<_StudentDashboardTab> {
  Map<String, dynamic>? studentProfile;
  List<dynamic> _hallTickets = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      final profileData = await ApiService.get('/student/portal/my_profile/');
      final ticketsData = await ApiService.get('/student/portal/my_hall_tickets/');
      if (mounted) {
        setState(() {
          studentProfile = profileData;
          _hallTickets = ticketsData is List ? ticketsData : [];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        final errStr = e.toString();
        // Token totally expired and refresh failed → go back to login
        if (errStr.contains('401') || errStr.contains('token_not_valid') || errStr.contains('Token is invalid')) {
          await ApiService.logout();
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (_) => const LoginScreen()),
            (_) => false,
          );
          return;
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load data: $e'), backgroundColor: Colors.red),
        );
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final student = studentProfile ?? {};
    final fullName = student['name'] ?? 'Student';
    final usn = student['usn'] ?? '';
    final semester = 'Semester ${student['semester'] ?? ''}';
    final program = 'B.Tech - ${student['department'] ?? ''}';
    final initials = fullName.split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join('').toUpperCase();
    
    // Build exam list from real hall tickets
    final List<Map<String, dynamic>> exams = [];
    for (final ticket in _hallTickets) {
      final schedule = ticket['schedule'] ?? ticket['slots'] ?? [];
      for (final slot in schedule) {
        exams.add({
          'subject_code': slot['subject_code'] ?? '',
          'subject_name': slot['subject_name'] ?? slot['subject_title'] ?? '',
          'exam_date': slot['exam_date'] ?? slot['date'] ?? '',
          'exam_time': slot['exam_time'] ?? '${slot['start_time'] ?? ''} - ${slot['end_time'] ?? ''}',
          'room': slot['room'] ?? slot['room_number'] ?? '',
          'seat': slot['seat'] ?? slot['desk_number'] ?? '',
          'question_paper_id': slot['question_paper_id'],
        });
      }
    }

    return Scaffold(
      backgroundColor: AppTheme.bgBase,
      appBar: AppBar(
        title: Row(
          children: [
            const Icon(Icons.school, color: AppTheme.primary, size: 20),
            const SizedBox(width: 8),
            Text(
              'NexAI Student',
              style: GoogleFonts.inter(fontWeight: FontWeight.w900, fontSize: 17),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('No unread exam notifications')),
              );
            },
            icon: const Icon(Icons.notifications_none_rounded),
          ),
          IconButton(
            onPressed: () async {
              await ApiService.logout();
              if (mounted) {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
              }
            },
            icon: const Icon(Icons.logout, color: Colors.redAccent),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 96),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Student Profile Ribbon
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppTheme.bgSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppTheme.cardBorder),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 10,
                  ),
                ],
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: AppTheme.primary,
                    child: Text(
                      initials,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          fullName,
                          style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 16),
                        ),
                        Text(
                          '$usn • $semester',
                          style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                        ),
                        Text(
                          program,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: AppTheme.accentBlue, fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryLight,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Column(
                      children: [
                        const Text('CGPA', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppTheme.primaryDark)),
                        Text('${student['cgpa'] ?? 'N/A'}', style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.primaryDark, fontSize: 14)),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 18),

            // Active Next Exam Countdown Card
            if (exams.isNotEmpty) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.12),
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
                            color: AppTheme.accentAmber.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: AppTheme.accentAmber.withValues(alpha: 0.5)),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.timer, color: AppTheme.accentAmber, size: 12),
                              SizedBox(width: 4),
                              Text('NEXT SCHEDULED EXAM', style: TextStyle(color: AppTheme.accentAmber, fontSize: 10, fontWeight: FontWeight.w800)),
                            ],
                          ),
                        ),
                        Text(exams.first['exam_date'] ?? '', style: const TextStyle(color: Colors.white70, fontSize: 11)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      '${exams.first['subject_code']}: ${exams.first['subject_name']}',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 17),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${exams.first['room']} • Seat ${exams.first['seat']}',
                      style: const TextStyle(color: Color(0xFF4ADE80), fontWeight: FontWeight.w700, fontSize: 13),
                    ),
                    const SizedBox(height: 16),

                    // Time Slot
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.access_time, color: Colors.white70, size: 14),
                          const SizedBox(width: 6),
                          Text(exams.first['exam_time'] ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
            ],

            // Registered Course Timetable
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Registered Exam Timetable', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                Text('${exams.length} Courses', style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
              ],
            ),
            const SizedBox(height: 12),

            if (exams.isEmpty)
              const Text('No exams scheduled yet.', style: TextStyle(color: AppTheme.textSecondary)),

            ...exams.map((exam) {
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
                        color: AppTheme.primaryLight,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.event_note, color: AppTheme.primaryDark),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${exam['subject_code']}: ${exam['subject_name']}', style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 13)),
                          const SizedBox(height: 2),
                          Text('${exam['exam_date']} • ${exam['exam_time']}', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
                          const SizedBox(height: 2),
                          Text(exam['room'] ?? '', style: const TextStyle(color: AppTheme.accentBlue, fontSize: 11, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryLight,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        exam['seat'] ?? '',
                        style: const TextStyle(color: AppTheme.primaryDark, fontWeight: FontWeight.w900, fontSize: 12),
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

  static Widget _buildCountdownPill(String value, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16)),
          Text(label, style: const TextStyle(color: Colors.white60, fontSize: 9, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
