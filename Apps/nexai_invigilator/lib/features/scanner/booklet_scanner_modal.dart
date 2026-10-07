import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../models/exam_models.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class BookletScannerModal extends StatefulWidget {
  final List<StudentDeskItem> presentStudentsWithoutBooklet;
  final Function(String usn, String barcode, String dummyBarcode, int digitizedPages) onBookletIngested;

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
      _barcodeController.text = 'BC-${100000 + (_selectedStudent.hashCode % 899999).abs()}';
    }
  }

  void _handleConfirmQuickIngest() {
    if (_selectedStudent == null || _barcodeController.text.trim().isEmpty) return;
    setState(() => _isIngesting = true);

    final dummyBarcode = 'ANON-${_selectedStudent!.courseCode}-${_barcodeController.text.replaceAll('BC-', '')}';

    Future.delayed(const Duration(milliseconds: 900), () {
      widget.onBookletIngested(_selectedStudent!.usn, _barcodeController.text.trim(), dummyBarcode, 0);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(backgroundColor: AppTheme.primaryDark, content: Text('✓ Tagged Booklet for Central Scanning Hub')),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
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
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppTheme.accentBlue.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.document_scanner, color: AppTheme.accentBlue, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Answer Booklet Ingestion',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        Text(
                          'Scan Physical Barcode & Anonymize',
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
                  // Select Student Desk
                  Text(
                    'Select Candidate Desk:',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),

                  if (widget.presentStudentsWithoutBooklet.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryLight,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.check_circle, color: AppTheme.primary),
                          SizedBox(width: 10),
                          Text('All present students have ingested booklets!'),
                        ],
                      ),
                    )
                  else
                    DropdownButtonFormField<StudentDeskItem>(
                      value: _selectedStudent,
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: AppTheme.bgBase,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppTheme.cardBorder),
                        ),
                      ),
                      items: widget.presentStudentsWithoutBooklet.map((student) {
                        return DropdownMenuItem(
                          value: student,
                          child: Text('${student.deskId}: ${student.studentName} (${student.usn})'),
                        );
                      }).toList(),
                      onChanged: (val) {
                        setState(() {
                          _selectedStudent = val;
                          if (val != null) {
                            _barcodeController.text = 'BC-${100000 + (val.hashCode % 899999).abs()}';
                          }
                        });
                      },
                    ),

                  const SizedBox(height: 20),

                  // Booklet Scanner Simulation Box
                  Container(
                    width: double.infinity,
                    height: 180,
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
                            ),
                          ),
                        ),
                        Container(
                          width: 220,
                          height: 80,
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
                              color: Colors.black.withOpacity(0.6),
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

                  const SizedBox(height: 20),

                  // Physical Barcode Input
                  Text(
                    'Scanned Physical Barcode Number:',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _barcodeController,
                    style: const TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.barcode_reader, color: AppTheme.accentBlue),
                      filled: true,
                      fillColor: AppTheme.bgBase,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppTheme.cardBorder),
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
                    child: const Row(
                      children: [
                        Icon(Icons.lock, color: AppTheme.accentPurple, size: 20),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Decouples candidate identity & maps to an encrypted evaluation dummy barcode.',
                            style: TextStyle(fontSize: 11, color: AppTheme.textPrimary, height: 1.4),
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
                    child: const Row(
                      children: [
                        Icon(Icons.hub, size: 18, color: AppTheme.primaryDark),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Physical booklets will be digitized at the Central Scanning Station using CoE Session Keys.',
                            style: TextStyle(fontSize: 11, color: AppTheme.primaryDark, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Submit Buttons
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: (_selectedStudent == null || _isIngesting) ? null : _handleConfirmQuickIngest,
                      icon: const Icon(Icons.check_circle_outline, size: 18),
                      label: const Text('Collect & Tag for Scanning Hub ✓', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
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
