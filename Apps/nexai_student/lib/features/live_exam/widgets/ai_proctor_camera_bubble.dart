import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import '../../../core/theme/app_theme.dart';

class AiProctorCameraBubble extends StatefulWidget {
  final int strikeCount;
  final VoidCallback? onWarningTriggered;

  const AiProctorCameraBubble({
    super.key,
    this.strikeCount = 0,
    this.onWarningTriggered,
  });

  @override
  State<AiProctorCameraBubble> createState() => _AiProctorCameraBubbleState();
}

class _AiProctorCameraBubbleState extends State<AiProctorCameraBubble> with SingleTickerProviderStateMixin {
  bool _isMinimized = false;
  late AnimationController _pulseController;

  CameraController? _cameraController;
  bool _isCameraInitialized = false;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _initFrontCamera();
  }

  Future<void> _initFrontCamera() async {
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) return;

      final frontCamera = cameras.firstWhere(
        (cam) => cam.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );

      final controller = CameraController(
        frontCamera,
        ResolutionPreset.low,
        enableAudio: false,
      );

      await controller.initialize();
      if (mounted) {
        setState(() {
          _cameraController = controller;
          _isCameraInitialized = true;
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _cameraController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isMinimized) {
      return InkWell(
        onTap: () => setState(() => _isMinimized = false),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A).withValues(alpha: 0.9),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppTheme.accentGreen, width: 1.5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.2),
                blurRadius: 10,
              ),
            ],
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.videocam, color: Color(0xFF4ADE80), size: 14),
              SizedBox(width: 4),
              Text(
                'AI Proctor Active',
                style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800),
              ),
            ],
          ),
        ),
      );
    }

    return Container(
      width: 130,
      height: 155,
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: widget.strikeCount > 0 ? AppTheme.accentAmber : AppTheme.accentGreen,
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Live Front Camera Stream (or Face Silhouette Fallback)
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: Container(
              color: const Color(0xFF1E293B),
              child: Stack(
                children: [
                  if (_isCameraInitialized && _cameraController != null)
                    SizedBox.expand(
                      child: FittedBox(
                        fit: BoxFit.cover,
                        child: SizedBox(
                          width: _cameraController!.value.previewSize?.height ?? 130,
                          height: _cameraController!.value.previewSize?.width ?? 155,
                          child: CameraPreview(_cameraController!),
                        ),
                      ),
                    )
                  else
                    Center(
                      child: Icon(
                        Icons.person,
                        size: 70,
                        color: Colors.white.withValues(alpha: 0.25),
                      ),
                    ),

                  // AI Facial Landmark Tracking Box & Scan Reticle
                  Center(
                    child: Container(
                      width: 80,
                      height: 95,
                      decoration: BoxDecoration(
                        border: Border.all(
                          color: const Color(0xFF4ADE80).withValues(alpha: 0.8),
                          width: 1.5,
                        ),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Stack(
                        children: [
                          Positioned(
                            top: 4,
                            left: 4,
                            child: Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF4ADE80), shape: BoxShape.circle)),
                          ),
                          Positioned(
                            top: 4,
                            right: 4,
                            child: Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF4ADE80), shape: BoxShape.circle)),
                          ),
                          Positioned(
                            bottom: 4,
                            left: 4,
                            child: Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF4ADE80), shape: BoxShape.circle)),
                          ),
                          Positioned(
                            bottom: 4,
                            right: 4,
                            child: Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF4ADE80), shape: BoxShape.circle)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Top Status Bar
          Positioned(
            top: 6,
            left: 6,
            right: 6,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    AnimatedBuilder(
                      animation: _pulseController,
                      builder: (context, child) {
                        return Container(
                          width: 7,
                          height: 7,
                          decoration: BoxDecoration(
                            color: const Color(0xFF4ADE80),
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF4ADE80).withValues(alpha: _pulseController.value),
                                blurRadius: 6,
                                spreadRadius: 2,
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                    const SizedBox(width: 4),
                    const Text('LIVE', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w900)),
                  ],
                ),
                const Icon(Icons.security, size: 12, color: Color(0xFF4ADE80)),
              ],
            ),
          ),

          // Bottom AI Telemetry
          Positioned(
            bottom: 6,
            left: 6,
            right: 6,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 3, horizontal: 4),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.75),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Column(
                children: [
                  const Text(
                    'Gaze: Centered ✓',
                    style: TextStyle(color: Color(0xFF4ADE80), fontSize: 8.5, fontWeight: FontWeight.w800),
                  ),
                  Text(
                    'Strikes: ${widget.strikeCount}/3',
                    style: TextStyle(
                      color: widget.strikeCount > 0 ? const Color(0xFFFBBF24) : Colors.white70,
                      fontSize: 8,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
