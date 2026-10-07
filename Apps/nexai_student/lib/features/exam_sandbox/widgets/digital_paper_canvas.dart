import 'package:flutter/material.dart';
import 'dart:ui' as ui;
import 'dart:convert';
import 'package:flutter/rendering.dart';
import '../../../core/theme/app_theme.dart';

enum PaperStyle { ruled, grid, plain }

enum DrawingToolType { pen, highlighter, rectangle, circle, line, eraser }

class DrawingElement {
  final DrawingToolType type;
  final List<Offset> points;
  final Color color;
  final double strokeWidth;
  final bool isFilled;

  DrawingElement({
    required this.type,
    required this.points,
    required this.color,
    required this.strokeWidth,
    this.isFilled = false,
  });
}

class DigitalPaperCanvas extends StatefulWidget {
  final String questionTitle;
  final int pageNumber;
  final int totalPages;
  final VoidCallback? onPageAdded;
  final String? initialImageBase64;

  const DigitalPaperCanvas({
    super.key,
    required this.questionTitle,
    this.pageNumber = 1,
    this.totalPages = 4,
    this.onPageAdded,
    this.initialImageBase64,
  });

  @override
  State<DigitalPaperCanvas> createState() => DigitalPaperCanvasState();
}

class DigitalPaperCanvasState extends State<DigitalPaperCanvas> {
  final GlobalKey _boundaryKey = GlobalKey();
  ui.Image? _backgroundImage;
  bool hasDrawn = false;

  Future<String?> captureAsBase64() async {
    try {
      final boundary = _boundaryKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) return null;
      
      final image = await boundary.toImage(pixelRatio: 2.0);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData == null) return null;
      
      final uint8List = byteData.buffer.asUint8List();
      return base64Encode(uint8List);
    } catch (e) {
      debugPrint("Error capturing canvas: $e");
      return null;
    }
  }

  void restoreFromBase64(String? base64String) {
    if (base64String == null || base64String.isEmpty) {
      setState(() { _backgroundImage = null; });
      return;
    }
    try {
      final bytes = base64Decode(base64String);
      ui.decodeImageFromList(bytes, (image) {
        if (mounted) {
          setState(() { _backgroundImage = image; });
        }
      });
    } catch (e) {
      debugPrint("Error restoring canvas: $e");
    }
  }

  @override
  void initState() {
    super.initState();
    if (widget.initialImageBase64 != null && widget.initialImageBase64!.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        restoreFromBase64(widget.initialImageBase64);
      });
    }
  }

  @override
  void didUpdateWidget(covariant DigitalPaperCanvas oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialImageBase64 != oldWidget.initialImageBase64) {
      restoreFromBase64(widget.initialImageBase64);
    }
  }
  PaperStyle _paperStyle = PaperStyle.ruled;
  DrawingToolType _selectedTool = DrawingToolType.pen;
  Color _selectedColor = const Color(0xFF1E40AF); // Royal Blue Exam Ink
  double _strokeWidth = 2.5;

  final List<DrawingElement> _elements = [];
  final List<DrawingElement> _redoStack = [];
  List<Offset> _currentPoints = [];

  final List<Color> _availableColors = [
    const Color(0xFF1E40AF), // Blue Exam Ink
    const Color(0xFF0F172A), // Black Ink
    const Color(0xFF059669), // Emerald
    const Color(0xFFDC2626), // Red Annotation
    const Color(0xFFF59E0B), // Amber Highlighter
  ];

  void _onPanStart(DragStartDetails details) {
    final localPosition = details.localPosition;

    setState(() {
      _currentPoints = [localPosition];
      _redoStack.clear();
    });
  }

  void _onPanUpdate(DragUpdateDetails details) {
    final localPosition = details.localPosition;

    setState(() {
      if (_selectedTool == DrawingToolType.pen ||
          _selectedTool == DrawingToolType.highlighter ||
          _selectedTool == DrawingToolType.eraser) {
        _currentPoints.add(localPosition);
      } else {
        // Shapes: store start and current end
        if (_currentPoints.isEmpty) {
          _currentPoints.add(localPosition);
        } else if (_currentPoints.length == 1) {
          _currentPoints.add(localPosition);
        } else {
          _currentPoints[1] = localPosition;
        }
      }
    });
  }

  void _onPanEnd(DragEndDetails details) {
    if (_currentPoints.isEmpty) return;

    setState(() {
      if (_selectedTool == DrawingToolType.eraser) {
        // Remove intersecting elements
        _elements.removeWhere((elem) {
          return elem.points.any((p) => _currentPoints.any((ep) => (p - ep).distance < 20));
        });
      } else {
        final color = _selectedTool == DrawingToolType.highlighter
            ? _selectedColor.withValues(alpha: 0.35)
            : _selectedColor;

        final width = _selectedTool == DrawingToolType.highlighter
            ? 16.0
            : _strokeWidth;

        _elements.add(DrawingElement(
          type: _selectedTool,
          points: List.from(_currentPoints),
          color: color,
          strokeWidth: width,
        ));
        hasDrawn = true;
      }
      _currentPoints = [];
    });
  }

  void _undo() {
    if (_elements.isNotEmpty) {
      setState(() {
        _redoStack.add(_elements.removeLast());
      });
    }
  }

  void _redo() {
    if (_redoStack.isNotEmpty) {
      setState(() {
        _elements.add(_redoStack.removeLast());
      });
    }
  }

  void _clearCanvas() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear Answer Sheet?'),
        content: const Text('Are you sure you want to erase all handwriting and drawings on this page?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              setState(() {
                _elements.clear();
                _redoStack.clear();
              });
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.accentRed),
            child: const Text('Clear Page'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // ── Top Digital Pen Toolbar ──
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: AppTheme.bgDark,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.1),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            children: [
              // Row 1: Drawing Tools Selector & Actions
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Tool Icons Group — scrollable so Eraser always visible
                  Expanded(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _buildToolButton(DrawingToolType.pen, Icons.edit, 'Pen'),
                          _buildToolButton(DrawingToolType.highlighter, Icons.brush, 'Marker'),
                          _buildToolButton(DrawingToolType.rectangle, Icons.crop_square, 'Box'),
                          _buildToolButton(DrawingToolType.circle, Icons.circle_outlined, 'Circle'),
                          _buildToolButton(DrawingToolType.line, Icons.arrow_right_alt, 'Line'),
                          _buildToolButton(DrawingToolType.eraser, Icons.auto_fix_off, 'Eraser'),
                        ],
                      ),
                    ),
                  ),

                  // Undo, Redo, Clear
                  Row(
                    children: [
                      IconButton(
                        onPressed: _elements.isNotEmpty ? _undo : null,
                        icon: const Icon(Icons.undo, size: 18),
                        color: _elements.isNotEmpty ? Colors.white : Colors.white24,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                        tooltip: 'Undo',
                      ),
                      IconButton(
                        onPressed: _redoStack.isNotEmpty ? _redo : null,
                        icon: const Icon(Icons.redo, size: 18),
                        color: _redoStack.isNotEmpty ? Colors.white : Colors.white24,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                        tooltip: 'Redo',
                      ),
                      IconButton(
                        onPressed: _elements.isNotEmpty ? _clearCanvas : null,
                        icon: const Icon(Icons.delete_outline, size: 18),
                        color: _elements.isNotEmpty ? AppTheme.accentRed : Colors.white24,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                        tooltip: 'Clear Sheet',
                      ),
                    ],
                  ),
                ],
              ),

              const SizedBox(height: 6),

              // Row 2: Color Palette, Stroke Thickness & Paper Style Picker
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Color Chips
                    Row(
                      children: _availableColors.map((col) {
                        final isSelected = _selectedColor == col && _selectedTool != DrawingToolType.eraser;
                        return InkWell(
                          onTap: () => setState(() => _selectedColor = col),
                          child: Container(
                            margin: const EdgeInsets.only(right: 6),
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              color: col,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: isSelected ? Colors.white : Colors.transparent,
                                width: 2,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(width: 16),

                    // Stroke Width Toggle
                    Row(
                      children: [
                        _buildWidthSelector(1.5, 'Fine'),
                        const SizedBox(width: 4),
                        _buildWidthSelector(3.0, 'Med'),
                        const SizedBox(width: 4),
                        _buildWidthSelector(6.0, 'Bold'),
                      ],
                    ),
                    const SizedBox(width: 16),

                    // Paper Pattern Dropdown
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: DropdownButton<PaperStyle>(
                        value: _paperStyle,
                        dropdownColor: AppTheme.bgDark,
                        underline: const SizedBox(),
                        icon: const Icon(Icons.arrow_drop_down, color: Colors.white70, size: 16),
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
                        items: const [
                          DropdownMenuItem(value: PaperStyle.ruled, child: Text('Ruled Lines')),
                          DropdownMenuItem(value: PaperStyle.grid, child: Text('Graph Grid')),
                          DropdownMenuItem(value: PaperStyle.plain, child: Text('Blank Sheet')),
                        ],
                        onChanged: (val) {
                          if (val != null) setState(() => _paperStyle = val);
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // ── Physical Paper Page Canvas Container ──
        Expanded(
          child: Container(
            margin: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFFEFDFB), // Realistic cream exam sheet
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: RepaintBoundary(
                key: _boundaryKey,
                child: Stack(
                  children: [
                  // Paper Background Grid / Ruled Lines Painter
                  Positioned.fill(
                    child: CustomPaint(
                      painter: PaperBackgroundPainter(
                        style: _paperStyle,
                        pageNumber: widget.pageNumber,
                        totalPages: widget.totalPages,
                        questionTitle: widget.questionTitle,
                      ),
                    ),
                  ),

                  // Active Drawing Surface
                  Positioned.fill(
                    child: GestureDetector(
                      onPanStart: _onPanStart,
                      onPanUpdate: _onPanUpdate,
                      onPanEnd: _onPanEnd,
                      child: CustomPaint(
                        painter: DrawingSurfacePainter(
                          elements: _elements,
                          currentPoints: _currentPoints,
                          currentTool: _selectedTool,
                          currentColor: _selectedTool == DrawingToolType.highlighter
                              ? _selectedColor.withValues(alpha: 0.35)
                              : _selectedColor,
                          currentStrokeWidth: _selectedTool == DrawingToolType.highlighter
                              ? 16.0
                              : _strokeWidth,
                          backgroundImage: _backgroundImage,
                        ),
                      ),
                    ),
                  ),

                  // Bottom Watermark & Page Status
                  Positioned(
                    bottom: 8,
                    left: 45,
                    right: 16,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'NEXAI DIGITAL SCRIPT • ${widget.questionTitle.toUpperCase()}',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            color: Colors.grey.shade400,
                            letterSpacing: 0.5,
                          ),
                        ),
                        Text(
                          'Page ${widget.pageNumber} of ${widget.totalPages}',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildToolButton(DrawingToolType type, IconData icon, String label) {
    final isSelected = _selectedTool == type;
    final isEraser = type == DrawingToolType.eraser;
    final activeColor = isEraser ? AppTheme.accentAmber : AppTheme.primary;
    return InkWell(
      onTap: () => setState(() => _selectedTool = type),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        margin: const EdgeInsets.only(right: 4),
        decoration: BoxDecoration(
          color: isSelected ? activeColor : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: isEraser && !isSelected
              ? Border.all(color: Colors.white24, width: 1)
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: isSelected ? Colors.white : Colors.white70),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
                color: isSelected ? Colors.white : Colors.white70,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWidthSelector(double width, String label) {
    final isSelected = _strokeWidth == width;
    return InkWell(
      onTap: () => setState(() => _strokeWidth = width),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white.withValues(alpha: 0.2) : Colors.transparent,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: isSelected ? Colors.white54 : Colors.transparent),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : Colors.white60,
            fontSize: 10,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

// ── Physical Examination Paper Background Painter ──
class PaperBackgroundPainter extends CustomPainter {
  final PaperStyle style;
  final int pageNumber;
  final int totalPages;
  final String questionTitle;

  PaperBackgroundPainter({
    required this.style,
    required this.pageNumber,
    required this.totalPages,
    required this.questionTitle,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // 1. Left Examination Margin Line (Rose Pink/Red double rule)
    final marginPaint = Paint()
      ..color = const Color(0xFFFCA5A5) // Light red margin
      ..strokeWidth = 1.2;

    const double leftMargin = 38.0;
    canvas.drawLine(const Offset(leftMargin, 0), Offset(leftMargin, size.height), marginPaint);
    canvas.drawLine(const Offset(leftMargin + 3, 0), Offset(leftMargin + 3, size.height), marginPaint);

    // 2. Ruled Lines or Grid Graph Lines
    if (style == PaperStyle.ruled) {
      final linePaint = Paint()
        ..color = const Color(0xFFE2E8F0) // Subtle blue/grey notebook line
        ..strokeWidth = 1.0;

      const double lineSpacing = 28.0;
      for (double y = 48.0; y < size.height - 20; y += lineSpacing) {
        canvas.drawLine(Offset(0, y), Offset(size.width, y), linePaint);
      }
    } else if (style == PaperStyle.grid) {
      final gridPaint = Paint()
        ..color = const Color(0xFFE2E8F0)
        ..strokeWidth = 0.6;

      const double gridSpacing = 20.0;
      // Horizontal lines
      for (double y = 40.0; y < size.height; y += gridSpacing) {
        canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
      }
      // Vertical lines
      for (double x = leftMargin + 4; x < size.width; x += gridSpacing) {
        canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
      }
    }

    // 3. Header Stamp in Margin
    final textPainter = TextPainter(
      text: TextSpan(
        text: 'Ans:\n$questionTitle',
        style: const TextStyle(
          color: Color(0xFF94A3B8),
          fontSize: 10,
          fontWeight: FontWeight.w900,
          height: 1.2,
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout(maxWidth: 32);
    textPainter.paint(canvas, const Offset(4, 16));
  }

  @override
  bool shouldRepaint(covariant PaperBackgroundPainter oldDelegate) =>
      oldDelegate.style != style ||
      oldDelegate.pageNumber != pageNumber ||
      oldDelegate.questionTitle != questionTitle;
}

// ── Real-Time Drawing Surface Painter ──
class DrawingSurfacePainter extends CustomPainter {
  final List<DrawingElement> elements;
  final List<Offset> currentPoints;
  final DrawingToolType currentTool;
  final Color currentColor;
  final double currentStrokeWidth;
  final ui.Image? backgroundImage;

  DrawingSurfacePainter({
    required this.elements,
    required this.currentPoints,
    required this.currentTool,
    required this.currentColor,
    required this.currentStrokeWidth,
    this.backgroundImage,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // 0. Draw restored background image if present
    if (backgroundImage != null) {
      final src = Rect.fromLTWH(0, 0, backgroundImage!.width.toDouble(), backgroundImage!.height.toDouble());
      final dst = Rect.fromLTWH(0, 0, size.width, size.height);
      canvas.drawImageRect(backgroundImage!, src, dst, Paint());
    }

    // 1. Render all committed elements
    for (final elem in elements) {
      final paint = Paint()
        ..color = elem.color
        ..strokeWidth = elem.strokeWidth
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke;

      _drawElement(canvas, elem.type, elem.points, paint);
    }

    // 2. Render in-progress active stroke / shape
    if (currentPoints.isNotEmpty) {
      final currentPaint = Paint()
        ..color = currentColor
        ..strokeWidth = currentStrokeWidth
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke;

      _drawElement(canvas, currentTool, currentPoints, currentPaint);
    }
  }

  void _drawElement(Canvas canvas, DrawingToolType type, List<Offset> points, Paint paint) {
    if (points.isEmpty) return;

    switch (type) {
      case DrawingToolType.pen:
      case DrawingToolType.highlighter:
      case DrawingToolType.eraser:
        if (points.length == 1) {
          canvas.drawCircle(points.first, paint.strokeWidth / 2, paint);
        } else {
          final path = Path();
          path.moveTo(points.first.dx, points.first.dy);
          for (int i = 1; i < points.length; i++) {
            path.lineTo(points[i].dx, points[i].dy);
          }
          canvas.drawPath(path, paint);
        }
        break;

      case DrawingToolType.rectangle:
        if (points.length >= 2) {
          final rect = Rect.fromPoints(points[0], points[1]);
          canvas.drawRRect(RRect.fromRectAndRadius(rect, const Radius.circular(4)), paint);
        }
        break;

      case DrawingToolType.circle:
        if (points.length >= 2) {
          final rect = Rect.fromPoints(points[0], points[1]);
          canvas.drawOval(rect, paint);
        }
        break;

      case DrawingToolType.line:
        if (points.length >= 2) {
          canvas.drawLine(points[0], points[1], paint);
          _drawArrowHead(canvas, points[0], points[1], paint);
        }
        break;
    }
  }

  void _drawArrowHead(Canvas canvas, Offset from, Offset to, Paint paint) {
    const double arrowSize = 10.0;
    final double angle = (to - from).direction;

    final path = Path();
    path.moveTo(to.dx, to.dy);
    path.lineTo(to.dx - arrowSize * (angle.abs() > 0.01 ? 1 : 0), to.dy - arrowSize / 2);
    path.moveTo(to.dx, to.dy);
    path.lineTo(to.dx - arrowSize * (angle.abs() > 0.01 ? 1 : 0), to.dy + arrowSize / 2);

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant DrawingSurfacePainter oldDelegate) => true;
}
