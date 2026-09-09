import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';
import '../../models/student_models.dart';
import '../exam_sandbox/widgets/digital_paper_canvas.dart';
import '../exam_sandbox/widgets/full_question_paper_modal.dart';
import 'widgets/ai_proctor_camera_bubble.dart';
import '../../services/api_service.dart';
import 'dart:async';

enum ResponseInputMode { digitalPen, typedText, mcq }

class ProctoredExamKioskScreen extends StatefulWidget {
  final ExamScheduleItem exam;

  const ProctoredExamKioskScreen({
    super.key,
    required this.exam,
  });

  @override
  State<ProctoredExamKioskScreen> createState() => _ProctoredExamKioskScreenState();
}

class _ProctoredExamKioskScreenState extends State<ProctoredExamKioskScreen> with WidgetsBindingObserver {
  int _currentQuestionIndex = 0;
  int _currentPageNumber = 1;
  int _totalPages = 4;
  late List<ExamQuestionItem> _questions;
  bool _isSubmitted = false;
  ResponseInputMode _inputMode = ResponseInputMode.digitalPen;
  bool _isQuestionExpanded = true;
  int _strikeCount = 0;
  bool _isLoadingQuestions = true;
  String? _countdownMessage;
  Timer? _countdownTimer;

  final TextEditingController _answerController = TextEditingController();
  static const platform = MethodChannel('com.nexai.kiosk/lock');

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    // Lock device in immersive kiosk mode and Android Screen Pinning
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    _enableKioskMode();

    _fetchQuestions();
  }

  Future<void> _fetchQuestions() async {
    if (widget.exam.questionPaperId == null) {
      setState(() {
        _questions = [
          ExamQuestionItem(questionNumber: 1, questionText: 'No Question Paper linked to this exam.', maxMarks: 0, type: 'THEORY'),
        ];
        _isLoadingQuestions = false;
        _updateAnswerController();
      });
      return;
    }

    try {
      final response = await ApiService.get('/vault/papers/${widget.exam.questionPaperId}/time_release/');
      
      if (response['status'] == 'unlocked' || response['status'] == 'unlocked_draft') {
        final content = response['content'];
        final questionsList = (content['questions'] as List?)?.map((q) => ExamQuestionItem(
          questionNumber: q['questionNumber'] ?? 0,
          questionText: q['questionText'] ?? '',
          maxMarks: q['marks'] ?? 0,
          type: q['type'] ?? 'THEORY',
          options: (q['options'] as List?)?.map((e) => e.toString()).toList(),
        )).toList() ?? [];

        setState(() {
          _questions = questionsList.isNotEmpty ? questionsList : [
            ExamQuestionItem(questionNumber: 1, questionText: 'No questions found in payload.', maxMarks: 0, type: 'THEORY')
          ];
          _isLoadingQuestions = false;
          _countdownTimer?.cancel();
          _updateAnswerController();
        });
      }
    } catch (e) {
      final errStr = e.toString();
      if (errStr.contains('403')) {
        // Extract remaining seconds if possible, else default to 120
        final RegExp regex = RegExp(r'remaining_seconds.*?(\d+)');
        final match = regex.firstMatch(errStr);
        int remainingSeconds = match != null ? int.parse(match.group(1)!) : 120;
        
        setState(() {
          _isLoadingQuestions = true;
          _countdownMessage = "Questions unlock in ${_formatDuration(remainingSeconds)}";
        });
        
        _startCountdown(remainingSeconds);
      } else {
        setState(() {
          _questions = [
            ExamQuestionItem(questionNumber: 1, questionText: 'Error fetching questions: $e', maxMarks: 0, type: 'THEORY'),
          ];
          _isLoadingQuestions = false;
          _updateAnswerController();
        });
      }
    }
  }

  void _startCountdown(int seconds) {
    _countdownTimer?.cancel();
    int current = seconds;
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (current <= 0) {
        timer.cancel();
        _fetchQuestions(); // Try fetching again
      } else {
        setState(() {
          current--;
          _countdownMessage = "Questions unlock in ${_formatDuration(current)}";
        });
      }
    });
  }

  String _formatDuration(int seconds) {
    final mins = seconds ~/ 60;
    final secs = seconds % 60;
    return '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  Future<void> _enableKioskMode() async {
    try {
      await platform.invokeMethod('startKioskMode');
    } on PlatformException catch (e) {
      debugPrint("Failed to start kiosk mode: '${e.message}'.");
    }
  }

  Future<void> _disableKioskMode() async {
    try {
      await platform.invokeMethod('stopKioskMode');
    } on PlatformException catch (e) {
      debugPrint("Failed to stop kiosk mode: '${e.message}'.");
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.inactive || state == AppLifecycleState.paused) {
      // Focus lost - Malpractice Warning
      _handleFocusLostWarning();
    }
  }

  void _handleFocusLostWarning() {
    if (_isSubmitted) return;

    setState(() {
      if (_strikeCount < 3) _strikeCount++;
    });

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E1B4B),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444), size: 28),
            SizedBox(width: 8),
            Text('Proctor Security Alert', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'App Focus Loss / Screen Switch Detected!',
              style: TextStyle(color: Color(0xFFFCA5A5), fontWeight: FontWeight.w800, fontSize: 13),
            ),
            const SizedBox(height: 8),
            Text(
              'Leaving the examination kiosk or opening split-screen is recorded as a malpractice violation.\n\nStrike Recorded: $_strikeCount of 3',
              style: const TextStyle(color: Colors.white70, fontSize: 12),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.accentRed),
            child: const Text('Return to Assessment', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }

  void _handleProctorWarning() {
    setState(() {
      if (_strikeCount < 3) _strikeCount++;
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _countdownTimer?.cancel();
    // Restore normal system navigation and unpin screen
    _disableKioskMode();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  void _updateAnswerController() {
    _answerController.text = _questions[_currentQuestionIndex].candidateAnswer ?? '';
    if (_questions[_currentQuestionIndex].type == 'MCQ') {
      _inputMode = ResponseInputMode.mcq;
    } else {
      _inputMode = ResponseInputMode.digitalPen;
    }
  }

  void _saveCurrentAnswer() {
    setState(() {
      _questions[_currentQuestionIndex].candidateAnswer = _answerController.text.trim();
      _questions[_currentQuestionIndex].isAnswered = _answerController.text.trim().isNotEmpty || _inputMode == ResponseInputMode.digitalPen;
    });
  }

  void _handleOptionSelected(String option) {
    setState(() {
      _questions[_currentQuestionIndex].candidateAnswer = option;
      _questions[_currentQuestionIndex].isAnswered = true;
    });
  }

  void _openFullQuestionPaper() {
    _saveCurrentAnswer();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => FullQuestionPaperModal(
        questions: _questions,
        onSelectQuestion: (idx) {
          setState(() {
            _currentQuestionIndex = idx;
            _updateAnswerController();
          });
        },
      ),
    );
  }

  void _handleSubmitExam() {
    _saveCurrentAnswer();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm Final Exam Submission'),
        content: const Text(
          'Are you sure you want to finish and submit? This will seal your digital answer booklet with your cryptographic signature and safely exit AI Proctored Kiosk Mode.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Return to Exam'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              setState(() => _isSubmitted = true);
              // Restore system navigation upon completion and unpin screen
              _disableKioskMode();
              SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
            child: const Text('Submit & Exit Proctor Mode ✓'),
          ),
        ],
      ),
    );
  }

  void _addNewPage() {
    setState(() {
      _totalPages++;
      _currentPageNumber = _totalPages;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: AppTheme.primaryDark,
        content: Text('✓ Attached Extra Sheet (Page $_totalPages)'),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoadingQuestions) {
      return Scaffold(
        backgroundColor: AppTheme.bgBase,
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.lock_clock, color: AppTheme.accentBlue, size: 64),
              const SizedBox(height: 24),
              const Text(
                'Awaiting Vault Decryption',
                style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 12),
              Text(
                _countdownMessage ?? 'Loading securely...',
                style: const TextStyle(color: Colors.white70, fontSize: 16),
              ),
              const SizedBox(height: 32),
              const CircularProgressIndicator(color: AppTheme.accentBlue),
            ],
          ),
        ),
      );
    }

    // Intercept back button to prevent accidental exit
    return PopScope(
      canPop: _isSubmitted,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && !_isSubmitted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              backgroundColor: AppTheme.accentRed,
              content: Text('⚠️ Cannot exit locked exam without submitting. Tap "Submit Exam" at the bottom.'),
            ),
          );
        }
      },
      child: Scaffold(
        backgroundColor: AppTheme.bgBase,
        appBar: AppBar(
          automaticallyImplyLeading: false,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${widget.exam.courseCode}: ${widget.exam.courseTitle}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
              Row(
                children: [
                  Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF4ADE80), shape: BoxShape.circle)),
                  const SizedBox(width: 4),
                  const Text('AI Proctoring Active • Kiosk Mode', style: TextStyle(fontSize: 10, color: AppTheme.accentGreen, fontWeight: FontWeight.w700)),
                ],
              ),
            ],
          ),
          actions: [
            // Complete Question Paper Button
            InkWell(
              onTap: _openFullQuestionPaper,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                margin: const EdgeInsets.symmetric(vertical: 8),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.primary,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.description, color: Colors.white, size: 14),
                    SizedBox(width: 4),
                    Text(
                      'Full QP',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(width: 8),

            // Live Countdown Timer
            Container(
              margin: const EdgeInsets.only(right: 12, top: 8, bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppTheme.bgDark,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                children: [
                  Icon(Icons.timer, color: Color(0xFFFBBF24), size: 14),
                  SizedBox(width: 4),
                  Text('01:42:18', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 11)),
                ],
              ),
            ),
          ],
        ),
        body: _isSubmitted ? _buildSubmissionReceipt() : _buildExamWorkspace(q: _questions[_currentQuestionIndex]),
      ),
    );
  }

  Widget _buildSubmissionReceipt() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 84,
              height: 84,
              decoration: const BoxDecoration(
                color: Color(0xFFDCFCE7),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.verified_user, color: AppTheme.accentGreen, size: 50),
            ),
            const SizedBox(height: 20),
            Text(
              'Assessment Submitted & Kiosk Released!',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(fontWeight: FontWeight.w900, fontSize: 20),
            ),
            const SizedBox(height: 8),
            const Text(
              'Your handwritten digital booklet and diagram responses have been cryptographically hashed and uploaded to the NexAI Evaluation Vault. AI Proctor stream closed.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.bgSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.cardBorder),
              ),
              child: Column(
                children: [
                  const Text('DIGITAL SUBMISSION RECEIPT HASH:', style: TextStyle(fontSize: 10, color: AppTheme.textSecondary, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  const Text('0x7f9a2b84c01de23f990142aa', style: TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w800, color: AppTheme.accentBlue)),
                  const SizedBox(height: 8),
                  Text('PROCTOR INTEGRITY SCORE: 100% (Strikes: $_strikeCount/3)', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppTheme.accentGreen)),
                ],
              ),
            ),
            const SizedBox(height: 28),
            ElevatedButton(
              onPressed: () {
                SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
                Navigator.pop(context);
              },
              child: const Text('Back to Student Portal'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildExamWorkspace({required ExamQuestionItem q}) {
    return Stack(
      children: [
        // Main Body
        Positioned.fill(
          child: Column(
            children: [
              // ── Row 1: Question Selector Tabs ──
              Container(
                height: 48,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                color: AppTheme.bgSurface,
                child: Row(
                  children: [
                    // Quick Full Paper Pill
                    InkWell(
                      onTap: _openFullQuestionPaper,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        margin: const EdgeInsets.only(right: 8),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryLight,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppTheme.primary.withValues(alpha: 0.4)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.menu_book, color: AppTheme.primaryDark, size: 14),
                            SizedBox(width: 4),
                            Text(
                              'Paper',
                              style: TextStyle(color: AppTheme.primaryDark, fontWeight: FontWeight.w800, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    ),

                    Expanded(
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _questions.length,
                        separatorBuilder: (context, i) => const SizedBox(width: 8),
                        itemBuilder: (context, i) {
                          final isCurrent = i == _currentQuestionIndex;
                          final isAnswered = _questions[i].isAnswered;

                          return InkWell(
                            onTap: () {
                              _saveCurrentAnswer();
                              setState(() {
                                _currentQuestionIndex = i;
                                _updateAnswerController();
                              });
                            },
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              width: 38,
                              decoration: BoxDecoration(
                                color: isCurrent ? AppTheme.primary : (isAnswered ? AppTheme.accentGreen.withValues(alpha: 0.15) : AppTheme.bgBase),
                                border: Border.all(
                                  color: isCurrent ? AppTheme.primary : (isAnswered ? AppTheme.accentGreen : AppTheme.cardBorder),
                                  width: 1.5,
                                ),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                'Q${i + 1}',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 12,
                                  color: isCurrent ? Colors.white : (isAnswered ? AppTheme.accentGreen : AppTheme.textPrimary),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),

                    // Response Mode Switcher (Pen vs Keyboard)
                    if (q.type != 'MCQ')
                      Container(
                        margin: const EdgeInsets.only(left: 8),
                        padding: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          color: AppTheme.bgBase,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppTheme.cardBorder),
                        ),
                        child: Row(
                          children: [
                            _buildModeButton(
                              icon: Icons.edit_note,
                              tooltip: 'Digital Pen & Paper',
                              isSelected: _inputMode == ResponseInputMode.digitalPen,
                              onTap: () => setState(() => _inputMode = ResponseInputMode.digitalPen),
                            ),
                            _buildModeButton(
                              icon: Icons.keyboard,
                              tooltip: 'Type / Code Editor',
                              isSelected: _inputMode == ResponseInputMode.typedText,
                              onTap: () => setState(() => _inputMode = ResponseInputMode.typedText),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const Divider(height: 1),

              // ── Row 2: Question Header Banner (Collapsible) ──
              InkWell(
                onTap: () => setState(() => _isQuestionExpanded = !_isQuestionExpanded),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  color: const Color(0xFFF1F5F9),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryDark,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'Q${_currentQuestionIndex + 1} (${q.maxMarks}M)',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 11),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          q.questionText,
                          maxLines: _isQuestionExpanded ? 4 : 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 13, color: AppTheme.textPrimary),
                        ),
                      ),
                      Icon(
                        _isQuestionExpanded ? Icons.expand_less : Icons.expand_more,
                        size: 18,
                        color: AppTheme.textSecondary,
                      ),
                    ],
                  ),
                ),
              ),

              // ── Main Answering Area (Physical Paper Drawing vs Typed Editor) ──
              Expanded(
                child: _inputMode == ResponseInputMode.digitalPen
                    ? DigitalPaperCanvas(
                        questionTitle: 'Q${_currentQuestionIndex + 1}',
                        pageNumber: _currentPageNumber,
                        totalPages: _totalPages,
                        onPageAdded: _addNewPage,
                      )
                    : _buildAlternativeInputView(q),
              ),

              // ── Bottom Sheet & Actions Bar ──
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: const BoxDecoration(
                  color: AppTheme.bgSurface,
                  border: Border(top: BorderSide(color: AppTheme.cardBorder)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Booklet Page Navigation Strip
                    if (_inputMode == ResponseInputMode.digitalPen)
                      Row(
                        children: [
                          IconButton(
                            onPressed: _currentPageNumber > 1 ? () => setState(() => _currentPageNumber--) : null,
                            icon: const Icon(Icons.chevron_left, size: 20),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                          ),
                          Text(
                            'Page $_currentPageNumber / $_totalPages',
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
                          ),
                          IconButton(
                            onPressed: _currentPageNumber < _totalPages ? () => setState(() => _currentPageNumber++) : null,
                            icon: const Icon(Icons.chevron_right, size: 20),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                          ),
                          const SizedBox(width: 4),
                          InkWell(
                            onTap: _addNewPage,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppTheme.primaryLight,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
                              ),
                              child: const Text('+ Extra Sheet', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppTheme.primaryDark)),
                            ),
                          ),
                        ],
                      )
                    else
                      const Text('Text Editor Active', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),

                    // Next / Finish Button
                    Row(
                      children: [
                        if (_currentQuestionIndex < _questions.length - 1)
                          ElevatedButton(
                            onPressed: () {
                              _saveCurrentAnswer();
                              setState(() {
                                _currentQuestionIndex++;
                                _updateAnswerController();
                              });
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primary,
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                            ),
                            child: const Text('Next Q →', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                          )
                        else
                          ElevatedButton.icon(
                            onPressed: _handleSubmitExam,
                            icon: const Icon(Icons.check, size: 16),
                            label: const Text('Submit Exam ✓'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.accentGreen,
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
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

        // ── Picture-in-Picture Live AI Proctor Camera ──
        Positioned(
          top: 110,
          right: 12,
          child: AiProctorCameraBubble(
            strikeCount: _strikeCount,
            onWarningTriggered: _handleProctorWarning,
          ),
        ),
      ],
    );
  }

  Widget _buildModeButton({
    required IconData icon,
    required String tooltip,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Icon(
          icon,
          size: 18,
          color: isSelected ? Colors.white : AppTheme.textSecondary,
        ),
      ),
    );
  }

  Widget _buildAlternativeInputView(ExamQuestionItem q) {
    if (q.type == 'MCQ' && q.options != null) {
      return SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: q.options!.map((opt) {
            final isSelected = q.candidateAnswer == opt;
            return InkWell(
              onTap: () => _handleOptionSelected(opt),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isSelected ? AppTheme.primaryLight : AppTheme.bgSurface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isSelected ? AppTheme.primary : AppTheme.cardBorder,
                    width: isSelected ? 2 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
                      color: isSelected ? AppTheme.primary : AppTheme.textSecondary,
                      size: 18,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(opt, style: TextStyle(fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500)),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            q.type == 'CODE' ? 'Write Code Implementation:' : 'Candidate Response (Typed):',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: _answerController,
            maxLines: 12,
            style: TextStyle(
              fontFamily: q.type == 'CODE' ? 'monospace' : null,
              fontSize: 13,
              height: 1.4,
            ),
            decoration: InputDecoration(
              hintText: q.type == 'CODE' ? 'def solution():\n    # write code here...' : 'Enter your detailed solution explanation...',
              filled: true,
              fillColor: AppTheme.bgSurface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppTheme.cardBorder),
              ),
            ),
            onChanged: (val) {
              _questions[_currentQuestionIndex].candidateAnswer = val;
              _questions[_currentQuestionIndex].isAnswered = val.trim().isNotEmpty;
            },
          ),
        ],
      ),
    );
  }
}
