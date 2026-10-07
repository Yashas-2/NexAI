import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_theme.dart';
import '../../../models/student_models.dart';

class FullQuestionPaperModal extends StatefulWidget {
  final List<ExamQuestionItem> questions;
  final ExamScheduleItem exam;
  final int totalMarks;
  final int durationMins;
  final Function(int questionIndex) onSelectQuestion;

  const FullQuestionPaperModal({
    super.key,
    required this.questions,
    required this.exam,
    required this.totalMarks,
    required this.durationMins,
    required this.onSelectQuestion,
  });

  @override
  State<FullQuestionPaperModal> createState() => _FullQuestionPaperModalState();
}

class _FullQuestionPaperModalState extends State<FullQuestionPaperModal> {
  double _fontSizeScale = 1.0;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.92,
      decoration: const BoxDecoration(
        color: Color(0xFFF8FAFC),
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

          // Header Toolbar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryLight,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.description, color: AppTheme.primary, size: 20),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Complete Question Paper',
                              style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 15),
                              overflow: TextOverflow.ellipsis,
                            ),
                            const Text(
                              'Tap any question to jump directly & answer',
                              style: TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Row(
                  children: [
                    // Font Scale Buttons
                    IconButton(
                      onPressed: () => setState(() => _fontSizeScale = (_fontSizeScale - 0.1).clamp(0.8, 1.4)),
                      icon: const Icon(Icons.text_decrease, size: 18),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                      tooltip: 'Decrease Font',
                    ),
                    IconButton(
                      onPressed: () => setState(() => _fontSizeScale = (_fontSizeScale + 0.1).clamp(0.8, 1.4)),
                      icon: const Icon(Icons.text_increase, size: 18),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                      tooltip: 'Increase Font',
                    ),
                    const SizedBox(width: 4),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close, color: AppTheme.textSecondary),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Printable Paper Sheet Container
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFF0F172A), width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // University Crest & Question Paper Header
                    Center(
                      child: Column(
                        children: [
                          Text(
                            'NEXAI AUTONOMOUS UNIVERSITY OF TECHNOLOGY',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w900,
                              fontSize: 12 * _fontSizeScale,
                              letterSpacing: 0.8,
                              color: const Color(0xFF0F172A),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Degree Examination — Fall 2026',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 11 * _fontSizeScale,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${widget.exam.courseCode}: ${widget.exam.courseTitle}',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w900,
                              fontSize: 14 * _fontSizeScale,
                              color: AppTheme.primaryDark,
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 14),
                    const Divider(color: Color(0xFF0F172A), thickness: 1.2),

                    // Time, Max Marks & USN Box
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Time: ${widget.durationMins} Mins',
                              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11 * _fontSizeScale),
                            ),
                            Text(
                              'Max. Marks: ${widget.totalMarks} Marks',
                              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11 * _fontSizeScale, color: AppTheme.accentBlue),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            border: Border.all(color: const Color(0xFF0F172A), width: 1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'USN: Authenticated',
                            style: TextStyle(
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.w900,
                              fontSize: 11 * _fontSizeScale,
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 10),

                    // General Instructions
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Instructions to Candidates:', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 10 * _fontSizeScale)),
                          const SizedBox(height: 4),
                          Text('1. Answer FIVE full questions, choosing ONE full question from each module.', style: TextStyle(fontSize: 9.5 * _fontSizeScale, color: AppTheme.textSecondary)),
                          Text('2. Missing data, if any, may be suitably assumed.', style: TextStyle(fontSize: 9.5 * _fontSizeScale, color: AppTheme.textSecondary)),
                          Text('3. Use of non-programmable scientific calculators is permitted.', style: TextStyle(fontSize: 9.5 * _fontSizeScale, color: AppTheme.textSecondary)),
                        ],
                      ),
                    ),

                    const SizedBox(height: 18),
                    const Divider(color: Color(0xFF0F172A), thickness: 1),

                    // ── Questions List by Modules ──
                    if (widget.questions.isNotEmpty)
                      _buildModuleSection(
                        moduleName: 'ALL QUESTIONS',
                        questions: widget.questions,
                        startIndex: 0,
                      ),

                    const SizedBox(height: 24),
                    Center(
                      child: Text(
                        '*** END OF QUESTION PAPER ***',
                        style: TextStyle(
                          fontSize: 10 * _fontSizeScale,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1.5,
                          color: AppTheme.textMuted,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModuleSection({
    required String moduleName,
    required List<ExamQuestionItem> questions,
    required int startIndex,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Module Header Banner
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            moduleName,
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 10 * _fontSizeScale,
              letterSpacing: 0.5,
            ),
          ),
        ),
        const SizedBox(height: 10),

        // Questions within Module
        ...questions.asMap().entries.map((entry) {
          final index = startIndex + entry.key;
          final q = entry.value;

          return InkWell(
            onTap: () {
              widget.onSelectQuestion(index);
              Navigator.pop(context);
            },
            borderRadius: BorderRadius.circular(8),
            child: Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: q.isAnswered ? const Color(0xFFF0FDF4) : const Color(0xFFFAFAFA),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: q.isAnswered ? const Color(0xFFBBF7D0) : const Color(0xFFE2E8F0),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Q-Number Pill (Clickable)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: q.isAnswered ? AppTheme.accentGreen : AppTheme.primary,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'Q.${q.questionNumber}',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 11 * _fontSizeScale,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Question Text
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          q.questionText,
                          style: GoogleFonts.inter(
                            fontWeight: FontWeight.w600,
                            fontSize: 12.5 * _fontSizeScale,
                            height: 1.4,
                            color: const Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            if (q.isAnswered)
                              Row(
                                children: [
                                  const Icon(Icons.check_circle, color: AppTheme.accentGreen, size: 12),
                                  const SizedBox(width: 4),
                                  Text('Answered on Script', style: TextStyle(color: AppTheme.accentGreen, fontSize: 10 * _fontSizeScale, fontWeight: FontWeight.w700)),
                                ],
                              )
                            else
                              Text('Tap to write answer →', style: TextStyle(color: AppTheme.accentBlue, fontSize: 10 * _fontSizeScale, fontWeight: FontWeight.w600)),

                            Text(
                              '[${q.maxMarks} Marks]',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 11 * _fontSizeScale,
                                color: const Color(0xFF0F172A),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }
}
