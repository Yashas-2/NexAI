import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';
import '../../models/exam_models.dart';
import '../verification/qr_verifier_modal.dart';
import '../scanner/booklet_scanner_modal.dart';
import '../incident/report_incident_modal.dart';
import '../handover/session_handover_modal.dart';

import '../../repositories/invigilator_repository.dart';

class InvigilatorHomeScreen extends StatefulWidget {
  final String? sessionKey;
  
  const InvigilatorHomeScreen({super.key, this.sessionKey});

  @override
  State<InvigilatorHomeScreen> createState() => _InvigilatorHomeScreenState();
}

class _InvigilatorHomeScreenState extends State<InvigilatorHomeScreen> with SingleTickerProviderStateMixin {
  final InvigilatorRepository _repository = InvigilatorRepository();
  bool _isLoading = true;
  String? _errorMessage;
  late TabController _tabController;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadSession();
  }

  Future<void> _loadSession() async {
    if (widget.sessionKey == null) {
      setState(() {
        _errorMessage = 'No exam session key provided. Open a duty from "My Exam Duties" to start a session.';
        _isLoading = false;
      });
      return;
    }

    try {
      final session = await _repository.activateSession(widget.sessionKey!);
      setState(() {
        _session = session;
        _errorMessage = null;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _refreshSession() async {
    if (widget.sessionKey == null) return;
    try {
      final session = await _repository.activateSession(widget.sessionKey!);
      if (!mounted) return;
      setState(() => _session = session);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Session refreshed from server.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(InvigilatorRepository.extractApiError(e)),
        backgroundColor: Colors.red,
      ));
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  /// Marks attendance via backend (QR-validated when a payload is given).
  Future<AttendanceResult> _markAttendance(
    String usn, {
    String? qrPayload,
    String status = 'present',
  }) async {
    if (widget.sessionKey == null) {
      return const AttendanceResult(
        success: false,
        message: 'No active session key.',
      );
    }

    final result = await _repository.markAttendance(
      widget.sessionKey!,
      usn,
      qrPayload: qrPayload,
      status: status,
    );

    if (result.success && mounted) {
      final newStatus = _statusFrom(result.status);
      setState(() {
        _session = _session.copyWith(
          students: _session.students.map((s) {
            if (s.usn != usn) return s;
            return s.copyWith(
              status: newStatus,
              isQrVerified: s.isQrVerified || qrPayload != null,
            );
          }).toList(),
        );
      });
    }
    return result;
  }

  StudentAttendanceStatus _statusFrom(String raw) {
    switch (raw.toLowerCase()) {
      case 'present':
        return StudentAttendanceStatus.present;
      case 'absent':
        return StudentAttendanceStatus.absent;
      case 'malpractice':
        return StudentAttendanceStatus.malpractice;
      default:
        return StudentAttendanceStatus.unverified;
    }
  }

  Color _statusColor(StudentAttendanceStatus status) {
    switch (status) {
      case StudentAttendanceStatus.present:
        return AppTheme.accentGreen;
      case StudentAttendanceStatus.absent:
        return AppTheme.accentAmber;
      case StudentAttendanceStatus.malpractice:
        return AppTheme.accentRed;
      case StudentAttendanceStatus.unverified:
        return Colors.grey;
    }
  }

  /// Persists a booklet tag; returns null on success or an error message.
  Future<String?> _ingestBooklet(
    String usn,
    String barcode,
    String dummyBarcode,
  ) async {
    if (widget.sessionKey == null) return 'No active session key.';
    try {
      final resp = await _repository.ingestBooklet(
        widget.sessionKey!,
        usn,
        barcode,
        dummyBarcode,
      );
      if (mounted) {
        setState(() {
          _session = _session.copyWith(
            students: _session.students.map((s) {
              if (s.usn != usn) return s;
              return s.copyWith(
                bookletBarcode: '${resp['booklet_barcode'] ?? barcode}',
                dummyBarcode: '${resp['dummy_barcode'] ?? dummyBarcode}',
                digitizedPagesCount: 0,
              );
            }).toList(),
          );
        });
      }
      return null;
    } catch (e) {
      return InvigilatorRepository.extractApiError(e);
    }
  }

  /// Persists a malpractice incident; returns null on success or an error.
  Future<String?> _reportIncident(
    String usn,
    String infractionType,
    String description,
  ) async {
    if (widget.sessionKey == null) return 'No active session key.';
    try {
      final incident = await _repository.reportIncident(
        widget.sessionKey!,
        usn,
        infractionType,
        description,
      );
      if (mounted) {
        setState(() {
          _session = _session.copyWith(
            students: _session.students.map((s) {
              if (s.usn != usn) return s;
              return s.copyWith(status: StudentAttendanceStatus.malpractice);
            }).toList(),
            incidents: [incident, ..._session.incidents],
          );
        });
      }
      return null;
    } catch (e) {
      return InvigilatorRepository.extractApiError(e);
    }
  }

  void _openQRScanner() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => QRVerifierModal(
        session: _session,
        onVerifyStudent: _markAttendance,
      ),
    );
  }

  void _openBookletScanner() {
    final presentWithoutBooklet = _session.students.where((s) => s.status == StudentAttendanceStatus.present && s.bookletBarcode == null).toList();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => BookletScannerModal(
        presentStudentsWithoutBooklet: presentWithoutBooklet,
        onBookletIngested: _ingestBooklet,
      ),
    );
  }

  void _openIncidentReport() {
    final presentStudents = _session.students.where((s) => s.status == StudentAttendanceStatus.present).toList();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => ReportIncidentModal(
        presentStudents: presentStudents.isEmpty ? _session.students : presentStudents,
        onIncidentReported: _reportIncident,
      ),
    );
  }

  void _openHandover() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => SessionHandoverModal(
        session: _session,
        onHandoverCompleted: () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              backgroundColor: AppTheme.primaryDark,
              content: Text('✓ Hall Session Reconciled & Dispatched to Central Scrutinizer'),
            ),
          );
        },
      ),
    );
  }

  late InvigilatorSession _session;

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_errorMessage != null) {
      final displayMessage = InvigilatorRepository.extractApiError(_errorMessage!);
      return Scaffold(
        backgroundColor: AppTheme.bgBase,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.lock_clock, size: 80, color: AppTheme.accentAmber),
                const SizedBox(height: 24),
                const Text(
                  'Session Not Available',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                ),
                const SizedBox(height: 16),
                Text(
                  displayMessage,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 16, color: AppTheme.textSecondary, height: 1.5),
                ),
                const SizedBox(height: 32),
                ElevatedButton.icon(
                  onPressed: () {
                    setState(() {
                      _isLoading = true;
                      _errorMessage = null;
                    });
                    _loadSession();
                  },
                  icon: const Icon(Icons.refresh),
                  label: const Text('Try Again'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }
    return Scaffold(
      backgroundColor: AppTheme.bgBase,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.shield, color: AppTheme.primary, size: 16),
                const SizedBox(width: 4),
                Text(
                  'NexAI Invigilator',
                  style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w900, color: AppTheme.textPrimary),
                ),
              ],
            ),
            Text(
              '${_session.hallNumber} • ${_session.chiefInvigilatorName}',
              style: GoogleFonts.inter(fontSize: 11, color: AppTheme.textSecondary, fontWeight: FontWeight.w500),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: _refreshSession,
            icon: const Icon(Icons.sync, color: AppTheme.primary),
            tooltip: 'Refresh Session',
          ),
          IconButton(
            onPressed: _openHandover,
            icon: const Icon(Icons.lock_clock, color: AppTheme.primary),
            tooltip: 'Session Handover',
          ),
        ],
      ),
      body: Column(
        children: [
          // Session Header Banner
          Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(18),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.08),
                  blurRadius: 12,
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
                        color: AppTheme.primary.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppTheme.primary.withOpacity(0.5)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.fiber_manual_record, color: Color(0xFF4ADE80), size: 10),
                          SizedBox(width: 4),
                          Text('LIVE SESSION', style: TextStyle(color: Color(0xFF4ADE80), fontSize: 10, fontWeight: FontWeight.w800)),
                        ],
                      ),
                    ),
                    Text(
                      '${_session.examDate} • ${_session.timeSlot}',
                      style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  '${_session.courseCode}: ${_session.courseTitle}',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16),
                ),
                const SizedBox(height: 14),

                // Telemetry Counters
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildStatCard('Total', '${_session.totalCount}', AppTheme.accentBlue),
                    _buildStatCard('Present', '${_session.presentCount}', AppTheme.accentGreen),
                    _buildStatCard('Absent', '${_session.absentCount}', AppTheme.accentAmber),
                    _buildStatCard('Booklets', '${_session.bookletsIngestedCount}', AppTheme.accentPurple),
                  ],
                ),
              ],
            ),
          ),

          // Action Shortcuts Toolbar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _openQRScanner,
                    icon: const Icon(Icons.qr_code_scanner, size: 16),
                    label: const Text('Scan QR Pass'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _openBookletScanner,
                    icon: const Icon(Icons.document_scanner, size: 16),
                    label: const Text('Ingest Booklet'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.accentBlue,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _openIncidentReport,
                  style: IconButton.styleFrom(
                    backgroundColor: const Color(0xFFFEE2E2),
                    padding: const EdgeInsets.all(12),
                  ),
                  icon: const Icon(Icons.warning_amber_rounded, color: AppTheme.accentRed),
                  tooltip: 'Report Infraction',
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Tabs Header
          TabBar(
            controller: _tabController,
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            labelColor: AppTheme.primaryDark,
            unselectedLabelColor: AppTheme.textSecondary,
            indicatorColor: AppTheme.primary,
            indicatorWeight: 3,
            labelStyle: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 13),
            tabs: [
              const Tab(text: 'Seating Blueprint'),
              const Tab(text: 'Candidate Roster'),
              Tab(text: 'Incidents (${_session.incidents.length})'),
            ],
          ),

          // Tab Views
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                // Tab 1: Seating Blueprint Grid
                _buildSeatingGridTab(),

                // Tab 2: Candidate Roster List
                _buildCandidateRosterTab(),

                // Tab 3: Incidents Log
                _buildIncidentsTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.18),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          Text(value, style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 15)),
          Text(label, style: const TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _buildSeatingGridTab() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${_session.hallNumber} Desk Map', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
              Row(
                children: [
                  _buildLegendItem('Present', AppTheme.accentGreen),
                  const SizedBox(width: 8),
                  _buildLegendItem('Absent', AppTheme.accentAmber),
                  const SizedBox(width: 8),
                  _buildLegendItem('Flagged', AppTheme.accentRed),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),

          Expanded(
            child: GridView.builder(
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 220,
                childAspectRatio: 1.45,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              itemCount: _session.students.length,
              itemBuilder: (context, i) {
                final student = _session.students[i];
                final statusColor = _statusColor(student.status);
                final statusLabel = student.status == StudentAttendanceStatus.present
                    ? 'PRESENT ✓'
                    : student.status.name.toUpperCase();

                return InkWell(
                  onTap: () => _toggleStudentStatus(student),
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTheme.bgSurface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: statusColor.withOpacity(0.5),
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.02),
                          blurRadius: 6,
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Flexible(
                              child: Text(
                                student.deskId,
                                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: statusColor.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                statusLabel,
                                style: TextStyle(color: statusColor, fontWeight: FontWeight.w800, fontSize: 9),
                              ),
                            ),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              student.studentName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
                            ),
                            Text(
                              student.usn,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 10),
                            ),
                          ],
                        ),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              student.seatPosition,
                              style: const TextStyle(fontSize: 9, color: AppTheme.textMuted),
                            ),
                            Row(
                              children: [
                                if (student.dummyBarcode != null && (student.digitizedPagesCount ?? 0) == 0)
                                  const Icon(Icons.qr_code_2, color: AppTheme.accentPurple, size: 12),
                                if ((student.digitizedPagesCount ?? 0) > 0)
                                  Icon(Icons.document_scanner, color: AppTheme.accentGreen, size: 12),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _toggleStudentStatus(StudentDeskItem student) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Quick Status: ${student.studentName} (${student.deskId})', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
            const SizedBox(height: 4),
            Text('${student.usn} • ${student.seatPosition} • ${student.status.name.toUpperCase()}', style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.check_circle, color: AppTheme.accentGreen),
              title: const Text('Mark Present'),
              onTap: () async {
                final messenger = ScaffoldMessenger.of(context);
                Navigator.pop(context);
                final result = await _markAttendance(student.usn);
                if (!mounted) return;
                messenger.showSnackBar(SnackBar(
                  content: Text(result.success
                      ? (result.alreadyMarked
                          ? 'Already marked ${result.status.toLowerCase()} for ${student.studentName}.'
                          : 'Marked present: ${student.studentName} (${result.seat})')
                      : result.message),
                  backgroundColor: result.success ? null : Colors.red,
                ));
              },
            ),
            ListTile(
              leading: const Icon(Icons.cancel, color: AppTheme.accentAmber),
              title: const Text('Mark Absent'),
              onTap: () async {
                final messenger = ScaffoldMessenger.of(context);
                Navigator.pop(context);
                final result = await _markAttendance(student.usn, status: 'absent');
                if (!mounted) return;
                messenger.showSnackBar(SnackBar(
                  content: Text(result.success
                      ? (result.alreadyMarked
                          ? 'Already marked ${result.status.toLowerCase()} for ${student.studentName}.'
                          : 'Marked absent: ${student.studentName}')
                      : result.message),
                  backgroundColor: result.success ? null : Colors.red,
                ));
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLegendItem(String label, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary)),
      ],
    );
  }

  Widget _buildCandidateRosterTab() {
    final filtered = _session.students.where((s) {
      if (_searchQuery.trim().isEmpty) return true;
      final q = _searchQuery.toLowerCase();
      return s.studentName.toLowerCase().contains(q) || s.usn.toLowerCase().contains(q) || s.deskId.toLowerCase().contains(q);
    }).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Search candidate name, USN, desk...',
              prefixIcon: const Icon(Icons.search, size: 18),
              filled: true,
              fillColor: AppTheme.bgSurface,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.cardBorder)),
            ),
            onChanged: (val) => setState(() => _searchQuery = val),
          ),
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: filtered.length,
            separatorBuilder: (context, i) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final student = filtered[i];
              return Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.bgSurface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.cardBorder),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: AppTheme.primaryLight,
                      child: Text(student.avatarInitials ?? 'ST', style: const TextStyle(color: AppTheme.primaryDark, fontWeight: FontWeight.w800)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(student.studentName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                          Text('USN: ${student.usn} • ${student.deskId}', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
                          if (student.dummyBarcode != null)
                            Row(
                              children: [
                                Text('Booklet: ${student.dummyBarcode}', style: const TextStyle(color: AppTheme.accentPurple, fontSize: 10, fontWeight: FontWeight.w700)),
                                if ((student.digitizedPagesCount ?? 0) > 0)
                                  Padding(
                                    padding: const EdgeInsets.only(left: 6),
                                    child: Row(
                                      children: [
                                        const Icon(Icons.document_scanner, color: AppTheme.accentGreen, size: 10),
                                        const SizedBox(width: 2),
                                        Text('(${student.digitizedPagesCount} pages)', style: const TextStyle(color: AppTheme.accentGreen, fontSize: 9, fontWeight: FontWeight.w800)),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                        ],
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: _statusColor(student.status).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            student.status.name.toUpperCase(),
                            style: TextStyle(
                              color: _statusColor(student.status),
                              fontWeight: FontWeight.w800,
                              fontSize: 9,
                            ),
                          ),
                        ),
                        if (student.isQrVerified) ...[
                          const SizedBox(width: 6),
                          const Icon(Icons.verified, color: AppTheme.accentGreen, size: 18),
                        ],
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildIncidentsTab() {
    if (_session.incidents.isEmpty) {
      return const Center(child: Text('No infractions reported in this session.'));
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _session.incidents.length,
      separatorBuilder: (context, i) => const SizedBox(height: 12),
      itemBuilder: (context, i) {
        final inc = _session.incidents[i];
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFFEF2F2),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFFECDD3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(inc.infractionType, style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.accentRed, fontSize: 13)),
                  Text(inc.timestamp, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                ],
              ),
              const SizedBox(height: 6),
              Text('Candidate: ${inc.studentName} (${inc.studentUsn}) — ${inc.deskId}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
              const SizedBox(height: 6),
              Text(inc.description, style: const TextStyle(fontSize: 11, color: AppTheme.textPrimary, height: 1.4)),
              const SizedBox(height: 8),
              const Row(
                children: [
                  Icon(Icons.cell_tower, color: AppTheme.accentRed, size: 14),
                  SizedBox(width: 6),
                  Text('Broadcasted to CoE & Chief Proctor', style: TextStyle(fontSize: 10, color: AppTheme.accentRed, fontWeight: FontWeight.w700)),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
