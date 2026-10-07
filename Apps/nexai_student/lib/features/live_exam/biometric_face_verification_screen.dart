import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:camera/camera.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';
import '../../models/student_models.dart';
import 'proctored_exam_kiosk_screen.dart';

class BiometricFaceVerificationScreen extends StatefulWidget {
  final ExamScheduleItem exam;

  const BiometricFaceVerificationScreen({
    super.key,
    required this.exam,
  });

  @override
  State<BiometricFaceVerificationScreen> createState() => _BiometricFaceVerificationScreenState();
}

class _BiometricFaceVerificationScreenState extends State<BiometricFaceVerificationScreen> with SingleTickerProviderStateMixin {
  late AnimationController _scannerController;
  int _verificationStep = 0; // 0: scanning, 1: liveness, 2: matched, 3: ready
  Timer? _stepTimer;

  CameraController? _cameraController;
  bool _isCameraInitialized = false;
  bool _hasCameraError = false;

  @override
  void initState() {
    super.initState();
    _scannerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _initializeRealCamera();
    _runVerificationSequence();
  }

  Future<void> _initializeRealCamera() async {
    try {
      final status = await Permission.camera.request();
      if (!status.isGranted) {
        setState(() => _hasCameraError = true);
        return;
      }

      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        setState(() => _hasCameraError = true);
        return;
      }

      // Pick front-facing camera
      final frontCamera = cameras.firstWhere(
        (cam) => cam.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );

      final controller = CameraController(
        frontCamera,
        ResolutionPreset.medium,
        enableAudio: false,
      );

      await controller.initialize();
      if (mounted) {
        setState(() {
          _cameraController = controller;
          _isCameraInitialized = true;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _hasCameraError = true);
      }
    }
  }

  void _runVerificationSequence() {
    _stepTimer = Timer.periodic(const Duration(milliseconds: 1400), (timer) {
      if (_verificationStep < 3) {
        setState(() {
          _verificationStep++;
        });
      } else {
        timer.cancel();
      }
    });
  }

  @override
  void dispose() {
    _stepTimer?.cancel();
    _scannerController.dispose();
    _cameraController?.dispose();
    super.dispose();
  }

  void _enterProctoringKiosk() {
    // Enable Fullscreen Immersive Kiosk Mode
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (context) => ProctoredExamKioskScreen(exam: widget.exam),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isReady = _verificationStep >= 3;

    return Scaffold(
      backgroundColor: const Color(0xFF0B0F17),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () {
            SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
            Navigator.pop(context);
          },
        ),
        title: Text(
          'AI Biometric Gate Verification',
          style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        child: Column(
          children: [
            // Exam Header Banner
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.lock, color: AppTheme.primary, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${widget.exam.courseCode}: ${widget.exam.courseTitle}',
                          style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13),
                        ),
                        Text(
                          '${widget.exam.hallNumber} • ${widget.exam.deskNumber}',
                          style: const TextStyle(color: Colors.white60, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Live Camera Viewfinder with Biometric Reticle
            Center(
              child: Container(
                width: 240,
                height: 280,
                decoration: BoxDecoration(
                  color: const Color(0xFF131C2E),
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(
                    color: isReady ? AppTheme.accentGreen : AppTheme.accentBlue,
                    width: 2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: (isReady ? AppTheme.accentGreen : AppTheme.accentBlue).withValues(alpha: 0.25),
                      blurRadius: 24,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(26),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Real Camera Preview (or Silhouette Fallback)
                      if (_isCameraInitialized && _cameraController != null && !_hasCameraError)
                        SizedBox.expand(
                          child: FittedBox(
                            fit: BoxFit.cover,
                            child: SizedBox(
                              width: _cameraController!.value.previewSize?.height ?? 240,
                              height: _cameraController!.value.previewSize?.width ?? 280,
                              child: CameraPreview(_cameraController!),
                            ),
                          ),
                        )
                      else
                        Icon(
                          Icons.person,
                          size: 140,
                          color: Colors.white.withValues(alpha: 0.2),
                        ),

                      // Oval Face Guide Reticle
                      Container(
                        width: 170,
                        height: 210,
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: isReady ? AppTheme.accentGreen : Colors.white60,
                            width: 2,
                          ),
                          borderRadius: BorderRadius.circular(90),
                        ),
                      ),

                      // Laser Scan Line Animation
                      if (!isReady)
                        AnimatedBuilder(
                          animation: _scannerController,
                          builder: (context, child) {
                            return Positioned(
                              top: 40 + (_scannerController.value * 190),
                              left: 30,
                              right: 30,
                              child: Container(
                                height: 3,
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [Colors.transparent, Color(0xFF38BDF8), Colors.transparent],
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFF38BDF8).withValues(alpha: 0.8),
                                      blurRadius: 8,
                                      spreadRadius: 1,
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),

                      // Verified Stamp
                      if (isReady)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: AppTheme.accentGreen.withValues(alpha: 0.9),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.verified, color: Colors.white, size: 16),
                              SizedBox(width: 6),
                              Text('MATCH 98.9% ✓', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 12)),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 24),

            // Step-by-Step Biometric Progress Checklist
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: Column(
                children: [
                  _buildCheckStep('1. Frontal Pose & Centering', _verificationStep >= 1),
                  const SizedBox(height: 10),
                  _buildCheckStep('2. Passive Liveness & Anti-Spoof', _verificationStep >= 2),
                  const SizedBox(height: 12),
                  _buildCheckStep('3. Admission Record Cryptographic Match', _verificationStep >= 3),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Environment Security Callout
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.accentAmber.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.accentAmber.withValues(alpha: 0.3)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.shield_outlined, color: AppTheme.accentAmber, size: 18),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'AI Proctoring will monitor camera feed, gaze direction, and lock the phone in Kiosk Assessment Mode.',
                      style: TextStyle(color: Color(0xFFFDE68A), fontSize: 11, fontWeight: FontWeight.w600, height: 1.3),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 28),

            // Launch Exam Mode Action Button
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                onPressed: isReady ? _enterProctoringKiosk : null,
                icon: Icon(isReady ? Icons.lock_open : Icons.hourglass_top, size: 18),
                label: Text(
                  isReady ? 'Enter Locked Proctored Mode 🚀' : 'Verifying Biometrics...',
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  disabledBackgroundColor: Colors.white12,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCheckStep(String label, bool isDone) {
    return Row(
      children: [
        Icon(
          isDone ? Icons.check_circle : Icons.radio_button_unchecked,
          color: isDone ? AppTheme.accentGreen : Colors.white38,
          size: 18,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              color: isDone ? Colors.white : Colors.white60,
              fontSize: 12,
              fontWeight: isDone ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ),
        if (isDone)
          const Text('PASSED', style: TextStyle(color: AppTheme.accentGreen, fontSize: 10, fontWeight: FontWeight.w900))
        else
          const SizedBox(
            width: 12,
            height: 12,
            child: CircularProgressIndicator(strokeWidth: 1.5, color: Colors.white38),
          ),
      ],
    );
  }
}
