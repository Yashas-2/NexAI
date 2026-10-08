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
  List<dynamic> _notifications = [];
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
      List<dynamic> notifications = [];
      try {
        final notifData = await ApiService.get('/notifications/');
        notifications = notifData is List ? notifData : [];
      } catch (_) {
        // Notifications are non-critical — never block the dashboard
      }
      if (mounted) {
        setState(() {
          studentProfile = profileData;
          _hallTickets = ticketsData is List ? ticketsData : [];
          _notifications = notifications;
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

  int get _unreadCount => _notifications.where((n) => n['is_read'] == false).length;

  Future<void> _showNotifications() async {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.6,
        decoration: const BoxDecoration(
          color: AppTheme.bgSurface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
            ),
            Padding(
              padding: const EdgeInsets.all(18),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Exam Notifications', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  if (_unreadCount > 0)
                    TextButton(
                      onPressed: () async {
                        try {
                          await ApiService.post('/notifications/mark_all_read/', {});
                          if (mounted) {
                            Navigator.pop(context);
                            _fetchData();
                          }
                        } catch (e) {
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
                            );
                          }
                        }
                      },
                      child: const Text('Mark all read'),
                    ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: _notifications.isEmpty
                  ? const Center(
                      child: Text('No notifications yet.', style: TextStyle(color: AppTheme.textSecondary)),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _notifications.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final n = _notifications[index];
                        final isUnread = n['is_read'] == false;
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(
                            isUnread ? Icons.mail : Icons.mark_email_read_outlined,
                            color: isUnread ? AppTheme.primary : AppTheme.textSecondary,
                          ),
                          title: Text(
                            '${n['title'] ?? ''}',
                            style: TextStyle(
                              fontWeight: isUnread ? FontWeight.w800 : FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                          subtitle: Text(
                            '${n['message'] ?? ''}',
                            style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                          ),
                          trailing: Text(
                            '${n['created_at'] ?? ''}'.replaceFirst('T', ' ').split('.').first,
                            style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
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
    final department = '${student['department'] ?? ''}';
    final batchYear = student['batch_year'];
    final program = batchYear != null ? '$department • Batch $batchYear' : department;
    final initials = fullName.split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join('').toUpperCase();
    final cgpa = student['cgpa'];
    
    // Build exam list from real hall tickets (active schedule only —
    // the backend already excludes rescheduled/cancelled slots)
    final List<Map<String, dynamic>> exams = [];
    for (final ticket in _hallTickets) {
      final schedule = ticket['schedule'] ?? ticket['slots'] ?? [];
      for (final slot in schedule) {
        final examDate = slot['exam_date'] ?? slot['date'];
        // Only scheduled exams — entries without a published date are hidden
        if (examDate == null || '$examDate'.trim().isEmpty) continue;
        exams.add({
          'subject_code': slot['subject_code'] ?? '',
          'subject_name': slot['subject_name'] ?? slot['subject_title'] ?? '',
          'exam_date': examDate,
          'exam_time': slot['exam_time'],
          'start_time': slot['start_time'],
          'room': slot['room'],
          'seat': slot['seat'],
          'question_paper_id': slot['question_paper_id'],
          'is_cie': slot['is_cie'] != false,
          '_start': _parseExamStart(examDate, slot['start_time']),
        });
      }
    }

    // Sort chronologically (exams without a date go last)
    exams.sort((a, b) {
      final da = a['_start'] as DateTime?;
      final db = b['_start'] as DateTime?;
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da.compareTo(db);
    });

    final now = DateTime.now();
    final upcomingExams = exams
        .where((e) => e['_start'] != null && (e['_start'] as DateTime).isAfter(now))
        .toList();
    final nextExam = upcomingExams.isNotEmpty ? upcomingExams.first : null;
    final Duration? countdown = nextExam != null
        ? (nextExam['_start'] as DateTime).difference(now)
        : null;
    final hasCgpa = cgpa != null && cgpa.toString() != 'null';

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
            onPressed: _showNotifications,
            icon: Badge(
              isLabelVisible: _unreadCount > 0,
              label: Text('$_unreadCount'),
              child: const Icon(Icons.notifications_none_rounded),
            ),
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
                        Text(
                          hasCgpa ? double.parse(cgpa.toString()).toStringAsFixed(2) : '—',
                          style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.primaryDark, fontSize: 14),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 18),

            // Active Next Exam Countdown Card
            if (nextExam != null && countdown != null) ...[
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
                        Text(nextExam['exam_date'] ?? 'Date TBA', style: const TextStyle(color: Colors.white70, fontSize: 11)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      '${nextExam['subject_code']}: ${nextExam['subject_name']}',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 17),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${nextExam['room'] ?? 'Room TBA'} • Seat ${nextExam['seat'] ?? 'TBA'}',
                      style: const TextStyle(color: Color(0xFF4ADE80), fontWeight: FontWeight.w700, fontSize: 13),
                    ),
                    const SizedBox(height: 16),

                    // Real countdown to the exam start
                    Row(
                      children: [
                        _buildCountdownPill('${countdown.inDays}', 'DAYS'),
                        const SizedBox(width: 10),
                        _buildCountdownPill('${countdown.inHours % 24}', 'HOURS'),
                        const SizedBox(width: 10),
                        _buildCountdownPill('${countdown.inMinutes % 60}', 'MINS'),
                      ],
                    ),
                    const SizedBox(height: 12),

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
                          Text(nextExam['exam_time'] ?? 'Time TBA', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
            ] else if (exams.isNotEmpty) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.bgSurface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.cardBorder),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.event_available_outlined, color: AppTheme.textSecondary, size: 18),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'No upcoming exams — all scheduled exams have concluded.',
                        style: TextStyle(color: AppTheme.textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
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
                          Text('${exam['exam_date'] ?? 'Date TBA'} • ${exam['exam_time'] ?? 'Time TBA'}', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
                          const SizedBox(height: 2),
                          Text('${exam['room'] ?? 'Room TBA'}', style: const TextStyle(color: AppTheme.accentBlue, fontSize: 11, fontWeight: FontWeight.w600)),
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
                        '${exam['seat'] ?? '—'}',
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

  static DateTime? _parseExamStart(dynamic dateStr, dynamic startTime) {
    if (dateStr == null) return null;
    DateTime? date;
    try {
      date = DateTime.parse(dateStr.toString());
    } catch (_) {
      return null;
    }
    if (startTime == null) return date;
    final parts = startTime.toString().split(':');
    if (parts.length < 2) return date;
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) return date;
    return DateTime(date.year, date.month, date.day, hour, minute);
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
