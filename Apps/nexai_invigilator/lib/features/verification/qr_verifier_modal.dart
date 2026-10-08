import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../models/exam_models.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

typedef VerifyStudentFn = Future<AttendanceResult> Function(
  String usn, {
  String? qrPayload,
});

/// Hall-ticket QR payload contract (backend eligibility/tasks.py):
///   qr_code_data = "{usn}-{exam_session_id}"
final RegExp _qrPayloadRe = RegExp(
  r'^([A-Za-z0-9]+)-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$',
);

class QRVerifierModal extends StatefulWidget {
  final InvigilatorSession session;
  final VerifyStudentFn onVerifyStudent;

  const QRVerifierModal({
    super.key,
    required this.session,
    required this.onVerifyStudent,
  });

  @override
  State<QRVerifierModal> createState() => _QRVerifierModalState();
}

class _QRVerifierModalState extends State<QRVerifierModal>
    with SingleTickerProviderStateMixin {
  late AnimationController _laserController;
  late Animation<double> _laserAnimation;

  StudentDeskItem? _detectedStudent;
  String? _qrPayload; // null => manual (no QR) verification
  bool _isScanning = true;
  bool _isVerifying = false;
  bool _isVerified = false;
  String? _errorText; // rejected-scan reason (cleared on next scan)
  String? _verifyError; // backend failure shown in the candidate card
  String _searchQuery = '';

  InvigilatorSession get _session => widget.session;

  @override
  void initState() {
    super.initState();
    _laserController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat(reverse: true);

    _laserAnimation = Tween<double>(begin: 0.1, end: 0.9).animate(
      CurvedAnimation(parent: _laserController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _laserController.dispose();
    super.dispose();
  }

  void _handleScan(String? raw) {
    if (!_isScanning || _detectedStudent != null || raw == null) return;

    final match = _qrPayloadRe.firstMatch(raw.trim());
    if (match == null) {
      setState(() => _errorText = 'Not a valid hall-ticket QR code.');
      return;
    }
    final usn = match.group(1)!;
    final sessionId = match.group(2)!;

    final student = _session.students
        .where((s) => s.usn.toUpperCase() == usn.toUpperCase())
        .firstOrNull;
    if (student == null) {
      setState(() => _errorText =
          '$usn is not allotted a seat in ${_session.hallNumber}.');
      return;
    }

    final expected = _session.examSessionId;
    if (expected != null && sessionId.toLowerCase() != expected.toLowerCase()) {
      setState(() => _errorText =
          'QR belongs to a different exam session — this hall is writing ${_session.examSessionName ?? expected}.');
      return;
    }

    setState(() {
      _detectedStudent = student;
      _qrPayload = raw.trim();
      _errorText = null;
      _verifyError = null;
      _isScanning = false;
    });
  }

  void _selectManualMatch(StudentDeskItem student) {
    setState(() {
      _detectedStudent = student;
      _qrPayload = null;
      _errorText = null;
      _verifyError = null;
      _isScanning = false;
      _searchQuery = '';
    });
  }

  void _rescan() {
    setState(() {
      _detectedStudent = null;
      _qrPayload = null;
      _verifyError = null;
      _errorText = null;
      _isScanning = true;
    });
  }

  Future<void> _handleConfirm() async {
    final student = _detectedStudent;
    if (student == null || _isVerifying || _isVerified) return;

    setState(() {
      _isVerifying = true;
      _verifyError = null;
    });

    final result = await widget.onVerifyStudent(
      student.usn,
      qrPayload: _qrPayload,
    );

    if (!mounted) return;
    if (result.success) {
      setState(() {
        _isVerified = true;
        _isVerifying = false;
      });
      final message = result.alreadyMarked
          ? '${student.studentName}: already marked ${result.status.toLowerCase()}'
          : 'Attendance marked for ${student.studentName} (${result.seat})';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      Future.delayed(const Duration(milliseconds: 700), () {
        if (mounted) Navigator.pop(context);
      });
    } else {
      setState(() {
        _isVerifying = false;
        _verifyError = result.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.88,
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
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryLight,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.qr_code_scanner, color: AppTheme.primary, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Hall Ticket QR Verifier',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        Text(
                          '${_session.hallNumber} • ${_session.courseCode} • ${_session.timeSlot}',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontSize: 12),
                        ),
                      ],
                    ),
                  ],
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, color: AppTheme.textSecondary),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: 20 + MediaQuery.of(context).viewInsets.bottom,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: double.infinity,
                    height: 220,
                    decoration: BoxDecoration(
                      color: AppTheme.bgDark,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.15),
                          blurRadius: 16,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Positioned.fill(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(20),
                            child: MobileScanner(
                              controller: MobileScannerController(
                                detectionSpeed: DetectionSpeed.noDuplicates,
                              ),
                              onDetect: (capture) {
                                for (final barcode in capture.barcodes) {
                                  _handleScan(barcode.rawValue);
                                }
                              },
                            ),
                          ),
                        ),
                        Container(
                          width: 180,
                          height: 180,
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: _errorText != null
                                  ? AppTheme.accentRed
                                  : _detectedStudent != null
                                      ? AppTheme.accentGreen
                                      : AppTheme.primary,
                              width: 2.5,
                            ),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Stack(
                            children: [
                              Positioned(
                                top: -2, left: -2,
                                child: Container(width: 20, height: 20, decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppTheme.primary, width: 5), left: BorderSide(color: AppTheme.primary, width: 5)))),
                              ),
                              Positioned(
                                top: -2, right: -2,
                                child: Container(width: 20, height: 20, decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppTheme.primary, width: 5), right: BorderSide(color: AppTheme.primary, width: 5)))),
                              ),
                              Positioned(
                                bottom: -2, left: -2,
                                child: Container(width: 20, height: 20, decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTheme.primary, width: 5), left: BorderSide(color: AppTheme.primary, width: 5)))),
                              ),
                              Positioned(
                                bottom: -2, right: -2,
                                child: Container(width: 20, height: 20, decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTheme.primary, width: 5), right: BorderSide(color: AppTheme.primary, width: 5)))),
                              ),
                              if (_isScanning && _errorText == null)
                                AnimatedBuilder(
                                  animation: _laserAnimation,
                                  builder: (context, child) {
                                    return Positioned(
                                      top: 180 * _laserAnimation.value,
                                      left: 8,
                                      right: 8,
                                      child: Container(
                                        height: 3,
                                        decoration: BoxDecoration(
                                          color: AppTheme.primary,
                                          boxShadow: [
                                            BoxShadow(
                                              color: AppTheme.primary.withOpacity(0.8),
                                              blurRadius: 8,
                                              spreadRadius: 2,
                                            ),
                                          ],
                                        ),
                                      ),
                                    );
                                  },
                                ),
                            ],
                          ),
                        ),
                        Positioned(
                          bottom: 12,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.black.withOpacity(0.7),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  _errorText != null
                                      ? Icons.error_outline
                                      : _detectedStudent != null
                                          ? Icons.check_circle
                                          : Icons.sensors,
                                  color: _errorText != null
                                      ? AppTheme.accentRed
                                      : _detectedStudent != null
                                          ? AppTheme.accentGreen
                                          : AppTheme.accentAmber,
                                  size: 14,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  _errorText != null
                                      ? 'Scan rejected'
                                      : _detectedStudent != null
                                          ? 'Hall ticket matched ✓'
                                          : 'Align candidate hall-ticket QR',
                                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  if (_errorText != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFECDD3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline, color: AppTheme.accentRed, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _errorText!,
                              style: const TextStyle(color: AppTheme.accentRed, fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                          ),
                          TextButton(
                            onPressed: _rescan,
                            child: const Text('Scan again'),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 16),

                  if (_detectedStudent != null) ...[
                    _buildCandidateCard(),
                  ] else ...[
                    _buildManualSearch(),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCandidateCard() {
    final student = _detectedStudent!;
    final isQr = _qrPayload != null;
    final isPresent = student.status == StudentAttendanceStatus.present;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppTheme.bgBase,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.primary.withOpacity(0.3), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: AppTheme.primary,
                child: Text(
                  student.avatarInitials ?? 'ST',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      student.studentName,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    Text(
                      'USN: ${student.usn} • ${student.courseCode}',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.accentBlue, fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppTheme.primaryLight,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppTheme.primary.withOpacity(0.4)),
                ),
                child: Text(
                  student.seatPosition.isEmpty ? student.deskId : '${student.deskId} • ${student.seatPosition}',
                  style: const TextStyle(color: AppTheme.primaryDark, fontWeight: FontWeight.w900, fontSize: 11),
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),
          const Divider(height: 1),
          const SizedBox(height: 12),

          _buildCheckRow(
            isQr ? Icons.verified : Icons.edit_note,
            isQr ? 'Hall-ticket QR payload parsed: session matches this exam' : 'Manual verification — no QR scanned',
            isQr ? AppTheme.accentGreen : AppTheme.accentAmber,
          ),
          const SizedBox(height: 8),
          _buildCheckRow(
            Icons.event_seat,
            'Seat allocated: ${student.deskId} (${student.seatPosition}) • ${_session.hallNumber}',
            AppTheme.accentBlue,
          ),
          const SizedBox(height: 8),
          _buildCheckRow(
            isPresent ? Icons.check_circle : Icons.radio_button_unchecked,
            isPresent
                ? 'Already marked present in this session'
                : 'Attendance status: ${student.status.name.toUpperCase()}',
            isPresent ? AppTheme.accentGreen : AppTheme.textSecondary,
          ),

          if (_verifyError != null) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFECDD3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: AppTheme.accentRed, size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _verifyError!,
                      style: const TextStyle(color: AppTheme.accentRed, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: isPresent && _qrPayload == null
                ? OutlinedButton.icon(
                    onPressed: _rescan,
                    icon: const Icon(Icons.qr_code_scanner),
                    label: const Text('Back to scanner'),
                  )
                : ElevatedButton.icon(
                    onPressed: (_isVerifying || _isVerified) ? null : _handleConfirm,
                    icon: _isVerifying
                        ? const SizedBox(
                            width: 16, height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : Icon(_isVerified ? Icons.check : Icons.how_to_reg, size: 18),
                    label: Text(
                      _isVerified
                          ? 'Candidate verified ✓'
                          : _isVerifying
                              ? 'Verifying with server…'
                              : isQr
                                  ? 'Verify QR & mark present →'
                                  : 'Mark present (manual) →',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 15),
                    ),
                  ),
          ),
          if (_detectedStudent != null)
            TextButton(
              onPressed: _isVerifying ? null : _rescan,
              child: const Text('Cancel / scan another'),
            ),
        ],
      ),
    );
  }

  Widget _buildCheckRow(IconData icon, String text, Color color) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(5),
          decoration: BoxDecoration(color: color.withOpacity(0.15), shape: BoxShape.circle),
          child: Icon(icon, color: color, size: 15),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(text, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w700)),
        ),
      ],
    );
  }

  /// Manual fallback when scanning is unavailable: search by name / USN.
  Widget _buildManualSearch() {
    final q = _searchQuery.trim().toLowerCase();
    final results = q.isEmpty
        ? <StudentDeskItem>[]
        : _session.students
            .where((s) =>
                s.studentName.toLowerCase().contains(q) ||
                s.usn.toLowerCase().contains(q) ||
                s.deskId.toLowerCase().contains(q))
            .take(6)
            .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Manual verification (no camera / QR unreadable)',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        TextField(
          decoration: InputDecoration(
            hintText: 'Search candidate name, USN or seat…',
            prefixIcon: const Icon(Icons.search, size: 18),
            filled: true,
            fillColor: AppTheme.bgBase,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.cardBorder),
            ),
          ),
          onChanged: (val) => setState(() => _searchQuery = val),
        ),
        const SizedBox(height: 10),
        if (q.isNotEmpty && results.isEmpty)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppTheme.bgBase,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.cardBorder),
            ),
            child: const Text(
              'No candidate in this hall matches that search.',
              style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
            ),
          ),
        ...results.map(
          (s) => ListTile(
            dense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 4),
            leading: CircleAvatar(
              radius: 16,
              backgroundColor: AppTheme.primaryLight,
              child: Text(
                s.avatarInitials ?? 'ST',
                style: const TextStyle(color: AppTheme.primaryDark, fontWeight: FontWeight.w800, fontSize: 11),
              ),
            ),
            title: Text(s.studentName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            subtitle: Text(
              '${s.usn} • ${s.deskId} • ${s.status.name.toUpperCase()}',
              style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
            ),
            trailing: const Icon(Icons.chevron_right, color: AppTheme.primary),
            onTap: () => _selectManualMatch(s),
          ),
        ),
        const SizedBox(height: 6),
        const Row(
          children: [
            Icon(Icons.info_outline, size: 14, color: AppTheme.textSecondary),
            SizedBox(width: 6),
            Expanded(
              child: Text(
                'Scanning a hall-ticket QR is preferred — manual marks are recorded without QR verification.',
                style: TextStyle(fontSize: 11, color: AppTheme.textSecondary),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
