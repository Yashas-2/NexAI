import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

import '../../../core/theme/app_theme.dart';

/// The maximum allowed head-rotation angle (in degrees) in either the
/// Y-axis (left/right) or X-axis (up/down) before we count it as
/// "looking away".
const _kMaxHeadAngleDeg = 25.0;

/// How many consecutive "no-face / look-away" frames before we fire a strike.
const _kFramesToStrike = 45; // ~3 s at 15 fps

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

class _AiProctorCameraBubbleState extends State<AiProctorCameraBubble>
    with SingleTickerProviderStateMixin {
  // â”€â”€ UI State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  bool _isMinimized = false;
  late AnimationController _pulseController;

  // â”€â”€ Camera â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  CameraController? _cameraController;
  bool _isCameraInitialized = false;
  bool _isProcessingFrame = false;

  // â”€â”€ ML Kit Face Detector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  late final FaceDetector _faceDetector;

  // â”€â”€ Proctoring State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  String _statusLabel = 'Initialisingâ€¦';
  Color _statusColor = Colors.white70;
  Rect? _faceRect; // normalised 0..1

  /// Consecutive "bad" frames counter.
  int _badFrameCount = 0;
  bool _strikeInProgress = false;

  @override
  void initState() {
    super.initState();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _faceDetector = FaceDetector(
      options: FaceDetectorOptions(
        enableClassification: false,
        enableLandmarks: false,
        enableTracking: true,
        performanceMode: FaceDetectorMode.fast,
      ),
    );

    _initCamera();
  }

  // â”€â”€ Camera Initialisation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        _setStatus('No camera found', Colors.red);
        return;
      }

      final front = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );

      final controller = CameraController(
        front,
        ResolutionPreset.low,
        enableAudio: false,
      );

      await controller.initialize();

      if (!mounted) {
        controller.dispose();
        return;
      }

      setState(() {
        _cameraController = controller;
        _isCameraInitialized = true;
        _statusLabel = 'Face scan startingâ€¦';
        _statusColor = Colors.white70;
      });

      await controller.startImageStream(_onCameraImage);
    } catch (e) {
      debugPrint('Camera Init Error: $e');
      _setStatus('Camera error', Colors.redAccent);
    }
  }

  // â”€â”€ Per-Frame ML Kit Processing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  Future<void> _onCameraImage(CameraImage image) async {
    if (_isProcessingFrame || !mounted) return;
    _isProcessingFrame = true;

    try {
      final inputImage = _buildInputImage(image);
      if (inputImage == null) {
        _isProcessingFrame = false;
        return;
      }

      final faces = await _faceDetector.processImage(inputImage);
      if (!mounted) {
        _isProcessingFrame = false;
        return;
      }

      _handleDetectionResult(faces, image);
    } catch (_) {
      // Silently ignore individual frame errors.
    } finally {
      _isProcessingFrame = false;
    }
  }

  InputImage? _buildInputImage(CameraImage image) {
    final camera = _cameraController;
    if (camera == null) return null;

    final rotation = InputImageRotationValue.fromRawValue(
      camera.description.sensorOrientation,
    );
    if (rotation == null) return null;

    var format = InputImageFormatValue.fromRawValue(image.format.raw);
    if (format == null) {
      format = Platform.isAndroid ? InputImageFormat.nv21 : InputImageFormat.bgra8888;
    }

    final plane = image.planes.first;
    return InputImage.fromBytes(
      bytes: plane.bytes,
      metadata: InputImageMetadata(
        size: ui.Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format: format,
        bytesPerRow: plane.bytesPerRow,
      ),
    );
  }

  void _handleDetectionResult(List<Face> faces, CameraImage image) {
    if (faces.isEmpty) {
      _badFrameCount++;
      _setStatus('No face detected âš ', AppTheme.accentAmber);
      setState(() => _faceRect = null);
    } else {
      final face = faces.first;
      final yaw = face.headEulerAngleY ?? 0.0;
      final pitch = face.headEulerAngleX ?? 0.0;

      final bool lookingAway =
          yaw.abs() > _kMaxHeadAngleDeg || pitch.abs() > _kMaxHeadAngleDeg;

      if (lookingAway) {
        _badFrameCount++;
        _setStatus('Look at screen! âš ', AppTheme.accentAmber);
      } else {
        _badFrameCount = 0;
        _setStatus('Face locked â€¢ Gaze OK âœ“', AppTheme.accentGreen);
      }

      // Map bounding box to normalised widget space.
      final imgW = image.width.toDouble();
      final imgH = image.height.toDouble();
      final bb = face.boundingBox;
      setState(() {
        _faceRect = Rect.fromLTRB(
          bb.left / imgW,
          bb.top / imgH,
          bb.right / imgW,
          bb.bottom / imgH,
        );
      });
    }

    if (_badFrameCount >= _kFramesToStrike && !_strikeInProgress) {
      _strikeInProgress = true;
      _badFrameCount = 0;
      widget.onWarningTriggered?.call();
      Future.delayed(const Duration(seconds: 5), () {
        if (mounted) _strikeInProgress = false;
      });
    }
  }

  void _setStatus(String label, Color color) {
    if (!mounted) return;
    setState(() {
      _statusLabel = label;
      _statusColor = color;
    });
  }

  // â”€â”€ Dispose â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @override
  void dispose() {
    _pulseController.dispose();
    _cameraController?.stopImageStream().catchError((_) {});
    _cameraController?.dispose();
    _faceDetector.close();
    super.dispose();
  }

  // â”€â”€ Build â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @override
  Widget build(BuildContext context) {
    return _isMinimized ? _buildMinimisedPill() : _buildFullBubble();
  }

  Widget _buildMinimisedPill() {
    return GestureDetector(
      onTap: () => setState(() => _isMinimized = false),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A).withValues(alpha: 0.9),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppTheme.accentGreen, width: 1.5),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 10),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildPulseDot(AppTheme.accentGreen),
            const SizedBox(width: 4),
            const Text(
              'AI Proctor Active',
              style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFullBubble() {
    final borderColor = widget.strikeCount > 0 ? AppTheme.accentAmber : AppTheme.accentGreen;

    return Container(
      width: 130,
      height: 165,
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor, width: 2),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.4), blurRadius: 16, offset: const Offset(0, 4)),
        ],
      ),
      child: Stack(
        children: [
          // Live camera preview
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: _buildCameraPreview(),
          ),

          // Face bounding box overlay
          if (_faceRect != null)
            Positioned.fill(
              child: CustomPaint(
                painter: _FaceBoxPainter(normRect: _faceRect!, color: _statusColor),
              ),
            ),

          // Top bar: LIVE dot + minimise
          Positioned(
            top: 6, left: 6, right: 6,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    _buildPulseDot(AppTheme.accentGreen),
                    const SizedBox(width: 4),
                    const Text('LIVE', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w900)),
                  ],
                ),
                GestureDetector(
                  onTap: () => setState(() => _isMinimized = true),
                  child: const Icon(Icons.minimize, size: 12, color: Colors.white54),
                ),
              ],
            ),
          ),

          // Bottom telemetry
          Positioned(
            bottom: 6, left: 6, right: 6,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 3, horizontal: 4),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.75),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Column(
                children: [
                  Text(
                    _statusLabel,
                    style: TextStyle(color: _statusColor, fontSize: 8, fontWeight: FontWeight.w800),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    'Strikes: ${widget.strikeCount}/3',
                    style: TextStyle(
                      color: widget.strikeCount > 0 ? AppTheme.accentAmber : Colors.white70,
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

  Widget _buildCameraPreview() {
    if (!_isCameraInitialized || _cameraController == null) {
      return Container(
        color: const Color(0xFF1E293B),
        child: Center(
          child: Icon(Icons.person, size: 60, color: Colors.white.withValues(alpha: 0.2)),
        ),
      );
    }
    return SizedBox.expand(
      child: FittedBox(
        fit: BoxFit.cover,
        child: SizedBox(
          width: _cameraController!.value.previewSize?.height ?? 130,
          height: _cameraController!.value.previewSize?.width ?? 165,
          child: CameraPreview(_cameraController!),
        ),
      ),
    );
  }

  Widget _buildPulseDot(Color color) {
    return AnimatedBuilder(
      animation: _pulseController,
      builder: (_, _) => Container(
        width: 7, height: 7,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(color: color.withValues(alpha: _pulseController.value), blurRadius: 6, spreadRadius: 2),
          ],
        ),
      ),
    );
  }
}

// â”€â”€ Face Bounding-Box Painter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class _FaceBoxPainter extends CustomPainter {
  final Rect normRect;
  final Color color;

  const _FaceBoxPainter({required this.normRect, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..color = color
      ..strokeWidth = 1.5;

    final rect = Rect.fromLTRB(
      normRect.left * size.width,
      normRect.top * size.height,
      normRect.right * size.width,
      normRect.bottom * size.height,
    );

    const tickLen = 10.0;
    final corners = [
      [Offset(rect.left, rect.top + tickLen), rect.topLeft, Offset(rect.left + tickLen, rect.top)],
      [Offset(rect.right - tickLen, rect.top), rect.topRight, Offset(rect.right, rect.top + tickLen)],
      [Offset(rect.left, rect.bottom - tickLen), rect.bottomLeft, Offset(rect.left + tickLen, rect.bottom)],
      [Offset(rect.right - tickLen, rect.bottom), rect.bottomRight, Offset(rect.right, rect.bottom - tickLen)],
    ];

    for (final corner in corners) {
      canvas.drawLine(corner[0], corner[1], paint);
      canvas.drawLine(corner[1], corner[2], paint);
    }
  }

  @override
  bool shouldRepaint(_FaceBoxPainter old) =>
      old.normRect != normRect || old.color != color;
}
