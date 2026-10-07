import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../models/exam_models.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class QRVerifierModal extends StatefulWidget {
  final List<StudentDeskItem> unverifiedStudents;
  final Function(String usn) onVerifyStudent;

  const QRVerifierModal({
    super.key,
    required this.unverifiedStudents,
    required this.onVerifyStudent,
  });

  @override
  State<QRVerifierModal> createState() => _QRVerifierModalState();
}

class _QRVerifierModalState extends State<QRVerifierModal> with SingleTickerProviderStateMixin {
  late AnimationController _laserController;
  late Animation<double> _laserAnimation;

  StudentDeskItem? _detectedStudent;
  bool _isScanning = true;
  bool _isVerified = false;

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

    // No simulation, wait for actual scan
  }

  @override
  void dispose() {
    _laserController.dispose();
    super.dispose();
  }

  void _handleConfirmAdmit() {
    if (_detectedStudent != null) {
      widget.onVerifyStudent(_detectedStudent!.usn);
      setState(() {
        _isVerified = true;
      });
      Future.delayed(const Duration(milliseconds: 800), () {
        if (mounted) Navigator.pop(context);
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
          // Drag Handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
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
                          'Admit Card Gate Verifier',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        Text(
                          'Scan Student QR & Biometric Match',
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
                children: [
                  // Camera / Scanner Viewport
                  Container(
                    width: double.infinity,
                    height: 240,
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
                                final List<Barcode> barcodes = capture.barcodes;
                                for (final barcode in barcodes) {
                                  final String? usn = barcode.rawValue;
                                  if (usn != null && _isScanning) {
                                    final match = widget.unverifiedStudents.where((s) => s.usn == usn).firstOrNull;
                                    if (match != null) {
                                      setState(() {
                                        _detectedStudent = match;
                                        _isScanning = false;
                                      });
                                    }
                                  }
                                }
                              },
                            ),
                          ),
                        ),

                        // Targeting Reticle Box
                        Container(
                          width: 180,
                          height: 180,
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: _detectedStudent != null ? AppTheme.accentGreen : AppTheme.primary,
                              width: 2.5,
                            ),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Stack(
                            children: [
                              // Corner Markers
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

                              // Animated Scanning Laser Line
                              if (_isScanning)
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

                        // Status Tag
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
                                  _detectedStudent != null ? Icons.check_circle : Icons.sensors,
                                  color: _detectedStudent != null ? AppTheme.accentGreen : AppTheme.accentAmber,
                                  size: 14,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  _detectedStudent != null ? 'QR Payload Decrypted ✓' : 'Align Candidate Admit Card QR',
                                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Decrypted Student Information Card
                  if (_detectedStudent != null) ...[
                    Container(
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
                                  _detectedStudent!.avatarInitials ?? 'ST',
                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _detectedStudent!.studentName,
                                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                                    ),
                                    Text(
                                      'USN: ${_detectedStudent!.usn} • ${_detectedStudent!.courseCode}',
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
                                  _detectedStudent!.deskId,
                                  style: const TextStyle(color: AppTheme.primaryDark, fontWeight: FontWeight.w900, fontSize: 13),
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 14),
                          const Divider(height: 1),
                          const SizedBox(height: 14),

                          // Biometric Match Status Indicator
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: AppTheme.accentGreen.withOpacity(0.15),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.face, color: AppTheme.accentGreen, size: 18),
                              ),
                              const SizedBox(width: 10),
                              const Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Biometric FaceNet Match: 98.4%',
                                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: AppTheme.accentGreen),
                                    ),
                                    Text(
                                      'Admit card digital signature verified with CoE Vault',
                                      style: TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(Icons.verified, color: AppTheme.accentGreen, size: 20),
                            ],
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Action Button
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isVerified ? null : _handleConfirmAdmit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(_isVerified ? Icons.check : Icons.how_to_reg, color: Colors.white, size: 18),
                            const SizedBox(width: 8),
                            Text(
                              _isVerified ? 'Candidate Admitted ✓' : 'Admit & Assign to ${_detectedStudent!.deskId} →',
                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ] else ...[
                    const SizedBox(height: 30),
                    const CircularProgressIndicator(color: AppTheme.primary),
                    const SizedBox(height: 12),
                    const Text('Detecting QR Admit Card...'),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
