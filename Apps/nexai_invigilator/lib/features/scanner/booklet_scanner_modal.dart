import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../models/exam_models.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class BookletScannerModal extends StatefulWidget {
  final List<StudentDeskItem> presentStudentsWithoutBooklet;
  final Future<String?> Function(String usn, String barcode, String dummyBarcode) onBookletIngested;

  const BookletScannerModal({
    super.key,
    required this.presentStudentsWithoutBooklet,
    required this.onBookletIngested,
  });

  @override
  State<BookletScannerModal> createState() => _BookletScannerModalState();
}

class _BookletScannerModalState extends State<BookletScannerModal> {
  StudentDeskItem? _selectedStudent;
  final _barcodeController = TextEditingController();
  bool _isIngesting = false;

  @override
  void initState() {
    super.initState();
    if (widget.presentStudentsWithoutBooklet.isNotEmpty) {
      _selectedStudent = widget.presentStudentsWithoutBooklet.first;
    }
  }

  @override
  void dispose() {
    _barcodeController.dispose();
    super.dispose();
  }

  Future<void> _handleConfirmQuickIngest() async {
    final student = _selectedStudent;
    final barcode = _barcodeController.text.trim();
    if (student == null || barcode.isEmpty || _isIngesting) return;
    setState(() => _isIngesting = true);

    final digits = barcode.replaceFirst(RegExp(r'^BC-'), '');
    final dummyBarcode = 'ANON-${student.courseCode}-$digits';

    final error = await widget.onBookletIngested(student.usn, barcode, dummyBarcode);
    if (!mounted) return;
    if (error == null) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppTheme.primaryDark,
          content: Text('✓ Booklet $barcode tagged for ${student.studentName}'),
        ),
      );
    } else {
      setState(() => _isIngesting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(backgroundColor: Colors.red, content: Text(error)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: AnimatedPadding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height - MediaQuery.of(context).viewInsets.bottom,
          ),
          child: Material(
            type: MaterialType.transparency,
            child: Container(
              decoration: const BoxDecoration(
                color: AppTheme.bgSurface,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Drag handle
                  Container(
                    margin: const EdgeInsets.only(top: 12),
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),

                  // Header with title, subtitle, and close button
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: AppTheme.accentBlue.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(
                                  Icons.document_scanner,
                                  color: AppTheme.accentBlue,
                                  size: 22,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      'Answer Booklet Ingestion',
                                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                            fontWeight: FontWeight.w800,
                                            fontSize: 16,
                                          ),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'Scan Physical Barcode & Anonymize',
                                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                            fontSize: 11,
                                            color: AppTheme.textSecondary,
                                          ),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton(
                          onPressed: () => Navigator.pop(context),
                          icon: const Icon(Icons.close, color: AppTheme.textSecondary, size: 22),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                          tooltip: 'Close',
                        ),
                      ],
                    ),
                  ),

                  const Divider(height: 1, thickness: 1),

                  // Scrollable content
                  Flexible(
                    child: SingleChildScrollView(
                      padding: EdgeInsets.fromLTRB(
                        16,
                        12,
                        16,
                        24 + MediaQuery.of(context).viewInsets.bottom,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Select Student Desk
                          Text(
                            'Select Candidate Desk:',
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                          ),
                          const SizedBox(height: 8),

                          if (widget.presentStudentsWithoutBooklet.isEmpty)
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: AppTheme.primaryLight,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.check_circle, color: AppTheme.primary, size: 20),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      'All present students have ingested booklets!',
                                      style: TextStyle(
                                        color: AppTheme.primaryDark,
                                        fontWeight: FontWeight.w600,
                                        fontSize: 13,
                                      ),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            )
                          else
                            LayoutBuilder(
                              builder: (context, constraints) {
                                return DropdownButtonFormField<StudentDeskItem>(
                                  value: _selectedStudent,
                                  isExpanded: true,
                                  decoration: InputDecoration(
                                    filled: true,
                                    fillColor: AppTheme.bgBase,
                                    contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 14,
                                    ),
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: const BorderSide(color: AppTheme.cardBorder),
                                    ),
                                    enabledBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: const BorderSide(color: AppTheme.cardBorder),
                                    ),
                                    focusedBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: const BorderSide(color: AppTheme.accentBlue, width: 2),
                                    ),
                                  ),
                                  items: widget.presentStudentsWithoutBooklet.map((student) {
                                    return DropdownMenuItem<StudentDeskItem>(
                                      value: student,
                                      child: ConstrainedBox(
                                        constraints: BoxConstraints(maxWidth: constraints.maxWidth - 48),
                                        child: Text(
                                          '${student.deskId}: ${student.studentName} (${student.usn})',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(fontSize: 13),
                                        ),
                                      ),
                                    );
                                  }).toList(),
                                  onChanged: (val) {
                                    setState(() {
                                      _selectedStudent = val;
                                    });
                                  },
                                );
                              },
                            ),

                          const SizedBox(height: 16),

                          // Booklet Scanner Simulation Box
                          LayoutBuilder(
                            builder: (context, constraints) {
                              final scannerHeight = constraints.maxWidth * 0.55;
                              final scanFrameWidth = constraints.maxWidth * 0.75;
                              final scanFrameHeight = scanFrameWidth * 0.45;
                              return ConstrainedBox(
                                constraints: BoxConstraints(
                                  minHeight: scannerHeight,
                                  maxHeight: scannerHeight,
                                ),
                                child: Container(
                                  width: double.infinity,
                                  height: scannerHeight,
                                  decoration: BoxDecoration(
                                    color: AppTheme.bgDark,
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: Stack(
                                    alignment: Alignment.center,
                                    children: [
                                      Positioned.fill(
                                        child: ClipRRect(
                                          borderRadius: BorderRadius.circular(16),
                                          child: MobileScanner(
                                            controller: MobileScannerController(
                                              detectionSpeed: DetectionSpeed.noDuplicates,
                                            ),
                                            onDetect: (capture) {
                                              final List<Barcode> barcodes = capture.barcodes;
                                              for (final barcode in barcodes) {
                                                final String? val = barcode.rawValue;
                                                if (val != null) {
                                                  setState(() {
                                                    _barcodeController.text = val;
                                                  });
                                                }
                                              }
                                            },
                                            fit: BoxFit.cover,
                                          ),
                                        ),
                                      ),
                                      Container(
                                        width: scanFrameWidth,
                                        height: scanFrameHeight,
                                        decoration: BoxDecoration(
                                          border: Border.all(color: AppTheme.accentBlue, width: 2),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                      ),
                                      Positioned(
                                        bottom: 12,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: Colors.black.withValues(alpha: 0.6),
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                          child: const Text(
                                            'Optical Barcode Reader Active',
                                            style: TextStyle(color: Colors.white, fontSize: 11),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),

                          const SizedBox(height: 16),

                          // Physical Barcode Input
                          Text(
                            'Scanned Physical Barcode Number:',
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _barcodeController,
                            style: const TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1, fontSize: 14),
                            decoration: InputDecoration(
                              hintText: 'Scan or type the physical booklet barcode…',
                              prefixIcon: const Icon(Icons.barcode_reader, color: AppTheme.accentBlue, size: 20),
                              filled: true,
                              fillColor: AppTheme.bgBase,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: AppTheme.cardBorder),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: AppTheme.cardBorder),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: AppTheme.accentBlue, width: 2),
                              ),
                            ),
                          ),

                          const SizedBox(height: 16),

                          // Double-Blind Zero-Knowledge Notice
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFCBD5E1)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.lock, color: AppTheme.accentPurple, size: 20),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    'Decouples candidate identity & maps to an encrypted evaluation dummy barcode.',
                                    style: TextStyle(fontSize: 11, color: AppTheme.textPrimary, height: 1.4),
                                    maxLines: 3,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // Central Scanning Center Notice
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            margin: const EdgeInsets.only(bottom: 18),
                            decoration: BoxDecoration(
                              color: AppTheme.primaryLight,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.hub, size: 18, color: AppTheme.primaryDark),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    'Physical booklets will be digitized at the Central Scanning Station using CoE Session Keys.',
                                    style: TextStyle(fontSize: 11, color: AppTheme.primaryDark, fontWeight: FontWeight.w600, height: 1.3),
                                    maxLines: 3,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // Submit Button
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: (_selectedStudent == null || _isIngesting) ? null : _handleConfirmQuickIngest,
                              icon: Icon(_isIngesting ? Icons.hourglass_top : Icons.check_circle_outline, size: 18),
                              label: Flexible(
                                child: Text(
                                  _isIngesting ? 'Tagging booklet…' : 'Collect & Tag for Scanning Hub ✓',
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                                  textAlign: TextAlign.center,
                                  overflow: TextOverflow.ellipsis,
                                  maxLines: 1,
                                ),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.primary,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                elevation: 0,
                              ).copyWith(
                                disabledBackgroundColor: MaterialStateProperty.all(AppTheme.primary.withValues(alpha: 0.4)),
                              ),
                            ),
                          ),

                          // Extra space for bottom safe area
                          SizedBox(height: MediaQuery.of(context).padding.bottom),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}