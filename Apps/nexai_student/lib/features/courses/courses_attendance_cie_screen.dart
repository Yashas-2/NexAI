import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';
import '../../services/api_service.dart';

class CoursesAttendanceCieScreen extends StatefulWidget {
  const CoursesAttendanceCieScreen({super.key});

  @override
  State<CoursesAttendanceCieScreen> createState() => _CoursesAttendanceCieScreenState();
}

class _CoursesAttendanceCieScreenState extends State<CoursesAttendanceCieScreen> {
  List<dynamic> _courses = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchCourses();
  }

  Future<void> _fetchCourses() async {
    try {
      final data = await ApiService.get('/student/portal/my_enrollments/');
      setState(() {
        _courses = data is List ? data : [];
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load courses: $e'), backgroundColor: Colors.red),
        );
      }
      setState(() => _isLoading = false);
    }
  }

  double? _attPct(dynamic course) {
    final v = course['attendance_percentage'];
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }

  double? _num(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString());
  }

  void _openCourseDetailsModal(dynamic course) {
    final attPct = _attPct(course);
    final cieMarks = _num(course['cie_marks']);
    final isEligible = course['is_eligible'];
    final coordinator = course['coordinator_name'];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.85,
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
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${course['subject_code']}: ${course['subject_title']}',
                          style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 16),
                        ),
                        Text(
                          'Course Coordinator: ${coordinator ?? 'Not assigned'}',
                          style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),

            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Attendance', style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 14)),
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppTheme.bgBase,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppTheme.cardBorder),
                      ),
                      child: attPct == null
                          ? const Row(
                              children: [
                                Icon(Icons.info_outline, color: AppTheme.textSecondary, size: 16),
                                SizedBox(width: 8),
                                Text(
                                  'Attendance not recorded for this subject yet.',
                                  style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                                ),
                              ],
                            )
                          : Column(
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Attendance', style: TextStyle(fontWeight: FontWeight.w700)),
                                    Text(
                                      '${attPct.toStringAsFixed(1)}%',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w900,
                                        fontSize: 16,
                                        color: attPct >= 85
                                            ? AppTheme.accentGreen
                                            : (attPct >= 75 ? AppTheme.accentAmber : AppTheme.accentRed),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                LinearProgressIndicator(
                                  value: attPct / 100,
                                  backgroundColor: Colors.grey.shade200,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    attPct >= 85
                                        ? AppTheme.accentGreen
                                        : (attPct >= 75 ? AppTheme.accentAmber : AppTheme.accentRed),
                                  ),
                                  minHeight: 8,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    Icon(
                                      isEligible == true ? Icons.verified : Icons.pending_actions_outlined,
                                      color: isEligible == true ? AppTheme.accentGreen : AppTheme.accentAmber,
                                      size: 16,
                                    ),
                                    const SizedBox(width: 6),
                                    Expanded(
                                      child: Text(
                                        isEligible == true
                                            ? 'Hall Ticket: Eligible (no shortage)'
                                            : (isEligible == false
                                                ? 'Hall Ticket: Not eligible — check with faculty'
                                                : 'Hall Ticket: Eligibility not yet evaluated'),
                                        style: TextStyle(
                                          color: isEligible == true
                                              ? AppTheme.accentGreen
                                              : AppTheme.accentAmber,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 11,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                    ),

                    const SizedBox(height: 20),

                    Text('CIE Internal Assessment', style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 14)),
                    const SizedBox(height: 10),

                    _buildCieRow(
                      'Internal Assessment Test 1 (IAT-1)',
                      _num(course['cie1'])?.toStringAsFixed(1) ?? 'Not entered',
                      'Entered by faculty',
                    ),
                    _buildCieRow(
                      'Internal Assessment Test 2 (IAT-2)',
                      _num(course['cie2'])?.toStringAsFixed(1) ?? 'Not entered',
                      'Entered by faculty',
                    ),
                    _buildCieRow(
                      'Internal Assessment Test 3 (IAT-3)',
                      _num(course['cie3'])?.toStringAsFixed(1) ?? 'Not entered',
                      'Entered by faculty',
                    ),
                    _buildCieRow(
                      'Lab / Assignment / Quiz',
                      _num(course['labOrProject'])?.toStringAsFixed(1) ?? 'Not entered',
                      'Evaluated continuously',
                    ),

                    const SizedBox(height: 14),

                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryLight,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('TOTAL AGGREGATED CIE', style: TextStyle(color: AppTheme.primaryDark, fontWeight: FontWeight.w800, fontSize: 11)),
                              Text('(out of 50)', style: TextStyle(fontSize: 10, color: AppTheme.textSecondary)),
                            ],
                          ),
                          Text(
                            cieMarks != null ? cieMarks.toStringAsFixed(1) : 'Not entered',
                            style: const TextStyle(color: AppTheme.primaryDark, fontWeight: FontWeight.w900, fontSize: 16),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCieRow(String label, String marks, String subtitle) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.bgBase,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.cardBorder),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                Text(subtitle, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 10)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.bgSurface,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AppTheme.cardBorder),
            ),
            child: Text(marks, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: AppTheme.accentBlue)),
          ),
        ],
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

    final attValues = _courses
        .map(_attPct)
        .whereType<double>()
        .toList();
    final avgAttendance = attValues.isEmpty
        ? null
        : attValues.reduce((a, b) => a + b) / attValues.length;
    final totalCredits = _courses.fold<int>(
      0,
      (sum, c) => sum + ((c['credits'] is num) ? (c['credits'] as num).toInt() : 0),
    );

    return Scaffold(
      backgroundColor: AppTheme.bgBase,
      appBar: AppBar(
        title: const Text('Enrollments & Attendance'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 96),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Metrics Header Banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('AVG. ATTENDANCE', style: TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
                      const SizedBox(height: 4),
                      Text(
                        avgAttendance != null ? '${avgAttendance.toStringAsFixed(1)}%' : '—',
                        style: TextStyle(
                          color: avgAttendance == null
                              ? Colors.white70
                              : (avgAttendance >= 85 ? const Color(0xFF4ADE80) : Colors.amber),
                          fontWeight: FontWeight.w900,
                          fontSize: 28,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        const Text('Total Credits', style: TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w600)),
                        Text('$totalCredits', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 18),

            // ── Registered Courses List ──
            if (_courses.isEmpty)
               const Text('No enrollments found.', style: TextStyle(color: AppTheme.textSecondary)),

            ..._courses.map((course) {
              final attPct = _attPct(course);
              final cieMarks = _num(course['cie_marks']);
              final credits = (course['credits'] is num) ? (course['credits'] as num).toInt() : null;
              final coordinator = course['coordinator_name'];

              Color attColor = AppTheme.textSecondary;
              if (attPct != null) {
                attColor = attPct >= 85
                    ? AppTheme.accentGreen
                    : (attPct >= 75 ? AppTheme.accentAmber : AppTheme.accentRed);
              }

              return InkWell(
                onTap: () => _openCourseDetailsModal(course),
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.bgSurface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.cardBorder),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.02),
                        blurRadius: 6,
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Course Title & Credits
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${course['subject_code']}: ${course['subject_title']}',
                                  style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 14),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Coordinator: ${coordinator ?? 'Not assigned'}',
                                  style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppTheme.primaryLight,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              credits != null ? '$credits Credits' : 'Credits —',
                              style: const TextStyle(color: AppTheme.primaryDark, fontWeight: FontWeight.w800, fontSize: 11),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 12),
                      const Divider(height: 1),
                      const SizedBox(height: 12),

                      // Attendance & CIE 2-Column Info
                      Row(
                        children: [
                          // Column 1: Attendance
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Attendance:', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary, fontWeight: FontWeight.w600)),
                                    Text(
                                      attPct != null ? '${attPct.toStringAsFixed(1)}%' : '—',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w900,
                                        fontSize: 12,
                                        color: attColor,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                LinearProgressIndicator(
                                  value: attPct != null ? attPct / 100 : null,
                                  backgroundColor: Colors.grey.shade200,
                                  valueColor: AlwaysStoppedAnimation<Color>(attColor),
                                  minHeight: 6,
                                  borderRadius: BorderRadius.circular(3),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  attPct != null
                                      ? (attPct >= 85 ? 'Meets 85% requirement' : 'Shortage — below 85%')
                                      : 'Attendance not recorded',
                                  style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(width: 16),
                          Container(height: 36, width: 1, color: AppTheme.cardBorder),
                          const SizedBox(width: 16),

                          // Column 2: CIE Marks
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('CIE Score:', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary, fontWeight: FontWeight.w600)),
                                    Text(
                                      cieMarks != null ? '${cieMarks.toStringAsFixed(1)} / 50' : 'Not entered',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w900,
                                        fontSize: 12,
                                        color: AppTheme.accentBlue,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                LinearProgressIndicator(
                                  value: cieMarks != null ? (cieMarks / 50).clamp(0.0, 1.0) : null,
                                  backgroundColor: Colors.grey.shade200,
                                  valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.accentBlue),
                                  minHeight: 6,
                                  borderRadius: BorderRadius.circular(3),
                                ),
                                const SizedBox(height: 4),
                                const Text('Eligibility: CIE ≥ 20/50 (with lab)', style: TextStyle(fontSize: 10, color: AppTheme.textSecondary)),
                              ],
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 10),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Text('View Component-wise Breakdown →', style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w700, fontSize: 11)),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
