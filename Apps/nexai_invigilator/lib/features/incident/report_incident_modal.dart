import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../models/exam_models.dart';

class ReportIncidentModal extends StatefulWidget {
  final List<StudentDeskItem> presentStudents;
  final Future<String?> Function(String usn, String infractionType, String description) onIncidentReported;

  const ReportIncidentModal({
    super.key,
    required this.presentStudents,
    required this.onIncidentReported,
  });

  @override
  State<ReportIncidentModal> createState() => _ReportIncidentModalState();
}

class _ReportIncidentModalState extends State<ReportIncidentModal> {
  StudentDeskItem? _selectedStudent;
  String _selectedInfraction = 'Unauthorized Notes / Micro-chits';
  final _descriptionController = TextEditingController();
  bool _isBroadcasting = false;

  final List<String> _infractionTypes = [
    'Unauthorized Notes / Micro-chits',
    'Electronic Device / Smart Watch / Phone',
    'Impersonation / Fake ID',
    'Disruptive Behavior / Talking',
    'Tampered Answer Booklet Seal',
  ];

  @override
  void initState() {
    super.initState();
    if (widget.presentStudents.isNotEmpty) {
      _selectedStudent = widget.presentStudents.first;
    }
  }

  Future<void> _handleSubmitIncident() async {
    final student = _selectedStudent;
    if (student == null || _isBroadcasting) return;

    setState(() => _isBroadcasting = true);

    final error = await widget.onIncidentReported(
      student.usn,
      _selectedInfraction,
      _descriptionController.text.trim(),
    );

    if (!mounted) return;
    if (error == null) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppTheme.accentRed,
          content: Text('⚠️ Malpractice incident broadcast to CoE for ${student.usn}'),
        ),
      );
    } else {
      setState(() => _isBroadcasting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(backgroundColor: Colors.red, content: Text(error)),
      );
    }
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final isKeyboardOpen = bottomInset > 0;
    final screenHeight = MediaQuery.of(context).size.height;
    final availableHeight = screenHeight - bottomInset;

    return SafeArea(
      top: false,
      child: AnimatedPadding(
        padding: EdgeInsets.only(bottom: bottomInset),
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: availableHeight,
            minHeight: availableHeight * 0.4,
          ),
          child: Material(
            type: MaterialType.transparency,
            child: Container(
              constraints: BoxConstraints(maxHeight: availableHeight),
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
      color: AppTheme.accentRed.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(10),
    ),
                                child: const Icon(
                                  Icons.warning_amber_rounded,
                                  color: AppTheme.accentRed,
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
                                      'Report Malpractice Incident',
                                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                            fontWeight: FontWeight.w800,
                                            fontSize: 16,
                                          ),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'Broadcast Incident to Chief Superintendent',
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
                      padding: EdgeInsets.fromLTRB(16, 12, 16, isKeyboardOpen ? 24 : 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Candidate Select
                          Text(
                            'Select Candidate Involved:',
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                          ),
                          const SizedBox(height: 8),
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
                                items: widget.presentStudents.map((student) {
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
                                onChanged: (val) => setState(() => _selectedStudent = val),
                              );
                            },
                          ),

                          const SizedBox(height: 16),

                          // Infraction Category
                          Text(
                            'Infraction Classification:',
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                          ),
                          const SizedBox(height: 8),
                          LayoutBuilder(
                            builder: (context, constraints) {
                              return DropdownButtonFormField<String>(
                                value: _selectedInfraction,
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
                                items: _infractionTypes.map((type) {
                                  return DropdownMenuItem<String>(
                                    value: type,
                                    child: ConstrainedBox(
                                      constraints: BoxConstraints(maxWidth: constraints.maxWidth - 48),
                                      child: Text(
                                        type,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(fontSize: 13),
                                      ),
                                    ),
                                  );
                                }).toList(),
                                onChanged: (val) => setState(() => _selectedInfraction = val!),
                              );
                            },
                          ),

                          const SizedBox(height: 16),

                          // Description / Notes
                          Text(
                            'Invigilator Incident Narrative:',
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _descriptionController,
                            maxLines: isKeyboardOpen ? 5 : 3,
                            minLines: 3,
                            decoration: InputDecoration(
                              hintText: 'Describe where and how the unauthorized material was confiscated...',
                              hintStyle: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                              filled: true,
                              fillColor: AppTheme.bgBase,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
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

                          const SizedBox(height: 20),

                          // Submit Broadcast Button
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: (_selectedStudent == null || _isBroadcasting) ? null : _handleSubmitIncident,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.accentRed,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                elevation: 0,
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Flexible(
                                    child: Icon(
                                      _isBroadcasting ? Icons.hourglass_top : Icons.send,
                                      color: Colors.white,
                                      size: 18,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Flexible(
                                    child: Text(
                                      _isBroadcasting ? 'Broadcasting Alert...' : 'Broadcast Alert to CoE Command Center ⚠️',
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                                      textAlign: TextAlign.center,
                                      overflow: TextOverflow.ellipsis,
                                      maxLines: 1,
                                    ),
                                  ),
                                ],
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